import type { DesktopApiContract } from '@lime-novel/application'
import { createBrowserFallbackApi } from './browser-fallback'

export const desktopApi: DesktopApiContract =
  typeof window !== 'undefined' && window.limeNovel ? window.limeNovel : createBrowserFallbackApi()
