import type { ProjectRepositoryPort, RevisionIssueDto } from '@lime-novel/application'
import type { LegacyAgentResultBuilderContext } from './legacy-agent-result-builder-context'
import {
  loadRuntimeChapterDocument,
  saveRuntimeCanonCandidates,
  saveRuntimeGeneratedProposal,
  saveRuntimeRevisionIssue
} from './agent-runtime-repository'

type LegacyPersistedProposal = {
  proposalId: string
  fullContent: string
}

export const loadLegacyTargetChapter = async (
  context: LegacyAgentResultBuilderContext
): ReturnType<typeof loadRuntimeChapterDocument> =>
  loadRuntimeChapterDocument({
    repository: context.repository,
    currentChapterId: context.shell.project.currentChapterId,
    chapterId: context.input.chapterId
  })

export const saveLegacyGeneratedProposal = async (input: {
  repository: ProjectRepositoryPort
  chapterId: string
  sourceSurface: 'writing' | 'revision'
  sourceIntent: string
  proposal: LegacyPersistedProposal
  linkedIssueId?: string
}): Promise<void> => {
  await saveRuntimeGeneratedProposal({
    repository: input.repository,
    proposalId: input.proposal.proposalId,
    currentChapterId: input.chapterId,
    chapterId: input.chapterId,
    fullContent: input.proposal.fullContent,
    sourceSurface: input.sourceSurface,
    sourceIntent: input.sourceIntent,
    linkedIssueId: input.linkedIssueId
  })
}

export const saveLegacyCanonCandidates = saveRuntimeCanonCandidates

export const saveLegacyRevisionIssue = async (
  repository: ProjectRepositoryPort,
  issue: RevisionIssueDto
): Promise<void> => saveRuntimeRevisionIssue(repository, issue)
