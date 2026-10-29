import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

/**
 * Native application menu. The History submenu's Back/Forward send `oskol:nav`
 * to the renderer, which wires them to the TanStack Router history (⌘/Alt + ←/→).
 */
export function buildMenu(getWindow: () => BrowserWindow | null): void {
  const isMac = process.platform === 'darwin'
  const nav = (dir: 'back' | 'forward') => getWindow()?.webContents.send('oskol:nav', dir)

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
    },
    { role: 'editMenu' },
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: isMac ? 'Cmd+Left' : 'Alt+Left',
          click: () => nav('back')
        },
        {
          label: 'Forward',
          accelerator: isMac ? 'Cmd+Right' : 'Alt+Right',
          click: () => nav('forward')
        }
      ]
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
