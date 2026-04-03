import type {
  GenerateKnowledgeAnswerInputDto,
  GenerateKnowledgeAnswerResultDto,
  KnowledgeDocumentDetailDto
} from '../dto'
import type { ProjectRepositoryPort } from '../ports'

export const createLoadKnowledgeDocumentUseCase =
  (repository: ProjectRepositoryPort) =>
  async (relativePath: string): Promise<KnowledgeDocumentDetailDto> =>
    repository.loadKnowledgeDocument(relativePath)

export const createGenerateKnowledgeAnswerUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: GenerateKnowledgeAnswerInputDto): Promise<GenerateKnowledgeAnswerResultDto> =>
    repository.generateKnowledgeAnswer(input)
