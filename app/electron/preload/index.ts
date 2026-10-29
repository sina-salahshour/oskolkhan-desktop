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

/** An external media player detected on the host (id + display name). */
export interface ExternalPlayer {
  id: string
  name: string
}

/** A single download progress / terminal event forwarded from the main process. */
export interface DownloadProgress {
  id: string
  received: number
  total: number
  state: 'active' | 'done' | 'error' | 'canceled'
  path?: string
}

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
  /** External media players detected on the host (for "open in…"). */
  players: ExternalPlayer[]
  /** Launch a (local /stream) URL in a detected external player; resolves true on spawn. */
  openInPlayer(playerId: string, url: string): Promise<boolean>
  /** Start a streamed download of `url` to `destDir` (a group folder) or the app's
   *  default downloads dir; resolves the download id. */
  download(url: string, filename: string, destDir?: string): Promise<string>
  /** Abort an in-flight download (by id) and delete its partial file. */
  cancelDownload(id: string): Promise<void>
  /** Subscribe to download progress/terminal events; returns an unsubscribe fn. */
  onDownloadProgress(cb: (p: DownloadProgress) => void): () => void
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
  players?: ExternalPlayer[]
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
  players: boot.players ?? [],
  openInPlayer: (playerId, url) => ipcRenderer.invoke('oskol:openInPlayer', playerId, url),
  download: (url, filename, destDir) => ipcRenderer.invoke('oskol:download', url, filename, destDir),
  cancelDownload: (id) => ipcRenderer.invoke('oskol:cancelDownload', id),
  onDownloadProgress: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, p: DownloadProgress) => cb(p)
    ipcRenderer.on('oskol:download-progress', listener)
    return () => ipcRenderer.removeListener('oskol:download-progress', listener)
  },
  platform: boot.platform,
  appVersion: boot.appVersion
}

contextBridge.exposeInMainWorld('oskol', api)
