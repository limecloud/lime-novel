import { app } from 'electron'
import { autoUpdater, type Logger, type ProgressInfo, type UpdateInfo } from 'electron-updater'

let updateCheckStarted = false

const logger: Logger = {
  info: (message?: unknown) => {
    console.info('[desktop-updater]', message)
  },
  warn: (message?: unknown) => {
    console.warn('[desktop-updater]', message)
  },
  error: (message?: unknown) => {
    console.error('[desktop-updater]', message)
  },
  debug: (message: string) => {
    console.debug('[desktop-updater]', message)
  }
}

const isExplicitDevUpdateCheckEnabled = (): boolean => process.env.LIME_NOVEL_FORCE_UPDATE_CHECK === 'true'

const shouldCheckForUpdates = (): boolean => app.isPackaged || isExplicitDevUpdateCheckEnabled()

const logUpdateInfo = (eventName: string, info: UpdateInfo): void => {
  logger.info(`${eventName}: version=${info.version}`)
}

const registerUpdaterEvents = (): void => {
  autoUpdater.on('checking-for-update', () => {
    logger.info('checking-for-update')
  })
  autoUpdater.on('update-available', (info) => {
    logUpdateInfo('update-available', info)
  })
  autoUpdater.on('update-not-available', (info) => {
    logUpdateInfo('update-not-available', info)
  })
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    logger.info(`download-progress: ${Math.round(progress.percent)}%`)
  })
  autoUpdater.on('update-downloaded', (info) => {
    logUpdateInfo('update-downloaded', info)
  })
  autoUpdater.on('error', (error) => {
    logger.error(error)
  })
}

export const startDesktopAutoUpdater = (): void => {
  if (updateCheckStarted || !shouldCheckForUpdates()) {
    return
  }

  updateCheckStarted = true
  autoUpdater.logger = logger
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = app.getVersion().includes('-')

  if (isExplicitDevUpdateCheckEnabled()) {
    autoUpdater.forceDevUpdateConfig = true
  }

  registerUpdaterEvents()
  void autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
    logger.error(error)
  })
}
