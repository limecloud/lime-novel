import { build } from 'esbuild'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const rootDir = resolve(import.meta.dirname, '..')
const workDir = await mkdtemp(join(tmpdir(), 'lime-novel-runtime-smoke-'))
const entryPath = join(workDir, 'runtime-smoke-entry.ts')
const bundlePath = join(workDir, 'runtime-smoke-entry.mjs')

const smokeSource = String.raw`
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLocalAgentRuntime } from '@lime-novel/agent-runtime'
import { createFileSystemNovelRepository, createNovelProjectWorkspace } from '@lime-novel/infrastructure'

const baseDir = process.env.LIME_NOVEL_RUNTIME_SMOKE_PROJECTS_DIR
if (!baseDir) {
  throw new Error('LIME_NOVEL_RUNTIME_SMOKE_PROJECTS_DIR 未设置。')
}
await mkdir(baseDir, { recursive: true })

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message)
  }
}

const assertRejects = async (action: () => Promise<unknown>, message: string): Promise<void> => {
  let rejected = false

  try {
    await action()
  } catch {
    rejected = true
  }

  assert(rejected, message)
}

const waitFor = async (
  predicate: () => Promise<boolean> | boolean,
  message: string,
  timeoutMs = 6000
): Promise<void> => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error(message)
}

const findLatestProposal = async (repository: ReturnType<typeof createFileSystemNovelRepository>) => {
  const shell = await repository.loadWorkspaceShell()
  return shell.agentFeed.find((item) => item.kind === 'proposal' && item.proposalId)
}

const project = await createNovelProjectWorkspace(baseDir, {
  title: '运行时闭环测试',
  genre: '悬疑',
  premise: '主角在雨夜发现钟楼钥匙会回应谎言。',
  template: 'mystery'
})
let repository = createFileSystemNovelRepository(project.workspacePath)
const runtime = createLocalAgentRuntime(
  () => repository,
  () => ({
    provider: 'legacy',
    baseUrl: '',
    model: '',
    maxSteps: 6,
    maxToolConcurrency: 4,
    maxStructuredOutputRetries: 5,
    requestTimeoutMs: 90000,
    temperature: 0.2
  })
)

const shell = await repository.loadWorkspaceShell()
assert(shell.chapterTree.length > 0, '项目应创建至少一个章节。')
assert(shell.exportPresets.length > 0, '项目应创建导出预设。')
const chapterId = shell.project.currentChapterId

const chapterBefore = await repository.loadChapterDocument(chapterId)
await repository.saveChapterDocument({
  chapterId,
  content: chapterBefore.content.trim() + '\n\n雨声停住时，钥匙自己转了半圈。'
})
const savedChapter = await repository.loadChapterDocument(chapterId)
assert(savedChapter.content.includes('钥匙自己转了半圈'), '章节保存应真实写回正文文件。')

await runtime.startTask({
  surface: 'writing',
  intent: '请基于当前章节目标继续写下一段。',
  chapterId
})
await waitFor(async () => Boolean(await findLatestProposal(repository)), '写作代理应生成可应用提议。')

const proposal = await findLatestProposal(repository)
assert(proposal?.proposalId, '写作提议应带 proposalId。')
await repository.applyProposal(proposal.proposalId)
const chapterAfterProposal = await repository.loadChapterDocument(chapterId)
assert(chapterAfterProposal.content !== savedChapter.content, '应用提议后正文应发生变化。')

await runtime.startTask({
  surface: 'canon',
  intent: '请把当前章节新增的角色、物件和规则提炼成候选设定卡，并标出证据。',
  chapterId
})
await waitFor(async () => {
  const nextShell = await repository.loadWorkspaceShell()
  return nextShell.canonCandidates.length > 0
}, '设定代理应写入候选设定卡。')

await runtime.startTask({
  surface: 'revision',
  intent: '请检查本章是否出现连续性、视角或节奏问题，并把问题写回修订队列。',
  chapterId
})
await waitFor(async () => {
  const nextShell = await repository.loadWorkspaceShell()
  return nextShell.revisionIssues.length > 0
}, '修订代理应写入问题队列。')

const harnessBaseline = await repository.loadWorkspaceShell()

await runtime.startTask({
  surface: 'revision',
  intent: '请生成本章小说体检报告，重点检查黄金三章、伏笔链和人物弧光，并写入 Harness 产物。',
  chapterId
})
await waitFor(async () => {
  const nextShell = await repository.loadWorkspaceShell()
  return nextShell.diagnosticReports.length > harnessBaseline.diagnosticReports.length
}, 'Harness 应生成并持久化小说体检报告。')

await runtime.startTask({
  surface: 'revision',
  intent: '请模拟如果把钟楼钥匙的危险感提前到第一章，会影响哪些章节、人物状态和伏笔，生成冲击波分析。',
  chapterId
})
await waitFor(async () => {
  const nextShell = await repository.loadWorkspaceShell()
  return nextShell.impactAnalyses.length > harnessBaseline.impactAnalyses.length
}, 'Harness 应生成并持久化冲击波分析。')

await runtime.startTask({
  surface: 'revision',
  intent: '请把“让女主更早显露危险感但不破坏后续反转”拆成 A/B/C 候选方案，等待作者选择。',
  chapterId
})
await waitFor(async () => {
  const nextShell = await repository.loadWorkspaceShell()
  return nextShell.intentPlans.length > harnessBaseline.intentPlans.length
}, 'Harness 应生成并持久化 A/B/C 意图方案。')

await runtime.startTask({
  surface: 'revision',
  intent: '读者反馈：评论吐槽节奏慢、钟楼钥匙像无用伏笔，请映射到章节、伏笔和读者预期风险。',
  chapterId
})
await waitFor(async () => {
  const nextShell = await repository.loadWorkspaceShell()
  return nextShell.readerFeedback.length > harnessBaseline.readerFeedback.length
}, 'Harness 应生成并持久化读者反馈映射。')

await runtime.startTask({
  surface: 'revision',
  intent: '发布后不要回改已发布章节，请做未来章节回潮和时间线迭代计划。',
  chapterId
})
await waitFor(async () => {
  const nextShell = await repository.loadWorkspaceShell()
  return nextShell.timelineIterations.length > harnessBaseline.timelineIterations.length
}, 'Harness 应生成并持久化时间线迭代计划。')

const answer = await repository.generateKnowledgeAnswer({
  question: '钟楼钥匙目前承担什么叙事作用？',
  format: 'brief'
})
assert(existsSync(answer.outputPath), '知识问答应写入 outputs 文件。')

const sourcePath = join(baseDir, 'knowledge-source.md')
await writeFile(sourcePath, '# 钟楼研究笔记\n\n钟楼钥匙只会在角色说谎时发热。', 'utf8')
const importedKnowledge = await repository.importKnowledgeDocument({
  filePath: sourcePath
})
assert(existsSync(importedKnowledge.outputPath), '知识资料导入应写入 raw/research 文件。')
assert(importedKnowledge.relativePath.startsWith('raw/research/'), '知识资料导入应归入 raw/research。')

const exportResult = await repository.createExportPackage({
  presetId: shell.exportPresets[0].presetId,
  synopsis: '主角在雨夜发现钟楼钥匙会回应谎言，并被迫追查失踪者与城市沉默之间的关系。',
  splitChapters: 3,
  versionTag: 'v0.1.1',
  notes: '运行时闭环测试导出。'
})
assert(existsSync(exportResult.manifestPath), '导出应生成 manifest。')
const manifest = JSON.parse(await readFile(exportResult.manifestPath, 'utf8')) as { files: string[]; harnessLockId?: string }
assert(manifest.files.every((filePath) => existsSync(filePath)), 'manifest 中列出的导出文件都应存在。')
assert(manifest.harnessLockId, '导出 manifest 应记录 Harness Lock ID。')

const shellAfterPublish = await repository.loadWorkspaceShell()
assert(shellAfterPublish.project.lifecycleMode === 'timeline', '发布确认后项目应切换到 timeline 模式。')
assert(shellAfterPublish.harnessLocks.length > 0, '发布确认应创建 Harness Lock。')
assert(shellAfterPublish.project.publishedChapterRefs.includes(chapterId), '当前章节应进入已发布只读边界。')
assert(
  shellAfterPublish.harnessLocks[0].lockedChapterRefs.includes(chapterId),
  'Harness Lock 应记录当前章节为只读章节。'
)
await assertRejects(
  () =>
    repository.saveChapterDocument({
      chapterId,
      content: chapterAfterProposal.content + '\n\n这行不应该写入已发布章节。'
    }),
  'timeline 模式下已发布章节保存应被拦截。'
)

const epubPreset = shell.exportPresets.find((preset) => preset.format === 'epub')
assert(epubPreset, '项目应提供 EPUB 导出预设。')
const epubExportResult = await repository.createExportPackage({
  presetId: epubPreset.presetId,
  synopsis: '主角在雨夜发现钟楼钥匙会回应谎言，并被迫追查失踪者与城市沉默之间的关系。',
  splitChapters: 3,
  versionTag: 'v0.1.2',
  notes: '运行时闭环测试 EPUB 导出。'
})
const epubManifest = JSON.parse(await readFile(epubExportResult.manifestPath, 'utf8')) as { preset: { format: string }; files: string[] }
assert(epubManifest.preset.format === 'epub', 'EPUB 预设应写入 manifest 格式。')
assert(epubManifest.files.some((filePath) => filePath.endsWith('manuscript.epub')), 'EPUB 导出应生成 manuscript.epub。')
assert(epubManifest.files.every((filePath) => existsSync(filePath)), 'EPUB manifest 中列出的导出文件都应存在。')

const finalShell = await repository.loadWorkspaceShell()
assert(finalShell.agentTasks.some((task) => task.status === 'completed' || task.status === 'waiting_approval'), 'Agent 任务应持久化终态。')
assert(finalShell.agentFeed.some((item) => item.kind === 'proposal'), 'Agent feed 应持久化提议卡。')
assert(finalShell.diagnosticReports.length > 0, '最终 shell 应包含小说体检报告。')
assert(finalShell.impactAnalyses.length > 0, '最终 shell 应包含冲击波分析。')
assert(finalShell.intentPlans.length > 0, '最终 shell 应包含 A/B/C 意图方案。')
assert(finalShell.readerFeedback.length > 0, '最终 shell 应包含读者反馈映射。')
assert(finalShell.timelineIterations.length > 0, '最终 shell 应包含时间线迭代计划。')
assert(finalShell.harnessLocks.length > 0, '最终 shell 应包含 Harness Lock。')
assert(
  existsSync(join(project.workspacePath, 'compiled/reports/diagnostic', finalShell.diagnosticReports[0].reportId + '.json')),
  '小说体检报告应写入 compiled/reports/diagnostic。'
)
assert(
  existsSync(join(project.workspacePath, 'compiled/reports/impact', finalShell.impactAnalyses[0].impactId + '.json')),
  '冲击波分析应写入 compiled/reports/impact。'
)
assert(
  existsSync(join(project.workspacePath, 'revisions/harness/intent-plans', finalShell.intentPlans[0].planId + '.json')),
  'A/B/C 意图方案应写入 revisions/harness/intent-plans。'
)
assert(
  existsSync(join(project.workspacePath, 'compiled/reports/reader-feedback', finalShell.readerFeedback[0].feedbackId + '.json')),
  '读者反馈映射应写入 compiled/reports/reader-feedback。'
)
assert(
  existsSync(join(project.workspacePath, 'revisions/harness/timeline-iterations', finalShell.timelineIterations[0].iterationId + '.json')),
  '时间线迭代计划应写入 revisions/harness/timeline-iterations。'
)
assert(
  finalShell.agentFeed.every((item) => ['status', 'evidence', 'proposal', 'issue', 'approval'].includes(item.kind)),
  'Agent feed 只能使用 Agent Novel 标准 kind。'
)
const diagnosticsAfterRun = await runtime.loadTaskDiagnostics()
assert(diagnosticsAfterRun.length > 0, 'Agent 诊断应在运行后可读取。')

repository = createFileSystemNovelRepository(project.workspacePath)
const restoredRuntime = createLocalAgentRuntime(
  () => repository,
  () => ({
    provider: 'legacy',
    baseUrl: '',
    model: '',
    maxSteps: 6,
    maxToolConcurrency: 4,
    maxStructuredOutputRetries: 5,
    requestTimeoutMs: 90000,
    temperature: 0.2
  })
)
const restoredDiagnostics = await restoredRuntime.loadTaskDiagnostics()
assert(restoredDiagnostics.length > 0, 'Agent 诊断应持久化到项目数据库并可被新 runtime 读取。')

console.log('Runtime smoke passed: project, chapter, agent, knowledge and export flows are functional.')
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

  process.env.LIME_NOVEL_RUNTIME_SMOKE_PROJECTS_DIR = join(workDir, 'projects')
  await import(pathToFileURL(bundlePath).href)
} finally {
  if (existsSync(workDir)) {
    await rm(workDir, { recursive: true, force: true })
  }
}
