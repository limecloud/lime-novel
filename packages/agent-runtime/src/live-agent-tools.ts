import type { CanonCandidateDto, RevisionIssueDto } from '@lime-novel/application'
import { createId } from '@lime-novel/shared-kernel'
import type {
  AgentTool,
  AgentToolContext,
  ProviderToolDefinition,
  SubmittedTaskArtifact,
  SubmittedTaskResult,
  ToolJsonSchema
} from './live-agent-types'

const MAX_CONTENT_CHARS = 12000
export const SUBMIT_TASK_RESULT_TOOL_NAME = 'submit_task_result'

const truncate = (value: string, maxLength = MAX_CONTENT_CHARS): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n...[已截断]`

const expectObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象。`)
  }

  return value as Record<string, unknown>
}

const readRequiredString = (value: Record<string, unknown>, key: string): string => {
  const field = value[key]
  if (typeof field !== 'string' || !field.trim()) {
    throw new Error(`${key} 必须是非空字符串。`)
  }

  return field.trim()
}

const readOptionalString = (value: Record<string, unknown>, key: string): string | undefined => {
  const field = value[key]
  if (field == null || field === '') {
    return undefined
  }

  if (typeof field !== 'string') {
    throw new Error(`${key} 必须是字符串。`)
  }

  const normalized = field.trim()
  return normalized || undefined
}

const readOptionalSeverity = (
  value: Record<string, unknown>,
  key: string
): SubmittedTaskArtifact['severity'] => {
  const field = readOptionalString(value, key)
  if (!field) {
    return undefined
  }

  if (field !== 'low' && field !== 'medium' && field !== 'high') {
    throw new Error(`${key} 必须是 low、medium 或 high。`)
  }

  return field
}

const readOptionalObject = (value: Record<string, unknown>, key: string): Record<string, unknown> | undefined => {
  const field = value[key]

  if (field == null) {
    return undefined
  }

  return expectObject(field, key)
}

const readOptionalStringArray = (value: Record<string, unknown>, key: string): string[] | undefined => {
  const field = value[key]

  if (field == null) {
    return undefined
  }

  if (!Array.isArray(field)) {
    throw new Error(`${key} 必须是字符串数组。`)
  }

  return field.map((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new Error(`${key}[${index}] 必须是非空字符串。`)
    }

    return item.trim()
  })
}

const stringSchema = (description: string, values?: string[]): ToolJsonSchema => ({
  type: 'string',
  description,
  enum: values
})

const objectSchema = (
  properties: Record<string, ToolJsonSchema>,
  required: string[] = [],
  description?: string
): Extract<ToolJsonSchema, { type: 'object' }> => ({
  type: 'object',
  description,
  properties,
  required,
  additionalProperties: false
})

const buildWorkspaceSnapshot = (context: AgentToolContext) => {
  const { shell } = context
  const currentChapter = shell.chapterTree.find((chapter) => chapter.chapterId === shell.project.currentChapterId)
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

const parseSubmittedArtifact = (value: unknown): SubmittedTaskArtifact => {
  const input = expectObject(value, 'artifact')
  const kind = readRequiredString(input, 'kind')

  if (!['status', 'evidence', 'proposal', 'issue', 'approval'].includes(kind)) {
    throw new Error('artifact.kind 必须是 status、evidence、proposal、issue 或 approval。')
  }

  const template = readOptionalString(input, 'template')
  if (
    template &&
    !['publish-synopsis-draft', 'publish-notes-draft', 'publish-confirm-suggestion'].includes(template)
  ) {
    throw new Error('artifact.template 不是支持的模板。')
  }

  const diffPreviewInput = readOptionalObject(input, 'diffPreview')
  const diffPreview =
    diffPreviewInput != null
      ? {
          before: readRequiredString(diffPreviewInput, 'before'),
          after: readRequiredString(diffPreviewInput, 'after')
        }
      : undefined

  return {
    kind: kind as SubmittedTaskArtifact['kind'],
    title: readOptionalString(input, 'title'),
    body: readRequiredString(input, 'body'),
    supportingLabel: readOptionalString(input, 'supportingLabel'),
    severity: readOptionalSeverity(input, 'severity'),
    proposalId: readOptionalString(input, 'proposalId'),
    linkedIssueId: readOptionalString(input, 'linkedIssueId'),
    template: template as SubmittedTaskArtifact['template'],
    diffPreview
  }
}

export const createLiveAgentTools = (context: AgentToolContext) =>
  [
  {
    name: 'load_workspace_snapshot',
    description: '读取当前项目的紧凑快照，包括项目摘要、章节树、样本、设定、修订与导出状态。',
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
      const chapterId = input.chapterId ?? context.input.chapterId ?? context.shell.project.currentChapterId
      const chapter = await context.repository.loadChapterDocument(chapterId)

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
    name: 'save_proposal_draft',
    description: '把一版可应用的正文提议保存到提议仓储，并返回 proposalId，供最终结果引用。',
    inputSchema: objectSchema(
      {
        content: stringSchema('提议后的完整正文内容。'),
        chapterId: stringSchema('可选。目标章节 ID。'),
        linkedIssueId: stringSchema('可选。若这版提议属于某个修订问题，请传对应 issueId。')
      },
      ['content']
    ),
    parse: (input) => {
      const value = expectObject(input, 'save_proposal_draft')
      return {
        content: readRequiredString(value, 'content'),
        chapterId: readOptionalString(value, 'chapterId'),
        linkedIssueId: readOptionalString(value, 'linkedIssueId')
      }
    },
    execute: async (input: { content: string; chapterId?: string; linkedIssueId?: string }) => {
      const chapterId = input.chapterId ?? context.input.chapterId ?? context.shell.project.currentChapterId
      const proposalId = createId('proposal')

      await context.repository.saveGeneratedProposal({
        proposalId,
        chapterId,
        fullContent: input.content,
        sourceSurface: context.input.surface,
        sourceIntent: context.input.intent,
        linkedIssueId: input.linkedIssueId
      })

      return {
        proposalId,
        chapterId
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: () => '保存正文提议草案'
  },
  {
    name: 'upsert_canon_candidate',
    description: '写入或更新一张候选设定卡。',
    inputSchema: objectSchema(
      {
        cardId: stringSchema('可选。已有卡片 ID。为空则自动创建。'),
        name: stringSchema('设定卡名称。'),
        kind: stringSchema('卡片类型，如 character/location/rule/item/timeline-event。'),
        summary: stringSchema('设定摘要。'),
        visibility: stringSchema('candidate、confirmed 或 archived。', ['candidate', 'confirmed', 'archived']),
        evidence: stringSchema('证据片段或来源说明。')
      },
      ['name', 'kind', 'summary', 'visibility', 'evidence']
    ),
    parse: (input) => {
      const value = expectObject(input, 'upsert_canon_candidate')
      return {
        cardId: readOptionalString(value, 'cardId') ?? createId('canon'),
        name: readRequiredString(value, 'name'),
        kind: readRequiredString(value, 'kind'),
        summary: readRequiredString(value, 'summary'),
        visibility: readRequiredString(value, 'visibility') as 'candidate' | 'confirmed' | 'archived',
        evidence: readRequiredString(value, 'evidence')
      }
    },
    execute: async (input: CanonCandidateDto) => {
      await context.repository.upsertCanonCandidate(input)
      return {
        cardId: input.cardId,
        visibility: input.visibility
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: (input: CanonCandidateDto) => `写入设定卡：${input.name}`
  },
  {
    name: 'upsert_revision_issue',
    description: '写入或更新一个修订问题，让问题队列可见。',
    inputSchema: objectSchema(
      {
        issueId: stringSchema('可选。已有 issueId。为空则自动创建。'),
        chapterId: stringSchema('可选。目标章节 ID，不传时默认当前章节。'),
        title: stringSchema('问题标题。'),
        summary: stringSchema('问题摘要。'),
        severity: stringSchema('low、medium 或 high。', ['low', 'medium', 'high']),
        status: stringSchema('open、deferred 或 resolved。', ['open', 'deferred', 'resolved'])
      },
      ['title', 'summary', 'severity', 'status']
    ),
    parse: (input) => {
      const value = expectObject(input, 'upsert_revision_issue')
      return {
        issueId: readOptionalString(value, 'issueId') ?? createId('issue'),
        chapterId: readOptionalString(value, 'chapterId') ?? context.input.chapterId ?? context.shell.project.currentChapterId,
        title: readRequiredString(value, 'title'),
        summary: readRequiredString(value, 'summary'),
        severity: readRequiredString(value, 'severity') as 'low' | 'medium' | 'high',
        status: readRequiredString(value, 'status') as 'open' | 'deferred' | 'resolved'
      }
    },
    execute: async (input: RevisionIssueDto) => {
      await context.repository.upsertRevisionIssue(input)
      return {
        issueId: input.issueId,
        chapterId: input.chapterId,
        status: input.status
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: (input: RevisionIssueDto) => `写入修订问题：${input.title}`
  },
  {
    name: SUBMIT_TASK_RESULT_TOOL_NAME,
    description:
      '提交本轮任务的最终结构化结果。必须在任务结束前调用一次。若生成了 proposal，请在 artifacts 中引用对应 proposalId。',
    inputSchema: objectSchema(
      {
        status: stringSchema('completed、failed 或 waiting_approval。', [
          'completed',
          'failed',
          'waiting_approval'
        ]),
        summary: stringSchema('任务总结。'),
        artifacts: {
          type: 'array',
          description: '要回流到右栏与工作面的结构化结果。',
          items: objectSchema(
            {
              kind: stringSchema('status、evidence、proposal、issue 或 approval。', [
                'status',
                'evidence',
                'proposal',
                'issue',
                'approval'
              ]),
              title: stringSchema('结果标题。某些 publish 模板可省略。'),
              body: stringSchema('结果正文。'),
              supportingLabel: stringSchema('可选。辅助标签。'),
              severity: stringSchema('可选。low、medium 或 high。', ['low', 'medium', 'high']),
              proposalId: stringSchema('可选。若 kind=proposal/approval，可引用先前保存的 proposalId。'),
              linkedIssueId: stringSchema('可选。关联 issueId。'),
              template: stringSchema('可选。publish-synopsis-draft、publish-notes-draft 或 publish-confirm-suggestion。', [
                'publish-synopsis-draft',
                'publish-notes-draft',
                'publish-confirm-suggestion'
              ]),
              diffPreview: objectSchema(
                {
                  before: stringSchema('原文预览。'),
                  after: stringSchema('提议预览。')
                },
                ['before', 'after']
              )
            },
            ['kind', 'body']
          )
        }
      },
      ['status', 'summary', 'artifacts']
    ),
    parse: (input) => {
      const value = expectObject(input, 'submit_task_result')
      const status = readRequiredString(value, 'status')

      if (!['completed', 'failed', 'waiting_approval'].includes(status)) {
        throw new Error('submit_task_result.status 不合法。')
      }

      const artifactsInput = value.artifacts

      if (!Array.isArray(artifactsInput)) {
        throw new Error('submit_task_result.artifacts 必须是数组。')
      }

      return {
        status: status as SubmittedTaskResult['status'],
        summary: readRequiredString(value, 'summary'),
        artifacts: artifactsInput.map((artifact) => parseSubmittedArtifact(artifact))
      }
    },
    execute: async (input: SubmittedTaskResult) => input,
    isConcurrencySafe: () => true,
    getProgressLabel: () => '提交最终任务结果'
  }
] as AgentTool<unknown, unknown>[]

export const toProviderToolDefinitions = (tools: AgentTool<unknown, unknown>[]): ProviderToolDefinition[] =>
  tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
