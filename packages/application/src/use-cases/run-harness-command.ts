import type { HarnessCommandInputDto, HarnessCommandResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createRunHarnessCommandUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: HarnessCommandInputDto): Promise<HarnessCommandResultDto> =>
    repository.runHarnessCommand(input)
