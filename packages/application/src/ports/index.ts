import type {
  CommitCanonCardInputDto,
  CommitCanonCardResultDto,
  CreateProjectInputDto,
  CreateProjectResultDto,
  CreateExportPackageInputDto,
  CreateExportPackageResultDto,
  ApplyProposalResultDto,
  ChapterDocumentDto,
  SaveChapterInputDto,
  SaveChapterResultDto,
  StartTaskInputDto,
  StartTaskResultDto,
  TaskEventDto,
  UpdateRevisionIssueInputDto,
  UpdateRevisionIssueResultDto,
  UpdateWorkspaceContextInputDto,
  WorkspaceShellDto
} from '../dto'

export interface ProjectRepositoryPort {
  loadWorkspaceShell(): Promise<WorkspaceShellDto>
  updateWorkspaceContext(input: UpdateWorkspaceContextInputDto): Promise<void>
  loadChapterDocument(chapterId: string): Promise<ChapterDocumentDto>
  saveChapterDocument(input: SaveChapterInputDto): Promise<SaveChapterResultDto>
  applyProposal(proposalId: string): Promise<ApplyProposalResultDto>
  commitCanonCard(input: CommitCanonCardInputDto): Promise<CommitCanonCardResultDto>
  updateRevisionIssue(input: UpdateRevisionIssueInputDto): Promise<UpdateRevisionIssueResultDto>
  createExportPackage(input: CreateExportPackageInputDto): Promise<CreateExportPackageResultDto>
}

export interface AgentRuntimePort {
  startTask(input: StartTaskInputDto): Promise<StartTaskResultDto>
  subscribe(listener: (event: TaskEventDto) => void): () => void
}

export interface WorkspaceLifecyclePort {
  createProject(input: CreateProjectInputDto): Promise<CreateProjectResultDto>
}
