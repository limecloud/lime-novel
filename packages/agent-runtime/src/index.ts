import type {
  AgentTaskDiagnosticsDto,
  AgentRuntimePort,
  ProjectRepositoryPort,
  StartTaskInputDto,
  StartTaskResultDto,
  TaskEventDto
} from '@lime-novel/application'
import { createAgentTaskSessionSeed } from './agent-task-factory'
import {
  createConfiguredLLMProvider,
  resolveAgentRuntimeConfig,
  type AgentRuntimeConfig
} from './live-agent-provider'
import { buildFailedExecutionResult, executeLegacyAgentSession } from './legacy-agent-session'
import { executeLiveAgentSession } from './live-agent-session'
import { LiveAgentTaskSession } from './live-agent-task-session'
import type { LiveAgentExecutionResult } from './live-agent-types'

const MAX_CACHED_TASK_DIAGNOSTICS = 20
type RuntimeConfigResolver = () => AgentRuntimeConfig | Promise<AgentRuntimeConfig>

const buildRuntimeStartSummary = (
  config: AgentRuntimeConfig,
  input: StartTaskInputDto
): string => {
  if (config.provider === 'legacy') {
    return `本地规则模式执行中：${input.intent}`
  }

  if (config.provider === 'anthropic') {
    return `Claude / Anthropic（${config.model}）执行中：${input.intent}`
  }

  return `OpenAI Compatible（${config.model}）执行中：${input.intent}`
}

export class LocalAgentRuntime implements AgentRuntimePort {
  private listeners = new Set<(event: TaskEventDto) => void>()
  private diagnosticsByTaskId = new Map<string, AgentTaskDiagnosticsDto>()

  constructor(
    private readonly getRepository: () => ProjectRepositoryPort,
    private readonly resolveRuntimeConfig: RuntimeConfigResolver = () => resolveAgentRuntimeConfig()
  ) {}

  subscribe(listener: (event: TaskEventDto) => void): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  async loadTaskDiagnostics(): Promise<AgentTaskDiagnosticsDto[]> {
    const persistedDiagnostics = await this.getRepository().loadAgentTaskDiagnostics()
    const diagnosticsByTaskId = new Map(persistedDiagnostics.map((diagnostics) => [diagnostics.taskId, diagnostics]))

    for (const diagnostics of this.diagnosticsByTaskId.values()) {
      const current = diagnosticsByTaskId.get(diagnostics.taskId)

      if (!current || Date.parse(diagnostics.updatedAt) >= Date.parse(current.updatedAt)) {
        diagnosticsByTaskId.set(diagnostics.taskId, diagnostics)
      }
    }

    return [...diagnosticsByTaskId.values()].sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt)
      const rightTime = Date.parse(right.updatedAt)

      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })
  }

  private cacheDiagnostics(diagnostics: AgentTaskDiagnosticsDto): void {
    this.diagnosticsByTaskId.set(diagnostics.taskId, diagnostics)
    void this.getRepository().upsertAgentTaskDiagnostics(diagnostics).catch(() => undefined)

    if (this.diagnosticsByTaskId.size <= MAX_CACHED_TASK_DIAGNOSTICS) {
      return
    }

    const oldestEntry = [...this.diagnosticsByTaskId.entries()].sort((left, right) => {
      const leftTime = Date.parse(left[1].updatedAt)
      const rightTime = Date.parse(right[1].updatedAt)

      return (Number.isNaN(leftTime) ? 0 : leftTime) - (Number.isNaN(rightTime) ? 0 : rightTime)
    })[0]

    if (!oldestEntry || oldestEntry[0] === diagnostics.taskId) {
      return
    }

    this.diagnosticsByTaskId.delete(oldestEntry[0])
  }

  async startTask(input: StartTaskInputDto): Promise<StartTaskResultDto> {
    const repository = this.getRepository()
    const shell = await repository.loadWorkspaceShell()
    const { header, task } = createAgentTaskSessionSeed(input, shell)
    const session = new LiveAgentTaskSession({
      repository,
      task,
      header,
      emit: (event) => this.emit(event),
      cacheDiagnostics: (diagnostics) => this.cacheDiagnostics(diagnostics)
    })
    await session.open()

    void this.runTaskInBackground({
      repository,
      shell,
      input,
      header,
      session
    })

    return { task: session.task }
  }

  private async runTaskInBackground(input: {
    repository: ProjectRepositoryPort
    shell: Awaited<ReturnType<ProjectRepositoryPort['loadWorkspaceShell']>>
    input: StartTaskInputDto
    header: ReturnType<typeof createAgentTaskSessionSeed>['header']
    session: LiveAgentTaskSession
  }): Promise<void> {
    let executionResult: LiveAgentExecutionResult

    try {
      const runtimeConfig = await this.resolveRuntimeConfig()
      await input.session.updateRunningSummary(buildRuntimeStartSummary(runtimeConfig, input.input))
      const provider = createConfiguredLLMProvider(runtimeConfig)

      executionResult =
        provider == null
          ? await executeLegacyAgentSession(input.repository, input.shell, input.input)
          : await executeLiveAgentSession({
              repository: input.repository,
              shell: input.shell,
              input: input.input,
              task: input.session.task,
              header: input.header,
              provider,
              config: runtimeConfig,
              onProgress: input.session.updateRunningSummary,
              onDiagnostics: input.session.publishDiagnostics
            })
    } catch (error) {
      executionResult = buildFailedExecutionResult(error)
    }

    try {
      await input.session.commitExecutionResult(input.shell, input.input, executionResult)
    } catch (error) {
      const detail = error instanceof Error ? error.message : '代理结果回写失败。'

      try {
        await input.session.failCommit({
          detail,
          stats: executionResult.stats
        })
      } catch {
        input.session.publishDiagnostics({
          failure: {
            subtype: 'error_during_execution',
            detail,
            turnCount: executionResult.stats.turnCount,
            usage: executionResult.stats.usage
          },
          stats: executionResult.stats
        })
      }
    }
  }

  private emit(event: TaskEventDto): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

export const createLocalAgentRuntime = (
  getRepository: () => ProjectRepositoryPort,
  resolveRuntimeConfig?: RuntimeConfigResolver
): LocalAgentRuntime => new LocalAgentRuntime(getRepository, resolveRuntimeConfig)

export { createConfiguredLLMProvider, resolveAgentRuntimeConfig } from './live-agent-provider'
export type { AgentRuntimeConfig, AgentRuntimeProviderKind } from './live-agent-provider'
