/// <reference types="vite/client" />

import type { DesktopApiContract } from '@lime-novel/application'

declare global {
  interface Window {
    limeNovel: DesktopApiContract
  }
}

export {}

