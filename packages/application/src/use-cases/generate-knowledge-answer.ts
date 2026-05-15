import type {
  GenerateKnowledgeAnswerInputDto,
  GenerateKnowledgeAnswerResultDto,
  ImportKnowledgeDocumentInputDto,
  ImportKnowledgeDocumentResultDto,
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

export const createImportKnowledgeDocumentUseCase =
  (repository: ProjectRepositoryPort) =>
  async (input: ImportKnowledgeDocumentInputDto): Promise<ImportKnowledgeDocumentResultDto> =>
    repository.importKnowledgeDocument(input)
