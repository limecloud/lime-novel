import type {
  CanonCandidateDto,
  ChapterDocumentDto,
  ProjectRepositoryPort,
  RevisionIssueDto
} from '@lime-novel/application'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'

export type RuntimeLoadedChapter = {
  chapterId: string
  chapter: ChapterDocumentDto
}

export const resolveRuntimeChapterId = (
  currentChapterId: string,
  chapterId?: string
): string => chapterId ?? currentChapterId

export const loadRuntimeChapterDocument = async (input: {
  repository: ProjectRepositoryPort
  currentChapterId: string
  chapterId?: string
}): Promise<RuntimeLoadedChapter> => {
  const chapterId = resolveRuntimeChapterId(input.currentChapterId, input.chapterId)

  return {
    chapterId,
    chapter: await input.repository.loadChapterDocument(chapterId)
  }
}

export const saveRuntimeGeneratedProposal = async (input: {
  repository: ProjectRepositoryPort
  proposalId: string
  currentChapterId: string
  chapterId?: string
  fullContent: string
  sourceSurface: NovelSurfaceId
  sourceIntent: string
  linkedIssueId?: string
}): Promise<{ proposalId: string; chapterId: string }> => {
  const chapterId = resolveRuntimeChapterId(input.currentChapterId, input.chapterId)

  await input.repository.saveGeneratedProposal({
    proposalId: input.proposalId,
    chapterId,
    fullContent: input.fullContent,
    sourceSurface: input.sourceSurface,
    sourceIntent: input.sourceIntent,
    linkedIssueId: input.linkedIssueId
  })

  return {
    proposalId: input.proposalId,
    chapterId
  }
}

export const saveRuntimeCanonCandidate = async (
  repository: ProjectRepositoryPort,
  card: CanonCandidateDto
): Promise<void> => repository.upsertCanonCandidate(card)

export const saveRuntimeCanonCandidates = async (
  repository: ProjectRepositoryPort,
  cards: CanonCandidateDto[]
): Promise<void> => {
  for (const card of cards) {
    await saveRuntimeCanonCandidate(repository, card)
  }
}

export const saveRuntimeRevisionIssue = async (
  repository: ProjectRepositoryPort,
  issue: RevisionIssueDto
): Promise<void> => repository.upsertRevisionIssue(issue)
