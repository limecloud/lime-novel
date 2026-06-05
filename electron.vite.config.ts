import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const rendererRoot = resolve('apps/desktop/src/renderer')
const appServerBackendSource = resolve('apps/desktop/src/main/app-server/lime-novel-agent-backend.mjs')
const appServerBackendOutput = resolve('out/main/app-server/lime-novel-agent-backend.mjs')

const copyAppServerBackendPlugin = () => ({
  name: 'copy-lime-app-server-backend',
  closeBundle: () => {
    mkdirSync(dirname(appServerBackendOutput), { recursive: true })
    copyFileSync(appServerBackendSource, appServerBackendOutput)
  }
})

const alias = {
  '@lime-novel/shared-kernel': resolve('packages/shared-kernel/src'),
  '@lime-novel/domain-novel': resolve('packages/domain-novel/src'),
  '@lime-novel/application': resolve('packages/application/src'),
  '@lime-novel/agent-runtime': resolve('packages/agent-runtime/src'),
  '@lime-novel/infrastructure': resolve('packages/infrastructure/src'),
  '@renderer': resolve('apps/desktop/src/renderer/src')
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyAppServerBackendPlugin()],
    resolve: {
      alias
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('apps/desktop/src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('apps/desktop/src/preload/index.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    root: rendererRoot,
    plugins: [react()],
    resolve: {
      alias
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(rendererRoot, 'index.html')
        }
      }
    }
  }
})
