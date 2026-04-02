import type { ChapterDocumentDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createLoadChapterDocumentUseCase =
  (repository: ProjectRepositoryPort) =>
  async (chapterId: string): Promise<ChapterDocumentDto> =>
    repository.loadChapterDocument(chapterId)

