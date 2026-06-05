#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

const read = (path) => readFile(resolve(root, path), 'utf8')

const requiredWritingAgentCommands = [
  'sync-story-state',
  'update-character-line',
  'check-foreshadowing',
  'analyze-revision-impact',
  'check-platform-risk',
  'import-reader-feedback'
]

const requiredCompatCommands = [
  'toggle-skill',
  'update-platform-risk',
  'undo-change-set',
  'undo-derived-state'
]

const failures = []

const requireIncludes = (content, needle, label) => {
  if (!content.includes(needle)) {
    failures.push(`${label}: missing ${needle}`)
  }
}

const app = await read('apps/desktop/src/renderer/src/app/App.tsx')
const adapter = await read('apps/desktop/src/main/app-server/app-server-client-adapter.ts')
const appServerRuntime = await read('apps/desktop/src/main/app-server/lime-app-server-runtime.ts')
const appServerBackend = await read('apps/desktop/src/main/app-server/lime-novel-agent-backend.mjs')
const composition = await read('apps/desktop/src/main/composition-root/create-desktop-services.ts')
const rendererHtml = await read('apps/desktop/src/renderer/index.html')
const appCss = await read('apps/desktop/src/renderer/src/app/app.css')
const appServerRuntimeSmoke = await read('scripts/app-server-runtime-smoke.mjs')
const runtimeSmoke = await read('scripts/runtime-smoke.mjs')
const infrastructure = await read('packages/infrastructure/src/index.ts')

for (const command of requiredWritingAgentCommands) {
  requireIncludes(app, `'${command}'`, `writing command ${command}`)
}

for (const command of requiredCompatCommands) {
  requireIncludes(app, `'${command}'`, `compat command ${command}`)
}

requireIncludes(app, 'writingAgentHarnessCommands', 'renderer live command routing')
requireIncludes(app, 'localCompatHarnessCommands', 'renderer compat command routing')
requireIncludes(app, 'buildWritingAgentTaskInput', 'renderer live task input')
requireIncludes(app, 'desktopApi.agent.startTask', 'renderer current startTask')
requireIncludes(composition, 'createLimeAppServerRuntime', 'desktop composition root')
requireIncludes(composition, 'toAgentRuntimeEnv(await agentRuntimeSettingsStore.load())', 'saved runtime settings must feed app server runtime')
requireIncludes(adapter, "current: 'lime-app-server'", 'app server metadata current')
requireIncludes(adapter, 'requiresLive: true', 'app server metadata live guard')
requireIncludes(appServerRuntime, "'--backend'", 'app server runtime backend mode')
requireIncludes(appServerRuntime, "'external'", 'app server runtime external backend')
requireIncludes(appServerRuntime, 'LIME_APP_SERVER_BIN', 'app server binary config')
requireIncludes(appServerRuntime, 'resolveAppServerBinaryPath', 'app server binary auto discovery')
requireIncludes(appServerRuntime, "'evidence/export'", 'app server runtime evidence export')
requireIncludes(appServerRuntime, 'waitForTerminal', 'app server runtime waits for terminal event')
requireIncludes(appServerRuntime, 'upsertExportedEvidencePack', 'app server evidence pack projection')
requireIncludes(appServerRuntime, 'upsertExportedArtifact', 'app server artifact summary projection')
requireIncludes(appServerBackend, "provider === 'legacy'", 'app server backend legacy guard')
requireIncludes(appServerBackend, 'LIME_NOVEL_AGENT_BASE_URL', 'app server backend local gateway support')
requireIncludes(rendererHtml, 'href="./logo-lime-192.png"', 'renderer packaged logo href')
requireIncludes(rendererHtml, 'src="./logo-lime-192.png"', 'renderer packaged logo src')
requireIncludes(appCss, '.novel-shell', 'renderer drag shell')
requireIncludes(appCss, '-webkit-app-region: drag', 'renderer window drag region')
requireIncludes(appCss, '.workspace-stage button', 'renderer controls no-drag region')
requireIncludes(appServerRuntimeSmoke, 'event-log', 'app server smoke evidence export event log')
requireIncludes(appServerRuntimeSmoke, 'successful-external-backend.mjs', 'app server smoke successful external backend')
requireIncludes(appServerRuntimeSmoke, 'app-server:event-log:', 'app server smoke event log assertion')
requireIncludes(infrastructure, 'recordChapterSavedEvent', 'chapter saved event source')
requireIncludes(infrastructure, "kind: 'chapter-saved'", 'chapter saved event kind')
requireIncludes(infrastructure, 'createStoryContextBundle', 'story context bundle builder')
requireIncludes(infrastructure, "kind: 'character' as const", 'context bundle character source')
requireIncludes(infrastructure, "kind: 'canon' as const", 'context bundle canon source')
requireIncludes(infrastructure, 'buildHarnessProjections', 'renderer projection builder')
requireIncludes(infrastructure, 'loadOpenBlockingPlatformRisks', 'publish risk export gate')
requireIncludes(infrastructure, '仍有 ${openBlockingPlatformRisks.length} 个开放高风险发布风险', 'publish risk blocking message')
requireIncludes(app, 'import-reader-feedback', 'reader feedback author entry')
requireIncludes(app, 'toggle-skill', 'skill toggle author entry')
requireIncludes(app, 'update-platform-risk', 'platform risk resolution entry')
requireIncludes(runtimeSmoke, "event.kind === 'chapter-saved'", 'runtime smoke chapter saved assertion')
requireIncludes(runtimeSmoke, "projection.kind === 'story-state'", 'runtime smoke story projection assertion')
requireIncludes(runtimeSmoke, "command: 'import-reader-feedback'", 'runtime smoke reader feedback command')
requireIncludes(runtimeSmoke, "command: 'toggle-skill'", 'runtime smoke skill toggle command')
requireIncludes(runtimeSmoke, "command: 'check-platform-risk'", 'runtime smoke platform risk command')
requireIncludes(runtimeSmoke, '开放高风险发布风险应阻断导出', 'runtime smoke publish blocking assertion')

if (appServerRuntime.includes("'mock'") || appServerRuntime.includes('"mock"')) {
  failures.push('app server runtime must not start mock backend')
}

if (appServerBackend.includes("emitEvent('turn.completed'") && !appServerBackend.includes('completeOpenAICompatible')) {
  failures.push('app server backend completion must come from live provider path')
}

if (adapter.includes("mode: 'compat'") || adapter.includes('current: false')) {
  failures.push('app server metadata must not mark current startTask as compat')
}

if (/onRunHarnessCommand=\{\(input\) => \{\s*runHarnessCommandMutation\.mutate\(input\)/s.test(app)) {
  failures.push('NovelWorkbench onRunHarnessCommand must not directly call runHarnessCommandMutation')
}

if (failures.length > 0) {
  console.error('Legacy governance report failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Legacy governance report passed:')
console.log('- current: writing AI commands route through agent.startTask / Lime App Server external backend')
console.log('- compat: harness.runCommand remains available for local skill/status/undo commands')
console.log('- deprecated: direct renderer AI generation via harness.runCommand is guarded')
