import type { UpdateWorkspaceContextInputDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createUpdateWorkspaceContextUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: UpdateWorkspaceContextInputDto): Promise<void> =>
    repository.updateWorkspaceContext(input)
