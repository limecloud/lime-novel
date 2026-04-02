import type { WorkspaceShellDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createLoadWorkspaceShellUseCase =
  (repository: ProjectRepositoryPort) =>
  async (): Promise<WorkspaceShellDto> =>
    repository.loadWorkspaceShell()

