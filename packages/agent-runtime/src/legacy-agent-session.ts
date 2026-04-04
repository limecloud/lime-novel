import type {
  ProjectRepositoryPort,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type {
  LiveAgentExecutionResult,
  LiveAgentExecutionStats,
  SubmittedTaskResult
} from './live-agent-types'
import { buildLegacySubmittedTaskResult } from './legacy-agent-result-builders'

const createEmptyExecutionStats = (): LiveAgentExecutionStats => ({
  turnCount: 0,
  usage: {
    inputTokens: 0,
    outputTokens: 0
  }
})

const buildSuccessfulExecutionResult = (submittedResult: SubmittedTaskResult): LiveAgentExecutionResult => ({
  kind: 'success',
  submittedResult,
  stats: createEmptyExecutionStats(),
  trace: [],
  toolEvents: []
})

export const buildFailedExecutionResult = (error: unknown): LiveAgentExecutionResult => ({
  kind: 'error',
  subtype: 'error_during_execution',
  detail: error instanceof Error ? error.message : '代理执行失败。',
  stats: createEmptyExecutionStats(),
  trace: [],
  toolEvents: []
})

export const executeLegacyAgentSession = async (
  repository: ProjectRepositoryPort,
  shell: WorkspaceShellDto,
  input: StartTaskInputDto
): Promise<LiveAgentExecutionResult> =>
  buildSuccessfulExecutionResult(await buildLegacySubmittedTaskResult(repository, shell, input))
