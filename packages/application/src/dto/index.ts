import type {
  NovelAgentType,
  NovelSurfaceId,
  RiskLevel,
  TaskStatus
} from '@lime-novel/domain-novel'

export type NavigationItemDto = {
  id: NovelSurfaceId
  label: string
  description: string
}

export type ProjectSummaryDto = {
  projectId: string
  title: string
  subtitle: string
  status: string
  genre: string
  premise: string
  currentSurface: NovelSurfaceId
  currentChapterId: string
}

export type ChapterListItemDto = {
  chapterId: string
  order: number
  title: string
  summary: string
  status: string
  wordCount: number
  volumeLabel?: string
}

export type SceneListItemDto = {
  sceneId: string
  order: number
  title: string
  goal: string
  status: string
}

export type CanonCandidateDto = {
  cardId: string
  name: string
  kind: string
  summary: string
  visibility: string
  evidence: string
}

export type RevisionIssueDto = {
  issueId: string
  chapterId: string
  title: string
  summary: string
  severity: 'low' | 'medium' | 'high'
  status: 'open' | 'deferred' | 'resolved'
}

export type ExportPresetDto = {
  presetId: string
  title: string
  format: 'markdown' | 'pdf' | 'epub'
  status: 'draft' | 'ready'
  summary: string
}

export type HomeHighlightDto = {
  title: string
  detail: string
}

export type FeedActionDto =
  | {
      id: string
      label: string
      kind: 'prompt'
      prompt: string
    }
  | {
      id: string
      label: string
      kind: 'apply-proposal'
      proposalId: string
    }

export type AgentFeedItemDto = {
  itemId: string
  taskId: string
  kind: 'status' | 'evidence' | 'proposal' | 'issue' | 'approval'
  title: string
  body: string
  supportingLabel?: string
  severity?: RiskLevel
  proposalId?: string
  approvalId?: string
  diffPreview?: {
    before: string
    after: string
  }
  actions?: FeedActionDto[]
  createdAt: string
}

export type AgentTaskDto = {
  taskId: string
  title: string
  summary: string
  status: TaskStatus
  surface: NovelSurfaceId
  agentType: NovelAgentType
}

export type AgentHeaderDto = {
  currentAgent: string
  activeSubAgent?: string
  surface: NovelSurfaceId
  memorySources: string[]
  riskLevel: RiskLevel
}

export type QuickActionDto = {
  id: string
  label: string
  prompt: string
}

export type ExportHistoryDto = {
  exportId: string
  presetId: string
  generatedAt: string
  outputDir: string
  manifestPath: string
}

export type OpenProjectResultDto = {
  workspacePath: string
  projectId: string
  title: string
}

export type CreateProjectInputDto = {
  title: string
  genre: string
  premise: string
  template: 'blank' | 'mystery'
}

export type CreateProjectResultDto = {
  workspacePath: string
  projectId: string
  title: string
}

export type WorkspaceShellDto = {
  workspacePath: string
  project: ProjectSummaryDto
  navigation: NavigationItemDto[]
  chapterTree: ChapterListItemDto[]
  sceneList: SceneListItemDto[]
  homeHighlights: HomeHighlightDto[]
  canonCandidates: CanonCandidateDto[]
  revisionIssues: RevisionIssueDto[]
  exportPresets: ExportPresetDto[]
  agentHeader: AgentHeaderDto
  agentTasks: AgentTaskDto[]
  agentFeed: AgentFeedItemDto[]
  quickActions: QuickActionDto[]
  recentExports: ExportHistoryDto[]
}

export type ChapterDocumentDto = {
  chapterId: string
  title: string
  objective: string
  lastEditedAt: string
  wordCount: number
  content: string
}

export type ApplyProposalResultDto = {
  chapterId: string
  proposalId: string
  content: string
  summary: string
}

export type SaveChapterInputDto = {
  chapterId: string
  content: string
}

export type SaveChapterResultDto = {
  chapterId: string
  content: string
  wordCount: number
  lastEditedAt: string
  summary: string
}

export type UpdateWorkspaceContextInputDto = {
  surface: NovelSurfaceId
  chapterId?: string
}

export type CommitCanonCardInputDto = {
  cardId: string
  visibility: 'candidate' | 'confirmed' | 'archived'
}

export type CommitCanonCardResultDto = {
  cardId: string
  visibility: 'candidate' | 'confirmed' | 'archived'
  outputPath: string
  summary: string
}

export type UpdateRevisionIssueInputDto = {
  issueId: string
  status: 'open' | 'deferred' | 'resolved'
}

export type UpdateRevisionIssueResultDto = {
  issueId: string
  status: 'open' | 'deferred' | 'resolved'
  summary: string
}

export type CreateExportPackageInputDto = {
  presetId: string
  synopsis: string
  splitChapters: number
}

export type CreateExportPackageResultDto = {
  presetId: string
  outputDir: string
  manifestPath: string
  summary: string
}

export type StartTaskInputDto = {
  surface: NovelSurfaceId
  intent: string
  chapterId?: string
}

export type StartTaskResultDto = {
  task: AgentTaskDto
}

export type TaskEventDto =
  | {
      type: 'task.updated'
      task: AgentTaskDto
      header?: AgentHeaderDto
    }
  | {
      type: 'feed.item'
      item: AgentFeedItemDto
      header?: AgentHeaderDto
    }
