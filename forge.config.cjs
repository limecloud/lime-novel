const path = require('node:path')

const rootDir = __dirname
const keepCopiedPathPrefixes = ['/out']
const keepCopiedFiles = new Set(['/package.json'])

const normalizePackagerPath = (packagerPath) => {
  const relativePath =
    path.isAbsolute(packagerPath) && packagerPath.startsWith(rootDir)
      ? `/${path.relative(rootDir, packagerPath)}`
      : packagerPath
  const normalizedPath = relativePath.replaceAll(path.sep, '/')
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const shouldIgnorePackagerPath = (packagerPath) => {
  const normalizedPath = normalizePackagerPath(packagerPath)

  if (normalizedPath === '/') {
    return false
  }

  if (keepCopiedFiles.has(normalizedPath)) {
    return false
  }

  return !keepCopiedPathPrefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))
}

module.exports = {
  outDir: 'out-forge',
  packagerConfig: {
    name: 'Lime Novel',
    executableName: 'lime-novel',
    appBundleId: 'com.limecloud.limenovel',
    appCategoryType: 'public.app-category.productivity',
    icon: path.join(rootDir, 'build/icon'),
    prune: true,
    ignore: shouldIgnorePackagerPath,
    extraResource: [
      path.join(rootDir, 'build/app-update.yml'),
      path.join(rootDir, 'apps/desktop/src/renderer/public/logo-lime.png')
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'lime_novel',
        setupExe: 'lime-novel-setup-<%= version %>.exe',
        noMsi: true
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        format: 'ULFO'
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          name: 'lime-novel',
          productName: 'Lime Novel',
          genericName: 'Novel Workspace',
          categories: ['Office'],
          icon: path.join(rootDir, 'build/icon.png')
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          name: 'lime-novel',
          productName: 'Lime Novel',
          genericName: 'Novel Workspace',
          categories: ['Office'],
          icon: path.join(rootDir, 'build/icon.png')
        }
      }
    }
  ]
}
