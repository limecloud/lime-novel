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
  DiagnosticReportDto,
  GenerateKnowledgeAnswerInputDto,
  GenerateKnowledgeAnswerResultDto,
  ImpactAnalysisDto,
  ImportKnowledgeDocumentInputDto,
  ImportKnowledgeDocumentResultDto,
  ImportAnalysisSampleInputDto,
  ImportAnalysisSampleResultDto,
  IntentPlanDto,
  KnowledgeDocumentDetailDto,
  ApplyProposalResultDto,
  ReaderFeedbackDto,
  ChapterDocumentDto,
  RejectProposalResultDto,
  TimelineIterationDto,
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
  importKnowledgeDocument(input: ImportKnowledgeDocumentInputDto): Promise<ImportKnowledgeDocumentResultDto>
  updateWorkspaceContext(input: UpdateWorkspaceContextInputDto): Promise<void>
  loadChapterDocument(chapterId: string): Promise<ChapterDocumentDto>
  saveChapterDocument(input: SaveChapterInputDto): Promise<SaveChapterResultDto>
  importAnalysisSample(input: ImportAnalysisSampleInputDto): Promise<ImportAnalysisSampleResultDto>
  applyProjectStrategyProposal(
    input: ApplyProjectStrategyProposalInputDto
  ): Promise<ApplyProjectStrategyProposalResultDto>
  upsertAgentTask(task: AgentTaskDto): Promise<void>
  appendAgentFeed(item: AgentFeedItemDto): Promise<void>
  upsertAgentTaskDiagnostics(diagnostics: AgentTaskDiagnosticsDto): Promise<void>
  loadAgentTaskDiagnostics(): Promise<AgentTaskDiagnosticsDto[]>
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
  upsertDiagnosticReport(report: DiagnosticReportDto): Promise<void>
  upsertImpactAnalysis(analysis: ImpactAnalysisDto): Promise<void>
  upsertIntentPlan(plan: IntentPlanDto): Promise<void>
  upsertReaderFeedback(feedback: ReaderFeedbackDto): Promise<void>
  upsertTimelineIteration(iteration: TimelineIterationDto): Promise<void>
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
