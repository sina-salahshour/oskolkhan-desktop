import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface Endpoint {
  port: number
  token: string
}

/** Ask the OS for a free loopback port (bind :0, read it, release it). */
function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => (port ? resolve(port) : reject(new Error('no free port'))))
    })
  })
}

/** Walk up from `start` until a Cargo.toml is found (the Rust workspace root). */
function findRepoRoot(start: string): string {
  let dir = start
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'Cargo.toml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  // Fallback: the app project's parent (…/oskolkhan-desktop/app -> repo root).
  return dirname(start)
}

/**
 * Owns the `oskol-serve` sidecar process for the app's lifetime: picks a free
 * port + random token, spawns the binary (dev: `cargo run`, prod: the bundled
 * resources binary), forwards the dev-only `OSKOL_BIND_INTERFACE`, waits until
 * `POST /rpc {command:"core_status"}` answers, and kills it on quit.
 */
export class CoreSidecar {
  endpoint: Endpoint | null = null
  private child: ChildProcess | null = null
  private stopped = false

  async start(): Promise<Endpoint> {
    const port = await pickFreePort()
    const token = randomBytes(24).toString('hex')
    const dataDir = process.env.OSKOL_DATA_DIR ?? join(app.getPath('userData'), 'core')

    // Forward the whole env so OSKOL_BIND_INTERFACE (and anything else the core
    // reads) is passed through, then pin the bridge coordinates on top.
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      OSKOL_BROWSER_PORT: String(port),
      OSKOL_BROWSER_TOKEN: token,
      OSKOL_DATA_DIR: dataDir
    }

    let command: string
    let args: string[]
    let cwd: string

    if (app.isPackaged) {
      command = join(process.resourcesPath, 'oskol-serve')
      args = []
      cwd = process.resourcesPath
    } else {
      cwd = findRepoRoot(app.getAppPath())
      command = 'cargo'
      args = ['run', '-q', '-p', 'oskol-core', '--bin', 'oskol-serve']
    }

    this.child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    this.child.stdout?.on('data', (d: Buffer) => process.stdout.write(`[core] ${d}`))
    this.child.stderr?.on('data', (d: Buffer) => process.stderr.write(`[core] ${d}`))
    this.child.on('exit', (code, signal) => {
      if (!this.stopped) {
        console.error(`[core] sidecar exited unexpectedly (code=${code} signal=${signal})`)
      }
    })

    this.endpoint = { port, token }
    await this.waitReady(this.endpoint)
    return this.endpoint
  }

  /** Poll POST /rpc core_status until it answers 200 (core is up, maybe still bootstrapping). */
  private async waitReady(ep: Endpoint): Promise<void> {
    const url = `http://127.0.0.1:${ep.port}/rpc`
    const deadline = Date.now() + 120_000 // generous: a cold `cargo run` may compile first
    let lastErr: unknown = null
    while (Date.now() < deadline) {
      if (this.stopped) throw new Error('sidecar stopped before ready')
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-oskol-token': ep.token },
          body: JSON.stringify({ command: 'core_status', args: {} })
        })
        if (res.ok) return
        lastErr = new Error(`core_status HTTP ${res.status}`)
      } catch (e) {
        lastErr = e
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    throw new Error(`core sidecar did not become ready in time: ${String(lastErr)}`)
  }

  stop(): void {
    this.stopped = true
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM')
      // Hard stop if it lingers.
      const child = this.child
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL')
      }, 2000).unref?.()
    }
    this.child = null
  }
}
