import type { CreateProjectInputDto, CreateProjectResultDto } from '../dto'
import type { WorkspaceLifecyclePort } from '../ports'

export const createCreateProjectWorkspaceUseCase =
  (workspaceLifecycle: WorkspaceLifecyclePort) =>
  async (input: CreateProjectInputDto): Promise<CreateProjectResultDto> =>
    workspaceLifecycle.createProject(input)
