import { app, BrowserWindow, nativeImage, nativeTheme } from 'electron'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createDesktopServices } from './composition-root/create-desktop-services'
import { registerDesktopIpc } from './ipc/register-desktop-ipc'

let mainWindow: BrowserWindow | null = null
let unsubscribeRuntime: (() => void) | null = null

const resolveAppIconPath = (): string | undefined => {
  const candidates = [
    join(process.resourcesPath, 'logo-lime.png'),
    resolve(process.cwd(), 'logo-lime.png'),
    resolve(process.cwd(), 'apps/desktop/src/renderer/public/logo-lime.png')
  ]

  return candidates.find((path) => existsSync(path))
}

const createMainWindow = (): BrowserWindow => {
  const appIconPath = resolveAppIconPath()
  const window = new BrowserWindow({
    width: 1540,
    height: 1040,
    minWidth: 1280,
    minHeight: 860,
    backgroundColor: '#efe7d8',
    icon: appIconPath,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

const bootstrap = async (): Promise<void> => {
  nativeTheme.themeSource = 'light'

  const appIconPath = resolveAppIconPath()
  const dock = app.dock
  if (process.platform === 'darwin' && dock && appIconPath) {
    const appIcon = nativeImage.createFromPath(appIconPath)
    if (!appIcon.isEmpty()) {
      dock.setIcon(appIcon)
    }
  }

  const services = createDesktopServices()
  mainWindow = createMainWindow()
  unsubscribeRuntime = registerDesktopIpc(mainWindow, services)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  void bootstrap()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void bootstrap()
    }
  })
})

app.on('window-all-closed', () => {
  unsubscribeRuntime?.()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
