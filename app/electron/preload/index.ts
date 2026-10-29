import { contextBridge, ipcRenderer } from 'electron'

// ---------------------------------------------------------------------------
// The single, sandbox-safe bridge the renderer talks to. Everything that needs
// Node / main-process privilege (fs, dialog, shell, clipboard, logging) goes
// over IPC; the renderer only ever sees the plain functions below on
// `window.oskol`. Keep this shape in sync with the renderer's typings
// (Worker B's lib) and the main-process handlers in electron/main/index.ts.
// ---------------------------------------------------------------------------

/** Where the local core sidecar listens, and the per-launch bridge secret. */
export interface CoreEndpoint {
  port: number
  token: string
}

/** One structured line appended to <userData>/logs/app.log by the main process. */
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  scope?: string
  code?: string
  message: string
  ts?: number
  [key: string]: unknown
}

export type NavDirection = 'back' | 'forward'

export interface OskolApi {
  /** Synchronous: the core sidecar endpoint for lib/api/client.ts. */
  coreEndpoint(): CoreEndpoint
  /** Open a URL in the user's real browser. */
  openExternal(url: string): Promise<void>
  /** Write text to the system clipboard (e.g. copy-link per file). */
  clipboardWrite(text: string): Promise<boolean>
  /** Save bytes (or text) to a user-chosen path; resolves to the path or null. */
  saveFile(name: string, data: Uint8Array | ArrayBuffer | string): Promise<string | null>
  /** Pick one file (e.g. an .osbin to import); resolves to the path or null. */
  pickFile(): Promise<string | null>
  /** Append a structured entry to the local error log (fire-and-forget). */
  log(entry: LogEntry): void
  /** Subscribe to native-menu Back/Forward; returns an unsubscribe fn. */
  onNav(cb: (dir: NavDirection) => void): () => void
  /** process.platform of the host. */
  platform: NodeJS.Platform
  /** The Electron app version. */
  appVersion: string
}

// Pulled once, synchronously, before the document runs (see ipcMain.on in main).
const boot = ipcRenderer.sendSync('oskol:bootinfo') as {
  port: number
  token: string
  platform: NodeJS.Platform
  appVersion: string
}

const api: OskolApi = {
  coreEndpoint: () => ({ port: boot.port, token: boot.token }),
  openExternal: (url) => ipcRenderer.invoke('oskol:openExternal', url),
  clipboardWrite: (text) => ipcRenderer.invoke('oskol:clipboardWrite', text),
  saveFile: (name, data) => ipcRenderer.invoke('oskol:saveFile', name, data),
  pickFile: () => ipcRenderer.invoke('oskol:pickFile'),
  log: (entry) => ipcRenderer.send('oskol:log', entry),
  onNav: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, dir: NavDirection) => cb(dir)
    ipcRenderer.on('oskol:nav', listener)
    return () => ipcRenderer.removeListener('oskol:nav', listener)
  },
  platform: boot.platform,
  appVersion: boot.appVersion
}

contextBridge.exposeInMainWorld('oskol', api)
