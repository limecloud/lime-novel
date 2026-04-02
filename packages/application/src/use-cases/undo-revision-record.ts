import type { UndoRevisionRecordResultDto } from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createUndoRevisionRecordUseCase =
  (repository: ProjectRepositoryPort) =>
  async (recordId: string): Promise<UndoRevisionRecordResultDto> =>
    repository.undoRevisionRecord(recordId)
