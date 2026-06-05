import { build } from 'esbuild'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const rootDir = resolve(import.meta.dirname, '..')
const workDir = await mkdtemp(join(tmpdir(), 'lime-novel-app-server-runtime-smoke-'))
const entryPath = join(workDir, 'app-server-runtime-smoke-entry.ts')
const bundlePath = join(workDir, 'app-server-runtime-smoke-entry.mjs')

const smokeSource = String.raw`
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createFileSystemNovelRepository, createNovelProjectWorkspace } from '@lime-novel/infrastructure'
import { createLimeAppServerRuntime, resolveAppServerRuntimeConfig } from '${rootDir}/apps/desktop/src/main/app-server/lime-app-server-runtime.ts'

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message)
  }
}

const waitFor = async (
  predicate: () => Promise<boolean> | boolean,
  message: string,
  timeoutMs = 12000
): Promise<void> => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(message)
}

const waitForShell = async (
  loadShell: () => Promise<unknown>,
  predicate: (shell: any) => boolean,
  message: string,
  timeoutMs = 12000
): Promise<void> => {
  let lastShell: any
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    lastShell = await loadShell()

    if (predicate(lastShell)) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const summary = {
    tasks: lastShell?.agentTasks,
    feed: lastShell?.agentFeed,
    artifacts: lastShell?.harnessArtifacts,
    evidence: lastShell?.harnessEvidence
  }
  throw new Error(message + '\\n' + JSON.stringify(summary, null, 2))
}

const baseDir = process.env.LIME_NOVEL_APP_SERVER_RUNTIME_SMOKE_PROJECTS_DIR
if (!baseDir) {
  throw new Error('LIME_NOVEL_APP_SERVER_RUNTIME_SMOKE_PROJECTS_DIR 未设置。')
}
await mkdir(baseDir, { recursive: true })

const guardedEnv = {
  ...process.env,
  LIME_NOVEL_AGENT_PROVIDER: 'anthropic',
  LIME_NOVEL_AGENT_API_KEY: '',
  LIME_NOVEL_AGENT_MODEL: '',
  LIME_APP_SERVER_BACKEND_COMMAND: process.execPath,
  LIME_APP_SERVER_BACKEND_ARGS_JSON: JSON.stringify(['${rootDir}/apps/desktop/src/main/app-server/lime-novel-agent-backend.mjs'])
}
const runtimeConfig = resolveAppServerRuntimeConfig(guardedEnv)
assert(runtimeConfig.binaryPath.endsWith(process.platform === 'win32' ? 'app-server.exe' : 'app-server'), '应解析到真实 App Server sidecar binary。')
assert(!runtimeConfig.usesBuiltInBackend, '显式 backend command 应作为 external backend 启动。')

const guardedProject = await createNovelProjectWorkspace(join(baseDir, 'guarded'), {
  title: 'App Server Runtime Smoke',
  genre: '悬疑',
  premise: '主角在雨夜发现钟楼钥匙会回应谎言。',
  template: 'mystery'
})
let repository = createFileSystemNovelRepository(guardedProject.workspacePath)
const shell = await repository.loadWorkspaceShell()
const runtime = createLimeAppServerRuntime(() => repository, () => guardedEnv)

const result = await runtime.startTask({
  surface: 'writing',
  chapterId: shell.project.currentChapterId,
  intent: '请通过真实 App Server 检查当前章节。',
  runtimeOptions: {
    metadata: {
      requiresLive: true,
      sourceCommand: 'app-server-runtime-smoke'
    }
  }
})

await waitForShell(
  () => repository.loadWorkspaceShell(),
  (nextShell) => (
    nextShell.agentTasks.some((task) => task.taskId === result.task.taskId && task.status === 'failed') &&
    nextShell.harnessEvidence.some((evidence) => evidence.locator?.startsWith('app-server:event-log:'))
  ),
  '缺少真实模型配置时，App Server task 应失败并同步 evidence/export，而不是 mock 成功。'
)

const finalShell = await repository.loadWorkspaceShell()
assert(finalShell.agentFeed.some((item) => item.taskId === result.task.taskId && item.kind === 'issue'), '失败事件应进入 Agent feed。')
assert(finalShell.harnessArtifacts.some((artifact) => artifact.taskId === result.task.taskId), 'App Server 事件应投影为 Harness artifact。')
assert(finalShell.harnessEvidence.some((evidence) => evidence.locator?.startsWith('app-server:event-log:')), '失败 turn 应通过 evidence/export 同步 App Server event log。')
const diagnostics = await runtime.loadTaskDiagnostics()
assert(diagnostics.some((item) => item.taskId === result.task.taskId), 'App Server 事件应写入诊断。')

await runtime.dispose()

const backendPath = join(baseDir, 'successful-external-backend.mjs')
await writeFile(
  backendPath,
  [
    '#!/usr/bin/env node',
    "import { readFileSync } from 'node:fs';",
    '',
    "const input = JSON.parse(readFileSync(0, 'utf8'));",
    "const text = input.request.input?.text ?? '';",
    '',
    "if (input.kind === 'turnStart') {",
    '  console.log(JSON.stringify({',
    '    events: [',
    '      {',
    "        type: 'message.delta',",
    '        payload: {',
    "          text: '真实 App Server external backend 已处理：' + text,",
    "          backend: 'external'",
    '        }',
    '      },',
    '      {',
    "        type: 'artifact.snapshot',",
    '        payload: {',
    "          artifactId: 'lime-novel-runtime-smoke-artifact',",
    "          artifactRef: 'lime-novel-runtime-smoke-artifact',",
    "          title: 'Lime Novel Runtime Smoke Artifact',",
    "          kind: 'sync-summary',",
    "          status: 'ready',",
    "          path: '.app-server/artifacts/lime-novel-runtime-smoke.md',",
    "          content: '# Lime Novel Runtime Smoke\\n\\n' + text",
    '        }',
    '      }',
    '    ]',
    '  }));',
    '  process.exit(0);',
    '}',
    '',
    'console.log(JSON.stringify({ events: [] }));',
    ''
  ].join('\n'),
  'utf8'
)

const liveEnv = {
  ...process.env,
  LIME_NOVEL_AGENT_PROVIDER: 'openai-compatible',
  LIME_NOVEL_AGENT_API_KEY: '',
  LIME_NOVEL_AGENT_BASE_URL: 'http://127.0.0.1:65535/v1',
  LIME_NOVEL_AGENT_MODEL: 'runtime-smoke',
  LIME_APP_SERVER_BACKEND_COMMAND: process.execPath,
  LIME_APP_SERVER_BACKEND_ARGS_JSON: JSON.stringify([backendPath])
}
const liveProject = await createNovelProjectWorkspace(join(baseDir, 'live'), {
  title: 'App Server Runtime Smoke Live',
  genre: '奇幻',
  premise: '主角用真实代理核对章节状态。',
  template: 'fantasy'
})
repository = createFileSystemNovelRepository(liveProject.workspacePath)
const liveShell = await repository.loadWorkspaceShell()
const liveRuntime = createLimeAppServerRuntime(() => repository, () => liveEnv)
const liveResult = await liveRuntime.startTask({
  surface: 'writing',
  chapterId: liveShell.project.currentChapterId,
  intent: '请生成真实 external backend smoke 产物。',
  runtimeOptions: {
    metadata: {
      requiresLive: true,
      sourceCommand: 'app-server-runtime-smoke-success'
    }
  }
})

await waitForShell(
  () => repository.loadWorkspaceShell(),
  (nextShell) => nextShell.agentTasks.some((task) => task.taskId === liveResult.task.taskId && task.status === 'completed'),
  '真实 App Server external backend 成功时，task 应完成。'
)

const liveFinalShell = await repository.loadWorkspaceShell()
assert(liveFinalShell.harnessArtifacts.some((artifact) => artifact.artifactId.includes('lime-novel-runtime-smoke-artifact')), '成功 turn 应同步 App Server artifact summary。')
assert(liveFinalShell.harnessEvidence.some((evidence) => evidence.locator?.startsWith('app-server:event-log:')), '成功 turn 应同步 App Server event log。')
assert(liveFinalShell.harnessArtifacts.some((artifact) => artifact.evidenceIds.some((id) => id.startsWith('app_server_event_log_'))), '导出的 artifact 应关联 App Server event log evidence。')
await liveRuntime.dispose()

console.log('App Server runtime smoke passed: sidecar discovery, live guard, successful external backend and evidence export are functional.')
`

try {
  await writeFile(entryPath, smokeSource, 'utf8')
  await build({
    entryPoints: [entryPath],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node23',
    sourcemap: false,
    logLevel: 'silent',
    absWorkingDir: rootDir,
    nodePaths: [join(rootDir, 'node_modules')],
    external: ['electron']
  })

  process.env.LIME_NOVEL_APP_SERVER_RUNTIME_SMOKE_PROJECTS_DIR = join(workDir, 'projects')
  await import(pathToFileURL(bundlePath).href)
} finally {
  if (existsSync(workDir)) {
    await rm(workDir, { recursive: true, force: true })
  }
}
