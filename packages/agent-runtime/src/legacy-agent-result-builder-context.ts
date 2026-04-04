import type {
  ProjectRepositoryPort,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { SubmittedTaskResult } from './live-agent-types'

export type LegacyAgentResultBuilderContext = {
  repository: ProjectRepositoryPort
  shell: WorkspaceShellDto
  input: StartTaskInputDto
}

export type LegacyAgentResultBuilder = (
  context: LegacyAgentResultBuilderContext
) => Promise<SubmittedTaskResult> | SubmittedTaskResult
