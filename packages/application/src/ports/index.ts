import type {
  ApplyProjectStrategyProposalInputDto,
  ApplyProjectStrategyProposalResultDto,
  AgentFeedItemDto,
  AgentTaskDiagnosticsDto,
  AgentTaskDto,
  CanonCandidateDto,
  CommitCanonCardInputDto,
  CommitCanonCardResultDto,
  CreateProjectInputDto,
  CreateProjectResultDto,
  CreateExportPackageInputDto,
  CreateExportPackageResultDto,
  GenerateKnowledgeAnswerInputDto,
  GenerateKnowledgeAnswerResultDto,
  ImportAnalysisSampleInputDto,
  ImportAnalysisSampleResultDto,
  KnowledgeDocumentDetailDto,
  ApplyProposalResultDto,
  ChapterDocumentDto,
  RejectProposalResultDto,
  UndoRevisionRecordResultDto,
  RevisionIssueDto,
  RevisionRecordDto,
  SaveChapterInputDto,
  SaveChapterResultDto,
  StartTaskInputDto,
  StartTaskResultDto,
  TaskEventDto,
  UpdateRevisionIssueInputDto,
  UpdateRevisionIssueResultDto,
  UpdateWorkspaceContextInputDto,
  WorkspaceSearchInputDto,
  WorkspaceSearchResultDto,
  WorkspaceShellDto
} from '../dto'

export interface ProjectRepositoryPort {
  loadWorkspaceShell(): Promise<WorkspaceShellDto>
  searchWorkspace(input: WorkspaceSearchInputDto): Promise<WorkspaceSearchResultDto>
  loadKnowledgeDocument(relativePath: string): Promise<KnowledgeDocumentDetailDto>
  generateKnowledgeAnswer(input: GenerateKnowledgeAnswerInputDto): Promise<GenerateKnowledgeAnswerResultDto>
  updateWorkspaceContext(input: UpdateWorkspaceContextInputDto): Promise<void>
  loadChapterDocument(chapterId: string): Promise<ChapterDocumentDto>
  saveChapterDocument(input: SaveChapterInputDto): Promise<SaveChapterResultDto>
  importAnalysisSample(input: ImportAnalysisSampleInputDto): Promise<ImportAnalysisSampleResultDto>
  applyProjectStrategyProposal(
    input: ApplyProjectStrategyProposalInputDto
  ): Promise<ApplyProjectStrategyProposalResultDto>
  upsertAgentTask(task: AgentTaskDto): Promise<void>
  appendAgentFeed(item: AgentFeedItemDto): Promise<void>
  saveGeneratedProposal(input: {
    proposalId: string
    chapterId: string
    fullContent: string
    sourceSurface: StartTaskInputDto['surface']
    sourceIntent: string
    linkedIssueId?: string
  }): Promise<void>
  upsertCanonCandidate(card: CanonCandidateDto): Promise<void>
  upsertRevisionIssue(issue: RevisionIssueDto): Promise<void>
  applyProposal(proposalId: string): Promise<ApplyProposalResultDto>
  rejectProposal(proposalId: string): Promise<RejectProposalResultDto>
  commitCanonCard(input: CommitCanonCardInputDto): Promise<CommitCanonCardResultDto>
  updateRevisionIssue(input: UpdateRevisionIssueInputDto): Promise<UpdateRevisionIssueResultDto>
  undoRevisionRecord(recordId: string): Promise<UndoRevisionRecordResultDto>
  createExportPackage(input: CreateExportPackageInputDto): Promise<CreateExportPackageResultDto>
}

export interface AgentRuntimePort {
  startTask(input: StartTaskInputDto): Promise<StartTaskResultDto>
  loadTaskDiagnostics(): Promise<AgentTaskDiagnosticsDto[]>
  subscribe(listener: (event: TaskEventDto) => void): () => void
}

export interface WorkspaceLifecyclePort {
  createProject(input: CreateProjectInputDto): Promise<CreateProjectResultDto>
}
