import type { CreateExportPackageInputDto, CreateExportPackageResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createCreateExportPackageUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: CreateExportPackageInputDto): Promise<CreateExportPackageResultDto> =>
    repository.createExportPackage(input)
