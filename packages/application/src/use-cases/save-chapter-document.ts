import type { SaveChapterInputDto, SaveChapterResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createSaveChapterDocumentUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: SaveChapterInputDto): Promise<SaveChapterResultDto> =>
    repository.saveChapterDocument(input)
