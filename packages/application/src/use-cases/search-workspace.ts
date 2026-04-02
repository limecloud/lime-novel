import type { WorkspaceSearchInputDto, WorkspaceSearchResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createSearchWorkspaceUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: WorkspaceSearchInputDto): Promise<WorkspaceSearchResultDto> =>
    repository.searchWorkspace(input)
