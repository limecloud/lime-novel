import type { CommitCanonCardInputDto, CommitCanonCardResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createCommitCanonCardUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: CommitCanonCardInputDto): Promise<CommitCanonCardResultDto> =>
    repository.commitCanonCard(input)
