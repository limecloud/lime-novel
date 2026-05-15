import { loadRuntimeChapterDocument } from './agent-runtime-repository'
import {
  expectObject,
  objectSchema,
  readRequiredString,
  readOptionalString,
  stringSchema
} from './live-agent-tool-schema'
import type { AgentTool, AgentToolContext } from './live-agent-types'

const MAX_CONTENT_CHARS = 12000

const truncate = (value: string, maxLength = MAX_CONTENT_CHARS): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n...[已截断]`

const readOptionalNumber = (
  value: Record<string, unknown>,
  key: string
): number | undefined => {
  const field = value[key]

  if (field == null || field === '') {
    return undefined
  }

  if (typeof field !== 'number' || !Number.isFinite(field)) {
    throw new Error(`${key} 必须是数字。`)
  }

  return field
}

const buildWorkspaceSnapshot = (context: AgentToolContext) => {
  const { shell } = context
  const currentChapter = shell.chapterTree.find(
    (chapter) => chapter.chapterId === shell.project.currentChapterId
  )
  const currentSample = shell.analysisSamples[0]
  const currentIssue = shell.revisionIssues[0]

  return {
    project: {
      projectId: shell.project.projectId,
      title: shell.project.title,
      subtitle: shell.project.subtitle,
      genre: shell.project.genre,
      premise: shell.project.premise,
      status: shell.project.status,
      releaseVersion: shell.project.releaseVersion,
      currentSurface: shell.project.currentSurface,
      currentFeatureTool: shell.project.currentFeatureTool,
      currentChapterId: shell.project.currentChapterId
    },
    currentChapter:
      currentChapter != null
        ? {
            chapterId: currentChapter.chapterId,
            order: currentChapter.order,
            title: currentChapter.title,
            summary: currentChapter.summary,
            status: currentChapter.status,
            wordCount: currentChapter.wordCount
          }
        : null,
    sceneList: shell.sceneList.slice(0, 6).map((scene) => ({
      sceneId: scene.sceneId,
      order: scene.order,
      title: scene.title,
      goal: scene.goal,
      status: scene.status
    })),
    chapterTree: shell.chapterTree.slice(0, 10).map((chapter) => ({
      chapterId: chapter.chapterId,
      order: chapter.order,
      title: chapter.title,
      summary: chapter.summary,
      status: chapter.status,
      wordCount: chapter.wordCount
    })),
    analysisOverview: shell.analysisOverview,
    analysisSamples: shell.analysisSamples.slice(0, 6).map((sample) => ({
      sampleId: sample.sampleId,
      title: sample.title,
      author: sample.author,
      sourceLabel: sample.sourceLabel,
      synopsis: sample.synopsis,
      excerpt: sample.excerpt.slice(0, 2),
      tags: sample.tags,
      hookSummary: sample.hookSummary,
      characterSummary: sample.characterSummary,
      pacingSummary: sample.pacingSummary
    })),
    firstAnalysisSample:
      currentSample != null
        ? {
            sampleId: currentSample.sampleId,
            title: currentSample.title,
            inspirationSignals: currentSample.inspirationSignals,
            riskSignals: currentSample.riskSignals
          }
        : null,
    canonCandidates: shell.canonCandidates.slice(0, 8).map((card) => ({
      cardId: card.cardId,
      name: card.name,
      kind: card.kind,
      summary: card.summary,
      visibility: card.visibility
    })),
    revisionIssues: shell.revisionIssues.slice(0, 8).map((issue) => ({
      issueId: issue.issueId,
      chapterId: issue.chapterId,
      title: issue.title,
      summary: issue.summary,
      severity: issue.severity,
      status: issue.status
    })),
    firstRevisionIssue:
      currentIssue != null
        ? {
            issueId: currentIssue.issueId,
            title: currentIssue.title,
            summary: currentIssue.summary,
            severity: currentIssue.severity
          }
        : null,
    exportPresets: shell.exportPresets.map((preset) => ({
      presetId: preset.presetId,
      title: preset.title,
      format: preset.format,
      status: preset.status,
      summary: preset.summary
    })),
    recentExports: shell.recentExports.slice(0, 3).map((item) => ({
      exportId: item.exportId,
      versionTag: item.versionTag,
      generatedAt: item.generatedAt,
      format: item.format,
      synopsis: item.synopsis,
      splitChapters: item.splitChapters,
      notes: item.notes
    })),
    quickActions: shell.quickActions.slice(0, 6).map((action) => ({
      label: action.label,
      prompt: action.prompt
    })),
    recentFeed: shell.agentFeed.slice(0, 6).map((item) => ({
      kind: item.kind,
      title: item.title,
      body: item.body,
      supportingLabel: item.supportingLabel
    }))
  }
}

export const createLiveWorkspaceTools = (
  context: AgentToolContext
)=>
  [
  {
    name: 'load_workspace_snapshot',
    description:
      '读取当前项目的紧凑快照，包括项目摘要、章节树、样本、设定、修订与导出状态。',
    inputSchema: objectSchema({}),
    parse: () => ({}),
    execute: async () => buildWorkspaceSnapshot(context),
    isConcurrencySafe: () => true,
    getProgressLabel: () => '读取工作区快照'
  },
  {
    name: 'load_chapter_document',
    description: '读取指定章节或当前章节的正文文档，适合写作、修订与设定提取任务。',
    inputSchema: objectSchema({
      chapterId: stringSchema('可选。目标章节 ID，不传时默认读取当前章节。')
    }),
    parse: (input) => {
      const value = expectObject(input, 'load_chapter_document')
      return {
        chapterId: readOptionalString(value, 'chapterId')
      }
    },
    execute: async (input: { chapterId?: string }) => {
      const { chapter } = await loadRuntimeChapterDocument({
        repository: context.repository,
        currentChapterId: context.shell.project.currentChapterId,
        chapterId: input.chapterId ?? context.input.chapterId
      })

      return {
        ...chapter,
        content: truncate(chapter.content)
      }
    },
    isConcurrencySafe: () => true,
    getProgressLabel: (input: { chapterId?: string }) =>
      input.chapterId ? `读取章节 ${input.chapterId}` : '读取当前章节正文'
  },
  {
    name: 'search_workspace',
    description: '检索当前工作区里的项目、章节、正文、设定、修订、导出与知识资产。',
    inputSchema: objectSchema(
      {
        query: stringSchema('搜索关键词或问题。'),
        limit: {
          type: 'number',
          description: '可选。返回条数，默认 8，最大 20。'
        }
      },
      ['query']
    ),
    parse: (input) => {
      const value = expectObject(input, 'search_workspace')
      return {
        query: readRequiredString(value, 'query'),
        limit: readOptionalNumber(value, 'limit')
      }
    },
    execute: async (input: { query: string; limit?: number }) => {
      const result = await context.repository.searchWorkspace({
        query: input.query,
        limit: Math.min(Math.max(Math.floor(input.limit ?? 8), 1), 20)
      })

      return {
        query: result.query,
        items: result.items.map((item) => ({
          kind: item.kind,
          title: item.title,
          snippet: item.snippet,
          surface: item.surface,
          featureTool: item.featureTool,
          chapterId: item.chapterId,
          entityId: item.entityId,
          score: item.score
        }))
      }
    },
    isConcurrencySafe: () => true,
    getProgressLabel: (input: { query: string }) => `检索：${input.query}`
  },
  {
    name: 'load_knowledge_document',
    description: '读取一份知识页、设定卡或查询输出的完整内容。relativePath 来自工作区快照或 search_workspace 结果的 entityId。',
    inputSchema: objectSchema(
      {
        relativePath: stringSchema('知识文档相对路径。')
      },
      ['relativePath']
    ),
    parse: (input) => {
      const value = expectObject(input, 'load_knowledge_document')
      return {
        relativePath: readRequiredString(value, 'relativePath')
      }
    },
    execute: async (input: { relativePath: string }) => {
      const document = await context.repository.loadKnowledgeDocument(input.relativePath)

      return {
        ...document,
        content: truncate(document.content)
      }
    },
    isConcurrencySafe: () => true,
    getProgressLabel: (input: { relativePath: string }) => `读取知识页：${input.relativePath}`
  },
  {
    name: 'generate_knowledge_answer',
    description: '基于当前项目知识库生成一份报告或简报，并写入 outputs 目录。',
    inputSchema: objectSchema(
      {
        question: stringSchema('要回答并写入知识库的问题。'),
        format: stringSchema('report 或 brief。', ['report', 'brief'])
      },
      ['question', 'format']
    ),
    parse: (input) => {
      const value = expectObject(input, 'generate_knowledge_answer')
      return {
        question: readRequiredString(value, 'question'),
        format: readRequiredString(value, 'format') as 'report' | 'brief'
      }
    },
    execute: async (input: { question: string; format: 'report' | 'brief' }) =>
      context.repository.generateKnowledgeAnswer(input),
    isConcurrencySafe: () => false,
    getProgressLabel: (input: { question: string }) => `生成知识问答：${input.question}`
  }
] as AgentTool<unknown, unknown>[]
