import type { RejectProposalResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createRejectProposalUseCase =
  (repository: ProjectRepositoryPort) =>
  async (proposalId: string): Promise<RejectProposalResultDto> =>
    repository.rejectProposal(proposalId)
