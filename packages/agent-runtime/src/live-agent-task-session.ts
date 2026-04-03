import { createId, nowIso } from '@lime-novel/shared-kernel'
import type {
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentTaskDiagnosticsDto,
  AgentTaskExecutionStatsDto,
  AgentTaskFailureDto,
  AgentTaskDto,
  AgentToolEventDto,
  AgentTraceEntryDto,
  ProjectRepositoryPort,
  StartTaskInputDto,
  TaskEventDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { NovelSurfaceId, TaskStatus } from '@lime-novel/domain-novel'
import type {
  LiveAgentExecutionResult,
  LiveAgentFailureSubtype,
  SubmittedTaskArtifact,
  SubmittedTaskResult
} from './live-agent-types'

type MaterializedTaskArtifacts = {
  feed: AgentFeedItemDto[]
  finalStatus: TaskStatus
  finalSummary: string
  trace?: AgentTraceEntryDto[]
  toolEvents?: AgentToolEventDto[]
  stats?: AgentTaskExecutionStatsDto
  failure?: AgentTaskFailureDto
}

type AgentTaskDiagnosticsInput = {
  trace?: AgentTraceEntryDto[]
  toolEvents?: AgentToolEventDto[]
  stats?: AgentTaskExecutionStatsDto
  failure?: AgentTaskFailureDto
}

type LiveAgentTaskSessionInput = {
  repository: ProjectRepositoryPort
  task: AgentTaskDto
  header: AgentHeaderDto
  emit: (event: TaskEventDto) => void
  cacheDiagnostics?: (diagnostics: AgentTaskDiagnosticsDto) => void
}

const buildTaskDiagnostics = (
  task: AgentTaskDto,
  input: AgentTaskDiagnosticsInput
): AgentTaskDiagnosticsDto | undefined => {
  if (!input.trace && !input.toolEvents && !input.stats && !input.failure) {
    return undefined
  }

  return {
    taskId: task.taskId,
    trace: input.trace ?? [],
    toolEvents: input.toolEvents ?? [],
    stats: input.stats ?? {
      turnCount: 0,
      usage: {
        inputTokens: 0,
        outputTokens: 0
      }
    },
    failure: input.failure,
    updatedAt: nowIso()
  }
}

const surfaceLabelMap: Record<NovelSurfaceId, string> = {
  home: '首页',
  writing: '写作工作面',
  knowledge: '知识工作面',
  'feature-center': '功能中心',
  analysis: '拆书工作面',
  canon: '设定工作面',
  revision: '修订工作面',
  publish: '发布工作面'
}

const buildProposalRetryPrompt = (input: StartTaskInputDto): string => {
  if (input.surface === 'revision') {
    return `刚才的修订任务是：“${input.intent.trim()}”。请再来一版更克制、改动更小的修订方案，只输出可应用提议与一句理由。`
  }

  return `刚才的任务是：“${input.intent.trim()}”。请在同一章节目标下，再来一版更克制、语气更稳的可应用提议，不要直接覆盖正文。`
}

const buildPublishSynopsisActions = (body: string): AgentFeedItemDto['actions'] => [
  {
    id: createId('action'),
    label: '采用这版简介',
    kind: 'apply-publish-synopsis',
    value: body
  },
  {
    id: createId('action'),
    label: '再生成一版',
    kind: 'prompt',
    prompt: '请再生成一版更像长篇小说连载文案的平台简介。',
    surface: 'publish'
  }
]

const buildPublishNotesActions = (body: string): AgentFeedItemDto['actions'] => [
  {
    id: createId('action'),
    label: '采用这版备注',
    kind: 'apply-publish-notes',
    value: body
  },
  {
    id: createId('action'),
    label: '再生成一版',
    kind: 'prompt',
    prompt: '请再生成一版更适合 release-notes 的发布备注，突出这一版的确认重点。',
    surface: 'publish'
  }
]

const buildProposalActions = (
  proposalId: string,
  input: StartTaskInputDto
): AgentFeedItemDto['actions'] => [
  {
    id: createId('action'),
    label: '应用提议',
    kind: 'apply-proposal',
    proposalId
  },
  {
    id: createId('action'),
    label: '拒绝',
    kind: 'reject-proposal',
    proposalId
  },
  {
    id: createId('action'),
    label: '再来一版',
    kind: 'prompt',
    prompt: buildProposalRetryPrompt(input),
    surface: input.surface
  }
]

const resolveChapterLabel = (
  shell: WorkspaceShellDto,
  input: StartTaskInputDto
): string | undefined => {
  const chapterId = input.chapterId ?? shell.project.currentChapterId
  return shell.chapterTree.find((chapter) => chapter.chapterId === chapterId)?.title
}

const defaultArtifactTitle = (artifact: SubmittedTaskArtifact): string => {
  if (artifact.kind === 'proposal') {
    return '可应用提议已生成'
  }

  if (artifact.kind === 'approval') {
    return '提议等待确认'
  }

  if (artifact.kind === 'issue') {
    return '问题已记录'
  }

  if (artifact.kind === 'evidence') {
    return '证据已同步'
  }

  return '任务结果已同步'
}

const defaultSupportingLabel = (
  artifact: SubmittedTaskArtifact,
  shell: WorkspaceShellDto,
  input: StartTaskInputDto
): string | undefined => {
  const chapterLabel = resolveChapterLabel(shell, input)

  if (artifact.kind === 'proposal') {
    return chapterLabel ? `${chapterLabel} / 可直接应用` : `${shell.project.title} / 可直接应用`
  }

  if (artifact.kind === 'approval') {
    return chapterLabel ? `${chapterLabel} / 等待确认` : `${shell.project.title} / 等待确认`
  }

  if (artifact.kind === 'issue') {
    return chapterLabel ? `${chapterLabel} / 问题队列` : `${shell.project.title} / 问题队列`
  }

  return `${shell.project.title} / ${surfaceLabelMap[input.surface]}`
}

const applyArtifactTemplate = (
  artifact: SubmittedTaskArtifact,
  shell: WorkspaceShellDto
): {
  kind?: AgentFeedItemDto['kind']
  title?: string
  supportingLabel?: string
  actions?: AgentFeedItemDto['actions']
} => {
  if (artifact.template === 'publish-synopsis-draft') {
    return {
      kind: 'evidence',
      title: '平台简介草案已生成',
      supportingLabel: '发布参数 / 可直接回填简介',
      actions: buildPublishSynopsisActions(artifact.body)
    }
  }

  if (artifact.template === 'publish-notes-draft') {
    return {
      kind: 'evidence',
      title: '发布备注草案已生成',
      supportingLabel: '发布参数 / 可直接回填备注',
      actions: buildPublishNotesActions(artifact.body)
    }
  }

  if (artifact.template === 'publish-confirm-suggestion') {
    return {
      kind: 'status',
      title: '最终确认建议已生成',
      supportingLabel: shell.recentExports[0]
        ? `基线版本 ${shell.recentExports[0].versionTag}`
        : `首发版本 ${shell.project.releaseVersion}`,
      actions: [
        {
          id: createId('action'),
          label: '打开确认单',
          kind: 'open-publish-confirm'
        }
      ]
    }
  }

  return {}
}

const normalizeArtifacts = (result: SubmittedTaskResult): SubmittedTaskArtifact[] => {
  const artifacts = [...result.artifacts]
  const proposalArtifact = artifacts.find((artifact) => artifact.proposalId && artifact.kind === 'proposal')
  const hasApprovalArtifact = artifacts.some(
    (artifact) => artifact.kind === 'approval' && artifact.proposalId === proposalArtifact?.proposalId
  )

  if (result.status === 'waiting_approval' && proposalArtifact?.proposalId && !hasApprovalArtifact) {
    artifacts.push({
      kind: 'approval',
      proposalId: proposalArtifact.proposalId,
      linkedIssueId: proposalArtifact.linkedIssueId,
      body: '这一版提议已保存到待确认队列。确认前不会直接覆盖正文，请先比较差异后再决定。',
      diffPreview: proposalArtifact.diffPreview
    })
  }

  return artifacts
}

const materializeFeedItems = (input: {
  task: AgentTaskDto
  shell: WorkspaceShellDto
  startInput: StartTaskInputDto
  result: SubmittedTaskResult
  assistantText?: string
}): AgentFeedItemDto[] => {
  const artifacts = normalizeArtifacts(input.result)
  const createdAt = nowIso()

  const items = artifacts.map((artifact) => {
    const templateMeta = applyArtifactTemplate(artifact, input.shell)
    const proposalActions =
      !templateMeta.actions && artifact.proposalId ? buildProposalActions(artifact.proposalId, input.startInput) : undefined

    return {
      itemId: createId('feed'),
      taskId: input.task.taskId,
      kind: templateMeta.kind ?? artifact.kind,
      title: templateMeta.title ?? artifact.title ?? defaultArtifactTitle(artifact),
      body: artifact.body,
      supportingLabel:
        templateMeta.supportingLabel ?? artifact.supportingLabel ?? defaultSupportingLabel(artifact, input.shell, input.startInput),
      severity: artifact.severity,
      proposalId: artifact.proposalId,
      approvalStatus: artifact.proposalId ? 'pending' : undefined,
      linkedIssueId: artifact.linkedIssueId,
      diffPreview: artifact.diffPreview,
      actions: templateMeta.actions ?? proposalActions,
      createdAt
    } satisfies AgentFeedItemDto
  })

  if (items.length > 0) {
    return items
  }

  return [
    {
      itemId: createId('feed'),
      taskId: input.task.taskId,
      kind: 'status',
      title: '任务结果已同步',
      body: input.assistantText?.trim() || input.result.summary,
      supportingLabel: `${input.shell.project.title} / ${surfaceLabelMap[input.startInput.surface]}`,
      createdAt
    }
  ]
}

const buildExecutionFailureSummary = (subtype: LiveAgentFailureSubtype, detail: string): string => {
  if (subtype === 'error_max_turns') {
    return '模型在最大回合数内没有完成结构化收尾。'
  }

  if (subtype === 'error_max_structured_output_retries') {
    return '模型多次未按约定提交结构化结果，任务已失败。'
  }

  return detail
}

const failureTitleBySubtype: Record<LiveAgentFailureSubtype, string> = {
  error_max_turns: '代理达到最大回合数',
  error_max_structured_output_retries: '结构化结果重试次数已耗尽',
  error_during_execution: '代理执行过程中断'
}

export class LiveAgentTaskSession {
  private currentTask: AgentTaskDto
  private runningSummary: string

  constructor(private readonly input: LiveAgentTaskSessionInput) {
    this.currentTask = input.task
    this.runningSummary = input.task.summary
  }

  get task(): AgentTaskDto {
    return this.currentTask
  }

  async open(): Promise<void> {
    await this.persistTask(this.currentTask)
    this.currentTask = {
      ...this.currentTask,
      status: 'running'
    }
    this.runningSummary = this.currentTask.summary
    await this.persistTask(this.currentTask)
  }

  updateRunningSummary = async (summary: string): Promise<void> => {
    const nextSummary = summary.trim()

    if (!nextSummary || nextSummary === this.runningSummary) {
      return
    }

    this.runningSummary = nextSummary
    this.currentTask = {
      ...this.currentTask,
      summary: nextSummary
    }
    await this.persistTask(this.currentTask)
  }

  publishDiagnostics = (diagnosticsInput: AgentTaskDiagnosticsInput): void => {
    const diagnostics = buildTaskDiagnostics(this.currentTask, diagnosticsInput)

    if (!diagnostics) {
      return
    }

    this.input.cacheDiagnostics?.(diagnostics)
    this.input.emit({
      type: 'task.diagnostics',
      diagnostics,
      header: this.input.header
    })
  }

  private materializeExecutionArtifacts = (
    shell: WorkspaceShellDto,
    startInput: StartTaskInputDto,
    executionResult: LiveAgentExecutionResult
  ): MaterializedTaskArtifacts => {
    if (executionResult.kind === 'success') {
      return {
        feed: materializeFeedItems({
          task: this.currentTask,
          shell,
          startInput,
          result: executionResult.submittedResult,
          assistantText: executionResult.assistantText
        }),
        finalStatus: executionResult.submittedResult.status,
        finalSummary: executionResult.submittedResult.summary,
        trace: executionResult.trace,
        toolEvents: executionResult.toolEvents,
        stats: executionResult.stats
      }
    }

    return {
      feed: [
        {
          itemId: createId('feed'),
          taskId: this.currentTask.taskId,
          kind: 'issue',
          title: failureTitleBySubtype[executionResult.subtype],
          body: executionResult.detail,
          supportingLabel: executionResult.providerCode
            ? `Agent Runtime / ${executionResult.subtype} / ${executionResult.providerCode}`
            : `Agent Runtime / ${executionResult.subtype}`,
          severity: 'high',
          createdAt: nowIso()
        }
      ],
      finalStatus: 'failed',
      finalSummary: buildExecutionFailureSummary(executionResult.subtype, executionResult.detail),
      trace: executionResult.trace,
      toolEvents: executionResult.toolEvents,
      stats: executionResult.stats,
      failure: {
        subtype: executionResult.subtype,
        detail: executionResult.detail,
        providerCode: executionResult.providerCode,
        stopReason: executionResult.stats.stopReason,
        turnCount: executionResult.stats.turnCount,
        usage: executionResult.stats.usage
      }
    }
  }

  async commitExecutionResult(
    shell: WorkspaceShellDto,
    startInput: StartTaskInputDto,
    executionResult: LiveAgentExecutionResult
  ): Promise<AgentTaskDto> {
    return this.commitMaterializedArtifacts(this.materializeExecutionArtifacts(shell, startInput, executionResult))
  }

  private async commitMaterializedArtifacts(artifacts: MaterializedTaskArtifacts): Promise<AgentTaskDto> {
    for (const item of artifacts.feed) {
      await this.input.repository.appendAgentFeed(item)
      this.input.emit({
        type: 'feed.item',
        item,
        header: this.input.header
      })
    }

    this.currentTask = {
      ...this.currentTask,
      summary: artifacts.finalSummary,
      status: artifacts.finalStatus
    }
    await this.persistTask(this.currentTask)
    this.publishDiagnostics(artifacts)
    return this.currentTask
  }

  private async persistTask(task: AgentTaskDto): Promise<void> {
    await this.input.repository.upsertAgentTask(task)
    this.input.emit({
      type: 'task.updated',
      task,
      header: this.input.header
    })
  }
}
