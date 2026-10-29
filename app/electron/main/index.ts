import { app, BrowserWindow, ipcMain, shell, clipboard, dialog } from 'electron'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join, resolve, sep } from 'node:path'
import { appendFile, mkdir, unlink, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { CoreSidecar, type Endpoint } from './core'
import { buildMenu } from './menu'

// Wayland first (Hyprland on this machine). Must run before app is ready.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations')

const sidecar = new CoreSidecar()
let mainWindow: BrowserWindow | null = null

/** External media players we know how to launch, in preference order. */
const KNOWN_PLAYERS: Array<{ id: string; name: string; bin: string }> = [
  { id: 'mpv', name: 'mpv', bin: 'mpv' },
  { id: 'vlc', name: 'VLC', bin: 'vlc' },
  { id: 'celluloid', name: 'Celluloid', bin: 'celluloid' },
  { id: 'haruna', name: 'Haruna', bin: 'haruna' },
  { id: 'smplayer', name: 'SMPlayer', bin: 'smplayer' },
  { id: 'mpc-qt', name: 'MPC-Qt', bin: 'mpc-qt' },
  { id: 'iina', name: 'IINA', bin: 'iina' },
  { id: 'totem', name: 'Videos (Totem)', bin: 'totem' }
]

/** Resolve a bare binary name against PATH; null if not found/executable. */
function whichBin(bin: string): string | null {
  const dirs = (process.env.PATH ?? '').split(delimiter)
  for (const d of dirs) {
    if (!d) continue
    const p = join(d, bin)
    if (existsSync(p)) return p
  }
  return null
}

/** Scan PATH for the known players RIGHT NOW. Called fresh on every bootinfo
 *  request (each app launch and each window reload), so a player the user just
 *  installed shows up without rebuilding. */
function detectPlayers(): Array<{ id: string; name: string; bin: string }> {
  return KNOWN_PLAYERS.map((p) => ({ ...p, bin: whichBin(p.bin) ?? '' })).filter((p) => p.bin !== '')
}

// ---------------------------------------------------------------------------
// Downloads. A streamed GET of a (loopback core) /stream URL to the OS downloads
// dir, with throttled progress sent to the renderer and AbortController-based
// cancellation. Start + cancel only — no resume (would need HTTP Range + partial
// bookkeeping). Active transfers are tracked so they can be cancelled by id.
// ---------------------------------------------------------------------------
type DownloadState = 'active' | 'done' | 'error' | 'canceled'
interface ActiveDownload {
  controller: AbortController
  path: string
}
const activeDownloads = new Map<string, ActiveDownload>()

const PROGRESS_MS = 250
const PROGRESS_BYTES = 1024 * 1024

function emitProgress(
  id: string,
  received: number,
  total: number,
  state: DownloadState,
  path?: string
): void {
  mainWindow?.webContents.send('oskol:download-progress', { id, received, total, state, path })
}

/** Strip any path component + unsafe chars so a filename can't traverse. */
function sanitizeFilename(raw: unknown): string {
  const base = String(raw ?? '').split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\x00-\x1f<>:"|?*]/g, '_').replace(/^\.+/, '').trim()
  return cleaned || 'download'
}

/** A collision-free path inside `dir`, appending " (n)" before the extension. */
function dedupePath(dir: string, filename: string): string {
  if (!existsSync(join(dir, filename))) return join(dir, filename)
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  const ext = dot > 0 ? filename.slice(dot) : ''
  let n = 1
  let candidate: string
  do {
    candidate = join(dir, `${stem} (${n})${ext}`)
    n += 1
  } while (existsSync(candidate))
  return candidate
}

async function runDownload(
  id: string,
  url: string,
  dest: string,
  controller: AbortController
): Promise<void> {
  let received = 0
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    const total = Number(res.headers.get('content-length') ?? 0)

    let lastTs = 0
    let lastBytes = 0
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        received += chunk.length
        const now = Date.now()
        if (now - lastTs >= PROGRESS_MS || received - lastBytes >= PROGRESS_BYTES) {
          lastTs = now
          lastBytes = received
          emitProgress(id, received, total, 'active')
        }
        cb(null, chunk)
      }
    })

    await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), counter, createWriteStream(dest))
    activeDownloads.delete(id)
    emitProgress(id, received, total || received, 'done', dest)
  } catch (err) {
    // If it's gone from the map, cancelDownload() already handled cleanup + event.
    if (!activeDownloads.has(id)) return
    activeDownloads.delete(id)
    try {
      await unlink(dest)
    } catch {
      /* partial may not exist */
    }
    emitProgress(id, received, 0, 'error')
  }
}

function registerIpc(endpoint: Endpoint): void {
  // Synchronous boot info the preload reads once, before the renderer runs.
  ipcMain.on('oskol:bootinfo', (event) => {
    event.returnValue = {
      port: endpoint.port,
      token: endpoint.token,
      platform: process.platform,
      appVersion: app.getVersion(),
      // Installed external players, detected fresh on each bootinfo (id/name only;
      // the resolved bin path stays in main and is re-resolved at launch time).
      players: detectPlayers().map((p) => ({ id: p.id, name: p.name }))
    }
  })

  // Open a (local /stream) URL in a detected external player. The player id must
  // be one we actually found — the renderer can't spawn arbitrary binaries.
  ipcMain.handle('oskol:openInPlayer', (_e, playerId: string, url: string) => {
    const player = detectPlayers().find((p) => p.id === playerId)
    if (!player || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false
    try {
      spawn(player.bin, [url], { detached: true, stdio: 'ignore' }).unref()
      return true
    } catch {
      return false
    }
  })

  // Start a streamed download. Returns a generated id immediately; the transfer
  // runs in the background and reports via 'oskol:download-progress'.
  // `destDir` is the download GROUP's folder (absolute, `~` ok). When absent, the
  // app's own default downloads dir is used.
  ipcMain.handle('oskol:download', (_e, url: string, filename: string, destDir?: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('invalid url')
    // Resolve the target directory: the group folder if given + absolute, else the
    // app's own downloads dir under userData.
    const defaultDir = join(app.getPath('userData'), 'downloads')
    let dir = defaultDir
    if (typeof destDir === 'string' && destDir.trim()) {
      const expanded = destDir.trim().startsWith('~')
        ? join(homedir(), destDir.trim().slice(1))
        : destDir.trim()
      if (isAbsolute(expanded)) dir = expanded
    }
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      dir = defaultDir
      mkdirSync(dir, { recursive: true })
    }
    const dest = dedupePath(dir, sanitizeFilename(filename))
    const dirResolved = resolve(dir)
    // Belt-and-braces: the resolved path must stay inside the chosen dir.
    if (resolve(dest) !== dirResolved && !resolve(dest).startsWith(dirResolved + sep)) {
      throw new Error('path escapes target dir')
    }
    const id = randomBytes(8).toString('hex')
    const controller = new AbortController()
    activeDownloads.set(id, { controller, path: dest })
    void runDownload(id, url, dest, controller)
    return id
  })

  // Abort an in-flight download + delete its partial file; emit 'canceled'.
  ipcMain.handle('oskol:cancelDownload', async (_e, id: string) => {
    const dl = activeDownloads.get(id)
    if (!dl) return
    activeDownloads.delete(id)
    dl.controller.abort()
    try {
      await unlink(dl.path)
    } catch {
      /* partial may already be gone / never created */
    }
    emitProgress(id, 0, 0, 'canceled')
  })

  ipcMain.handle('oskol:openExternal', async (_e, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) await shell.openExternal(url)
  })

  ipcMain.handle('oskol:clipboardWrite', (_e, text: string) => {
    clipboard.writeText(String(text ?? ''))
    return true
  })

  ipcMain.handle(
    'oskol:saveFile',
    async (_e, name: string, data: Uint8Array | ArrayBuffer | string) => {
      const win = mainWindow
      if (!win) return null
      const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: name })
      if (canceled || !filePath) return null
      const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data as ArrayBuffer)
      await writeFile(filePath, buf)
      return filePath
    }
  )

  ipcMain.handle('oskol:pickFile', async () => {
    const win = mainWindow
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openFile'] })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.on('oskol:log', (_e, entry: Record<string, unknown>) => {
    void (async () => {
      try {
        const dir = join(app.getPath('userData'), 'logs')
        await mkdir(dir, { recursive: true })
        const line = JSON.stringify({ ts: Date.now(), ...entry }) + '\n'
        await appendFile(join(dir, 'app.log'), line)
      } catch {
        /* logging must never throw into the app */
      }
    })()
  })
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b0b0d',
    title: 'OskolKhan',
    show: false,
    // Hide the native menu bar (the white strip at the top). The menu still
    // exists — its Back/Forward accelerators work, and the in-app topbar has
    // visible nav buttons. Press Alt to reveal it momentarily if ever needed.
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Dev: the electron-vite renderer dev server. Prod: the built file.
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && devUrl) {
    await mainWindow.loadURL(devUrl)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  try {
    const endpoint = await sidecar.start()
    registerIpc(endpoint)
    buildMenu(() => mainWindow)
    await createWindow()
  } catch (err) {
    console.error('[main] failed to start core sidecar:', err)
    app.quit()
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  sidecar.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => sidecar.stop())
