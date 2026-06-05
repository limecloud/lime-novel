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
const composition = await read('apps/desktop/src/main/composition-root/create-desktop-services.ts')

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
requireIncludes(adapter, "current: 'lime-app-server'", 'app server metadata current')
requireIncludes(adapter, 'requiresLive: true', 'app server metadata live guard')
requireIncludes(appServerRuntime, "'--backend'", 'app server runtime backend mode')
requireIncludes(appServerRuntime, "'external'", 'app server runtime external backend')
requireIncludes(appServerRuntime, 'LIME_APP_SERVER_BIN', 'app server binary config')

if (appServerRuntime.includes("'mock'") || appServerRuntime.includes('"mock"')) {
  failures.push('app server runtime must not start mock backend')
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
