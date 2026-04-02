import type { ImportAnalysisSampleInputDto, ImportAnalysisSampleResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createImportAnalysisSampleUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: ImportAnalysisSampleInputDto): Promise<ImportAnalysisSampleResultDto> =>
    repository.importAnalysisSample(input)
