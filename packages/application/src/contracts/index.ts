import type {
  ApplyProjectStrategyProposalInputDto,
  ApplyProjectStrategyProposalResultDto,
  AgentRuntimeConnectionTestResultDto,
  AgentTaskDiagnosticsDto,
  AgentRuntimeSettingsDto,
  AgentRuntimeSettingsStateDto,
  CommitCanonCardInputDto,
  CommitCanonCardResultDto,
  CreateProjectInputDto,
  CreateProjectResultDto,
  CreateExportPackageInputDto,
  CreateExportPackageResultDto,
  GenerateKnowledgeAnswerInputDto,
  GenerateKnowledgeAnswerResultDto,
  ImportAnalysisSampleResultDto,
  KnowledgeDocumentDetailDto,
  OpenProjectResultDto,
  ApplyProposalResultDto,
  ChapterDocumentDto,
  RejectProposalResultDto,
  SaveChapterInputDto,
  SaveChapterResultDto,
  StartTaskInputDto,
  StartTaskResultDto,
  TaskEventDto,
  UndoRevisionRecordResultDto,
  UpdateRevisionIssueInputDto,
  UpdateRevisionIssueResultDto,
  UpdateWorkspaceContextInputDto,
  WorkspaceSearchInputDto,
  WorkspaceSearchResultDto,
  WorkspaceShellDto
} from '../dto'

export type DesktopApiContract = {
  workspace: {
    loadShell: () => Promise<WorkspaceShellDto>
    searchWorkspace: (input: WorkspaceSearchInputDto) => Promise<WorkspaceSearchResultDto>
    updateContext: (input: UpdateWorkspaceContextInputDto) => Promise<void>
    openProjectDialog: () => Promise<OpenProjectResultDto | null>
    createProject: (input: CreateProjectInputDto) => Promise<CreateProjectResultDto>
  }
  knowledge: {
    loadDocument: (relativePath: string) => Promise<KnowledgeDocumentDetailDto>
    generateAnswer: (input: GenerateKnowledgeAnswerInputDto) => Promise<GenerateKnowledgeAnswerResultDto>
  }
  chapter: {
    loadDocument: (chapterId: string) => Promise<ChapterDocumentDto>
    saveDocument: (input: SaveChapterInputDto) => Promise<SaveChapterResultDto>
    applyProposal: (proposalId: string) => Promise<ApplyProposalResultDto>
    rejectProposal: (proposalId: string) => Promise<RejectProposalResultDto>
  }
  analysis: {
    importSample: () => Promise<ImportAnalysisSampleResultDto | null>
    applyStrategyProposal: (
      input: ApplyProjectStrategyProposalInputDto
    ) => Promise<ApplyProjectStrategyProposalResultDto>
  }
  canon: {
    commitCard: (input: CommitCanonCardInputDto) => Promise<CommitCanonCardResultDto>
  }
  revision: {
    updateIssue: (input: UpdateRevisionIssueInputDto) => Promise<UpdateRevisionIssueResultDto>
    undoRecord: (recordId: string) => Promise<UndoRevisionRecordResultDto>
  }
  publish: {
    createExportPackage: (input: CreateExportPackageInputDto) => Promise<CreateExportPackageResultDto>
  }
  agent: {
    loadSettings: () => Promise<AgentRuntimeSettingsStateDto>
    saveSettings: (input: AgentRuntimeSettingsDto) => Promise<AgentRuntimeSettingsStateDto>
    testSettings: (input: AgentRuntimeSettingsDto) => Promise<AgentRuntimeConnectionTestResultDto>
    startTask: (input: StartTaskInputDto) => Promise<StartTaskResultDto>
    loadTaskDiagnostics: () => Promise<AgentTaskDiagnosticsDto[]>
    subscribeTaskEvents: (callback: (event: TaskEventDto) => void) => () => void
  }
}
