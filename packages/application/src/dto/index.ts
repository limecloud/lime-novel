import type {
  FeatureToolId,
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
  lifecycleMode: NovelLifecycleModeDto
  publishedChapterRefs: string[]
  lockedChapterRefs: string[]
  releaseVersion: string
  lastPublishedAt?: string
  currentSurface: NovelSurfaceId
  currentFeatureTool?: FeatureToolId
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
  severity: RiskLevel
  status: 'open' | 'deferred' | 'resolved'
}

export type RevisionRecordStatus = 'applied' | 'undone'

export type RevisionRecordDto = {
  recordId: string
  proposalId: string
  chapterId: string
  chapterTitle: string
  title: string
  summary: string
  beforePreview: string
  afterPreview: string
  sourceSurface: NovelSurfaceId
  linkedIssueId?: string
  status: RevisionRecordStatus
  canUndo: boolean
  snapshotPath: string
  createdAt: string
  undoneAt?: string
}

export type ExportPresetDto = {
  presetId: string
  title: string
  format: 'markdown' | 'epub'
  status: 'draft' | 'ready'
  summary: string
}

export type AnalysisScoreDto = {
  hookStrength: number
  characterHeat: number
  pacingMomentum: number
  feedbackResonance: number
}

export type AnalysisSampleDto = {
  sampleId: string
  title: string
  author: string
  sourceLabel: string
  synopsis: string
  excerpt: string[]
  comments: string[]
  tags: string[]
  importedAt: string
  scores: AnalysisScoreDto
  hookSummary: string
  characterSummary: string
  pacingSummary: string
  readerSignals: string[]
  riskSignals: string[]
  inspirationSignals: string[]
}

export type AnalysisOverviewDto = {
  sampleCount: number
  dominantTags: string[]
  strongestSignals: string[]
  cautionSignals: string[]
  projectAngles: string[]
  averageScores: AnalysisScoreDto
}

export type HomeHighlightDto = {
  title: string
  detail: string
}

export type ProposalApprovalStatus = 'pending' | 'accepted' | 'rejected'

export type FeedActionDto =
  | {
      id: string
      label: string
      kind: 'prompt'
      prompt: string
      surface?: NovelSurfaceId
    }
  | {
      id: string
      label: string
      kind: 'apply-proposal'
      proposalId: string
    }
  | {
      id: string
      label: string
      kind: 'reject-proposal'
      proposalId: string
    }
  | {
      id: string
      label: string
      kind: 'apply-publish-synopsis'
      value: string
    }
  | {
      id: string
      label: string
      kind: 'apply-publish-notes'
      value: string
    }
  | {
      id: string
      label: string
      kind: 'open-publish-confirm'
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
  approvalStatus?: ProposalApprovalStatus
  linkedIssueId?: string
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

export type AgentTraceEntryDto = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  turnIndex: number
  content?: string
  toolCallId?: string
  toolName?: string
  toolCalls?: Array<{
    id: string
    name: string
  }>
  stopReason?: string
}

export type AgentToolEventDto = {
  turnIndex: number
  toolCallId: string
  toolName: string
  status: 'requested' | 'rejected' | 'started' | 'completed' | 'failed'
  isConcurrencySafe: boolean
  progressLabel?: string
  error?: string
  isStructuredOutputTool?: boolean
}

export type AgentTaskFailureDto = {
  subtype: 'error_max_turns' | 'error_max_structured_output_retries' | 'error_during_execution'
  detail: string
  providerCode?: string
  stopReason?: string
  turnCount: number
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export type AgentTaskExecutionStatsDto = {
  turnCount: number
  stopReason?: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
}

export type AgentTaskDiagnosticsDto = {
  taskId: string
  trace: AgentTraceEntryDto[]
  toolEvents: AgentToolEventDto[]
  stats: AgentTaskExecutionStatsDto
  failure?: AgentTaskFailureDto
  updatedAt: string
}

export type AgentRuntimeProviderDto = 'legacy' | 'anthropic' | 'openai-compatible'

export type AgentRuntimeSettingsDto = {
  provider: AgentRuntimeProviderDto
  baseUrl: string
  apiKey: string
  model: string
}

export type AgentRuntimeSettingsStateDto = {
  settings: AgentRuntimeSettingsDto
  resolvedProvider: AgentRuntimeProviderDto
  resolvedBaseUrl: string
  resolvedModel: string
  mode: 'legacy' | 'live'
}

export type AgentRuntimeConnectionTestResultDto = {
  mode: 'legacy' | 'live'
  provider: AgentRuntimeProviderDto
  model: string
  baseUrl: string
  latencyMs: number
  summary: string
  responseText?: string
  stopReason?: string
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
  versionTag: string
  format: 'markdown' | 'epub'
  generatedAt: string
  synopsis: string
  splitChapters: number
  notes: string
  platformFeedback: string[]
  previousVersionTag?: string
  fileCount: number
  files: string[]
  outputDir: string
  manifestPath: string
}

export type ExportComparisonDto = {
  currentExportId: string
  previousExportId: string
  currentVersionTag: string
  previousVersionTag: string
  currentGeneratedAt: string
  previousGeneratedAt: string
  summary: string
  riskLevel: RiskLevel
  changedFields: string[]
  synopsisDelta: number
  splitChaptersDelta: number
  fileCountDelta: number
  addedFeedback: string[]
  removedFeedback: string[]
}

export type NovelLifecycleModeDto = 'sandbox' | 'timeline'

export type HarnessLayerDto = 'story' | 'character' | 'reader'

export type HarnessSeverityDto = RiskLevel | 'blocking'

export type HarnessProfileDto = {
  profileId: string
  projectId: string
  mode: NovelLifecycleModeDto
  layers: HarnessLayerDto[]
  constraints: string[]
  updatedAt: string
}

export type HarnessTargetRefDto = {
  refId: string
  kind: 'project' | 'chapter' | 'scene' | 'character' | 'canon' | 'foreshadowing' | 'export' | 'feedback'
  label: string
}

export type DiagnosticFindingDto = {
  findingId: string
  area:
    | 'structure'
    | 'pacing'
    | 'character'
    | 'foreshadowing'
    | 'info-gap'
    | 'continuity'
    | 'golden-three'
    | 'worldbuilding'
    | 'reader-risk'
    | 'publishing'
  harnessLayer: HarnessLayerDto
  severity: HarnessSeverityDto
  targetRefs: string[]
  evidence: string[]
  diagnosis: string
  recommendation: string
}

export type DiagnosticReportDto = {
  reportId: string
  projectId: string
  mode: NovelLifecycleModeDto
  scope: {
    kind: 'chapter' | 'range' | 'volume' | 'project' | 'golden-three'
    targetRefs: string[]
  }
  summary: string
  goldenThree?: Record<string, unknown>
  findings: DiagnosticFindingDto[]
  generatedAt: string
  metadata?: Record<string, unknown>
}

export type ImpactAffectedRefDto = {
  ref: string
  kind?: HarnessTargetRefDto['kind']
  impact: string
  requiredAction: string
}

export type ImpactAnalysisDto = {
  impactId: string
  projectId: string
  mode: NovelLifecycleModeDto
  authorIntent: string
  sourceChange: string
  riskLevel: HarnessSeverityDto
  affectedRefs: ImpactAffectedRefDto[]
  risks: string[]
  recommendations: string[]
  createdAt: string
  metadata?: Record<string, unknown>
}

export type IntentPlanOptionDto = {
  optionId: string
  label: string
  summary: string
  edits: string[]
  benefits: string[]
  costs: string[]
  risks: string[]
  impactRef?: string
}

export type IntentPlanDto = {
  planId: string
  projectId: string
  mode: NovelLifecycleModeDto
  authorIntent: string
  options: IntentPlanOptionDto[]
  decision?: {
    selectedOptionId?: string
    reason?: string
    rejectedOptionIds?: string[]
  }
  createdAt: string
  metadata?: Record<string, unknown>
}

export type ReaderFeedbackMappingDto = {
  category: 'chapter' | 'character' | 'pacing' | 'canon' | 'foreshadowing' | 'expectation' | 'publish'
  targetRefs: string[]
  confidence: number
  interpretation: string
  recommendedAction: string
}

export type ReaderFeedbackDto = {
  feedbackId: string
  projectId: string
  source: string
  items: Array<{
    itemId: string
    summary: string
    sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed'
    sourceRef?: string
  }>
  mappings: ReaderFeedbackMappingDto[]
  collectedAt: string
  metadata?: Record<string, unknown>
}

export type TimelineIterationDto = {
  iterationId: string
  projectId: string
  trigger: string
  strategy:
    | 'retroactive-echo'
    | 'future-bridge'
    | 'foreshadowing-recovery'
    | 'character-reframing'
    | 'reader-expectation-reset'
  targetFutureRefs: string[]
  readOnlyPublishedRefs: string[]
  readerExperienceRisk: string
  retconRisk: 'none' | 'low' | 'medium' | 'high'
  proposalRefs?: string[]
  createdAt: string
  metadata?: Record<string, unknown>
}

export type HarnessLockDto = {
  lockId: string
  projectId: string
  versionTag: string
  modeBefore: NovelLifecycleModeDto
  modeAfter: 'timeline'
  lockedAt: string
  publishedChapterRefs: string[]
  lockedChapterRefs: string[]
  diagnosticReportId?: string
  unresolvedHighRiskIssueIds: string[]
  exportManifestPath: string
  summary: string
  metadata?: Record<string, unknown>
}

export type OpenProjectResultDto = {
  workspacePath: string
  projectId: string
  title: string
}

export type WorkspaceSearchInputDto = {
  query: string
  limit?: number
}

export type KnowledgeDocumentBucketDto = 'raw' | 'compiled' | 'canon' | 'output'

export type KnowledgeDocumentKindDto = 'source' | 'knowledge-page' | 'canon-card' | 'query-output'

export type KnowledgeDocumentStatusDto =
  | 'reference'
  | 'candidate'
  | 'confirmed'
  | 'conflicted'
  | 'stale'
  | 'generated'

export type KnowledgeDocumentDto = {
  documentId: string
  title: string
  kind: KnowledgeDocumentKindDto
  bucket: KnowledgeDocumentBucketDto
  type: string
  status: KnowledgeDocumentStatusDto
  summary: string
  relativePath: string
  updatedAt?: string
  sourceCount: number
  relatedCount: number
}

export type KnowledgeDocumentDetailDto = KnowledgeDocumentDto & {
  excerpt: string
  content: string
  sources: string[]
  related: string[]
}

export type KnowledgeSummaryDto = {
  totalDocuments: number
  rawDocuments: number
  compiledDocuments: number
  canonDocuments: number
  outputDocuments: number
  conflictedDocuments: number
  staleDocuments: number
  lastGeneratedAt?: string
}

export type WorkspaceSearchItemDto = {
  itemId: string
  kind:
    | 'project'
    | 'chapter'
    | 'scene'
    | 'analysis-sample'
    | 'canon-card'
    | 'revision-issue'
    | 'export-preset'
    | 'knowledge-document'
    | 'knowledge-output'
  title: string
  snippet: string
  surface: NovelSurfaceId
  featureTool?: FeatureToolId
  chapterId?: string
  entityId?: string
  score: number
}

export type WorkspaceSearchResultDto = {
  query: string
  items: WorkspaceSearchItemDto[]
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
  harnessProfile: HarnessProfileDto
  navigation: NavigationItemDto[]
  chapterTree: ChapterListItemDto[]
  sceneList: SceneListItemDto[]
  homeHighlights: HomeHighlightDto[]
  knowledgeSummary: KnowledgeSummaryDto
  knowledgeDocuments: KnowledgeDocumentDto[]
  knowledgeRecentOutputs: KnowledgeDocumentDto[]
  analysisOverview: AnalysisOverviewDto
  analysisSamples: AnalysisSampleDto[]
  canonCandidates: CanonCandidateDto[]
  revisionIssues: RevisionIssueDto[]
  revisionRecords: RevisionRecordDto[]
  exportPresets: ExportPresetDto[]
  agentHeader: AgentHeaderDto
  agentTasks: AgentTaskDto[]
  agentFeed: AgentFeedItemDto[]
  quickActions: QuickActionDto[]
  recentExports: ExportHistoryDto[]
  latestExportComparison?: ExportComparisonDto
  diagnosticReports: DiagnosticReportDto[]
  impactAnalyses: ImpactAnalysisDto[]
  intentPlans: IntentPlanDto[]
  readerFeedback: ReaderFeedbackDto[]
  timelineIterations: TimelineIterationDto[]
  harnessLocks: HarnessLockDto[]
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

export type RejectProposalResultDto = {
  chapterId: string
  proposalId: string
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
  featureTool?: FeatureToolId
  chapterId?: string
}

export type GenerateKnowledgeAnswerInputDto = {
  question: string
  format: 'report' | 'brief'
}

export type GenerateKnowledgeAnswerResultDto = {
  documentId: string
  title: string
  relativePath: string
  outputPath: string
  summary: string
  excerpt: string
}

export type ImportKnowledgeDocumentInputDto = {
  filePath: string
}

export type ImportKnowledgeDocumentResultDto = {
  documentId: string
  title: string
  relativePath: string
  outputPath: string
  summary: string
  excerpt: string
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

export type UndoRevisionRecordResultDto = {
  recordId: string
  chapterId: string
  content: string
  summary: string
}

export type CreateExportPackageInputDto = {
  presetId: string
  synopsis: string
  splitChapters: number
  versionTag: string
  notes: string
}

export type CreateExportPackageResultDto = {
  presetId: string
  versionTag: string
  outputDir: string
  manifestPath: string
  summary: string
}

export type ImportAnalysisSampleInputDto = {
  filePath: string
}

export type ImportAnalysisSampleResultDto = {
  sampleId: string
  title: string
  summary: string
}

export type ApplyProjectStrategyProposalInputDto = {
  sampleId: string
}

export type ApplyProjectStrategyProposalResultDto = {
  sampleId: string
  createdCanonCardIds: string[]
  createdQuickActionIds: string[]
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
  | {
      type: 'task.diagnostics'
      diagnostics: AgentTaskDiagnosticsDto
      header?: AgentHeaderDto
    }
