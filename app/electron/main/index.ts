import { app, BrowserWindow, ipcMain, shell, clipboard, dialog } from 'electron'
import { join } from 'node:path'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { CoreSidecar, type Endpoint } from './core'
import { buildMenu } from './menu'

// Wayland first (Hyprland on this machine). Must run before app is ready.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations')

const sidecar = new CoreSidecar()
let mainWindow: BrowserWindow | null = null

function registerIpc(endpoint: Endpoint): void {
  // Synchronous boot info the preload reads once, before the renderer runs.
  ipcMain.on('oskol:bootinfo', (event) => {
    event.returnValue = {
      port: endpoint.port,
      token: endpoint.token,
      platform: process.platform,
      appVersion: app.getVersion()
    }
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
