import type {
  CommitCanonCardInputDto,
  CommitCanonCardResultDto,
  CreateProjectInputDto,
  CreateProjectResultDto,
  CreateExportPackageInputDto,
  CreateExportPackageResultDto,
  OpenProjectResultDto,
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

export type DesktopApiContract = {
  workspace: {
    loadShell: () => Promise<WorkspaceShellDto>
    updateContext: (input: UpdateWorkspaceContextInputDto) => Promise<void>
    openProjectDialog: () => Promise<OpenProjectResultDto | null>
    createProject: (input: CreateProjectInputDto) => Promise<CreateProjectResultDto>
  }
  chapter: {
    loadDocument: (chapterId: string) => Promise<ChapterDocumentDto>
    saveDocument: (input: SaveChapterInputDto) => Promise<SaveChapterResultDto>
    applyProposal: (proposalId: string) => Promise<ApplyProposalResultDto>
  }
  canon: {
    commitCard: (input: CommitCanonCardInputDto) => Promise<CommitCanonCardResultDto>
  }
  revision: {
    updateIssue: (input: UpdateRevisionIssueInputDto) => Promise<UpdateRevisionIssueResultDto>
  }
  publish: {
    createExportPackage: (input: CreateExportPackageInputDto) => Promise<CreateExportPackageResultDto>
  }
  agent: {
    startTask: (input: StartTaskInputDto) => Promise<StartTaskResultDto>
    subscribeTaskEvents: (callback: (event: TaskEventDto) => void) => () => void
  }
}
