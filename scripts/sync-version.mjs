import { access, readFile, writeFile, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const nextVersion = process.argv[2]?.trim()

if (!nextVersion || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(nextVersion)) {
  console.error('请传入合法版本号，例如 0.2.0 或 0.2.0-beta.1')
  process.exit(1)
}

const packageFiles = [join(rootDir, 'package.json')]

const appendWorkspacePackages = async (workspaceRoot) => {
  const absoluteRoot = join(rootDir, workspaceRoot)
  const entries = await readdir(absoluteRoot, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const packageFile = join(absoluteRoot, entry.name, 'package.json')

    try {
      await access(packageFile, constants.F_OK)
      packageFiles.push(packageFile)
    } catch {
      // 跳过没有 package.json 的目录
    }
  }
}

await appendWorkspacePackages('apps')
await appendWorkspacePackages('packages')

for (const packageFile of packageFiles) {
  const content = await readFile(packageFile, 'utf8')
  const json = JSON.parse(content)
  json.version = nextVersion
  await writeFile(packageFile, `${JSON.stringify(json, null, 2)}\n`, 'utf8')
  console.log(`已更新 ${packageFile} -> ${nextVersion}`)
}
