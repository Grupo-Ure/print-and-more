import path from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
// electron-updater ships CJS only — default-import and destructure.
import updater from 'electron-updater'
import { registerAppScheme, serveRendererBundle, RENDERER_ORIGIN, RENDERER_URL } from './appProtocol'
import { registerIpcHandlers } from './ipc'
import { restoreWindowState, trackWindowState } from './windowState'

const EXTERNAL_URL = /^(https?|mailto):/i

function createWindow(): void {
  const state = restoreWindowState()

  const win = new BrowserWindow({
    width: state.bounds?.width ?? 1280,
    height: state.bounds?.height ?? 800,
    x: state.bounds?.x,
    y: state.bounds?.y,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  trackWindowState(win)

  win.once('ready-to-show', () => {
    if (state.isMaximized) win.maximize()
    win.show()
  })

  // window.open / target=_blank: external links go to the system browser or
  // mail client; nothing may open a second window inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (EXTERNAL_URL.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  // The window itself may only ever show the app (dev server or app://).
  win.webContents.on('will-navigate', (event, url) => {
    const allowed =
      (devServerUrl != null && url.startsWith(devServerUrl)) || url.startsWith(RENDERER_ORIGIN)
    if (!allowed) {
      event.preventDefault()
      if (EXTERNAL_URL.test(url)) void shell.openExternal(url)
    }
  })

  if (devServerUrl) {
    void win.loadURL(devServerUrl)
  } else {
    void win.loadURL(RENDERER_URL)
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  registerAppScheme()

  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  void app.whenReady().then(() => {
    serveRendererBundle()
    registerIpcHandlers()
    createWindow()
    if (app.isPackaged) {
      // Checks the GitHub Releases feed, downloads in the background, shows a
      // system notification, and installs on the next quit. Failures (offline,
      // no newer release) are non-events: the app just runs what it has.
      updater.autoUpdater.checkForUpdatesAndNotify().catch(() => {})
    }
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
