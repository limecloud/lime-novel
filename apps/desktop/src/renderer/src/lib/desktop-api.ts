import type { DesktopApiContract } from '@lime-novel/application'

const resolveDesktopApi = (): DesktopApiContract => {
  if (typeof window === 'undefined' || !window.limeNovel) {
    throw new Error('Lime Novel 桌面桥接未就绪，请通过 Electron 桌面应用启动。')
  }

  return window.limeNovel
}

export const desktopApi: DesktopApiContract = resolveDesktopApi()
