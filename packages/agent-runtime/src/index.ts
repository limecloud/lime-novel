import type {
  AgentTaskDiagnosticsDto,
  AgentRuntimePort,
  ProjectRepositoryPort,
  StartTaskInputDto,
  StartTaskResultDto,
  TaskEventDto
} from '@lime-novel/application'
import { createAgentTaskSessionSeed } from './agent-task-factory'
import { createConfiguredLLMProvider, resolveAgentRuntimeConfig } from './live-agent-provider'
import { buildFailedExecutionResult, executeLegacyAgentSession } from './legacy-agent-session'
import { executeLiveAgentSession } from './live-agent-session'
import { LiveAgentTaskSession } from './live-agent-task-session'
import type { LiveAgentExecutionResult } from './live-agent-types'

const MAX_CACHED_TASK_DIAGNOSTICS = 20

export class LocalAgentRuntime implements AgentRuntimePort {
  private listeners = new Set<(event: TaskEventDto) => void>()
  private diagnosticsByTaskId = new Map<string, AgentTaskDiagnosticsDto>()

  constructor(private readonly getRepository: () => ProjectRepositoryPort) {}

  subscribe(listener: (event: TaskEventDto) => void): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  async loadTaskDiagnostics(): Promise<AgentTaskDiagnosticsDto[]> {
    return [...this.diagnosticsByTaskId.values()].sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt)
      const rightTime = Date.parse(right.updatedAt)

      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })
  }

  private cacheDiagnostics(diagnostics: AgentTaskDiagnosticsDto): void {
    this.diagnosticsByTaskId.set(diagnostics.taskId, diagnostics)

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

    const runtimeConfig = resolveAgentRuntimeConfig()
    const provider = createConfiguredLLMProvider(runtimeConfig)
    let executionResult: LiveAgentExecutionResult

    try {
      executionResult =
        provider == null
          ? await executeLegacyAgentSession(repository, shell, input)
          : await executeLiveAgentSession({
              repository,
              shell,
              input,
              task: session.task,
              header,
              provider,
              config: runtimeConfig,
              onProgress: session.updateRunningSummary,
              onDiagnostics: session.publishDiagnostics
            })
    } catch (error) {
      executionResult = buildFailedExecutionResult(error)
    }

    const finalTask = await session.commitExecutionResult(shell, input, executionResult)
    return { task: finalTask }
  }

  private emit(event: TaskEventDto): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

export const createLocalAgentRuntime = (
  getRepository: () => ProjectRepositoryPort
): LocalAgentRuntime => new LocalAgentRuntime(getRepository)
