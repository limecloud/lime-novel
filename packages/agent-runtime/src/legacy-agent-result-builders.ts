import type {
  ProjectRepositoryPort,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { AgentRuntimeSurface } from './agent-surface-policy'
import type {
  LegacyAgentResultBuilder,
  LegacyAgentResultBuilderContext
} from './legacy-agent-result-builder-context'
import type { SubmittedTaskResult } from './live-agent-types'
import { normalizeRuntimeSurface } from './agent-surface-policy'
import { buildLegacyAnalysisSubmittedResult } from './legacy-analysis-result-builder'
import { buildLegacyCanonSubmittedResult } from './legacy-canon-result-builder'
import { buildLegacyHomeSubmittedResult } from './legacy-home-result-builder'
import { buildLegacyKnowledgeSubmittedResult } from './legacy-knowledge-result-builder'
import { buildLegacyPublishSubmittedResult } from './legacy-publish-result-builder'
import { buildLegacyRevisionSubmittedResult } from './legacy-revision-result-builder'
import { buildLegacyWritingSubmittedResult } from './legacy-writing-result-builder'

const legacySubmittedResultBuilders = {
  home: buildLegacyHomeSubmittedResult,
  writing: buildLegacyWritingSubmittedResult,
  knowledge: buildLegacyKnowledgeSubmittedResult,
  analysis: buildLegacyAnalysisSubmittedResult,
  canon: buildLegacyCanonSubmittedResult,
  revision: buildLegacyRevisionSubmittedResult,
  publish: buildLegacyPublishSubmittedResult
} satisfies Record<AgentRuntimeSurface, LegacyAgentResultBuilder>

export const buildLegacySubmittedTaskResult = async (
  repository: ProjectRepositoryPort,
  shell: WorkspaceShellDto,
  input: StartTaskInputDto
): Promise<SubmittedTaskResult> => {
  const context: LegacyAgentResultBuilderContext = {
    repository,
    shell,
    input
  }

  return legacySubmittedResultBuilders[normalizeRuntimeSurface(input.surface)](
    context
  )
}
