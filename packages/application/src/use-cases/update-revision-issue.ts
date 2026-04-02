import type { UpdateRevisionIssueInputDto, UpdateRevisionIssueResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createUpdateRevisionIssueUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: UpdateRevisionIssueInputDto): Promise<UpdateRevisionIssueResultDto> =>
    repository.updateRevisionIssue(input)
