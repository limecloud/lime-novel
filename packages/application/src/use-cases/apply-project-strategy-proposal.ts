import type {
  ApplyProjectStrategyProposalInputDto,
  ApplyProjectStrategyProposalResultDto
} from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createApplyProjectStrategyProposalUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: ApplyProjectStrategyProposalInputDto): Promise<ApplyProjectStrategyProposalResultDto> =>
    repository.applyProjectStrategyProposal(input)
