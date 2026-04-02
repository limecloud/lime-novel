import type { ApplyProposalResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createApplyProposalUseCase =
  (repository: ProjectRepositoryPort) =>
  async (proposalId: string): Promise<ApplyProposalResultDto> =>
    repository.applyProposal(proposalId)

