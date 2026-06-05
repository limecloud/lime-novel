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
  appServer?: {
    mode: 'external' | 'unconfigured'
    binaryPath?: string
    backendCommand?: string
  }
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

export type StoryChangeEventKindDto =
  | 'chapter-saved'
  | 'story-sync-requested'
  | 'character-line-updated'
  | 'foreshadowing-checked'
  | 'revision-impact-analyzed'
  | 'platform-risk-checked'
  | 'platform-risk-updated'
  | 'reader-feedback-imported'
  | 'change-set-undone'
  | 'derived-state-undone'

export type StoryChangeEventDto = {
  eventId: string
  projectId: string
  kind: StoryChangeEventKindDto
  sourceRef: HarnessTargetRefDto
  changedRefs: HarnessTargetRefDto[]
  summary: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export type StoryEventDto = {
  eventId: string
  projectId: string
  chapterId?: string
  title: string
  summary: string
  evidenceRefs: string[]
  occurredAt: string
}

export type StoryContextBundleSourceDto = {
  sourceId: string
  kind: HarnessTargetRefDto['kind'] | 'knowledge' | 'skill' | 'platform-rule'
  refId: string
  label: string
  reason: string
  excerpt?: string
  missing?: boolean
}

export type StoryContextBundleDto = {
  bundleId: string
  projectId: string
  triggerEventId: string
  taskId?: string
  sources: StoryContextBundleSourceDto[]
  missingSources: string[]
  selectedReason: string
  createdAt: string
}

export type HarnessTaskKindDto =
  | 'sync-story-state'
  | 'update-character-line'
  | 'check-foreshadowing'
  | 'analyze-revision-impact'
  | 'check-platform-risk'
  | 'import-reader-feedback'
  | 'undo-change-set'
  | 'undo-derived-state'

export type HarnessBusinessObjectRefDto = HarnessTargetRefDto & {
  objectPath?: string
}

export type HarnessTaskRunDto = {
  taskId: string
  taskKind: HarnessTaskKindDto
  title: string
  status: TaskStatus | 'blocked'
  businessObjectRef: HarnessBusinessObjectRefDto
  contextBundleId?: string
  skillRefs: Array<{
    skillId: string
    version: string
  }>
  riskLevel: HarnessSeverityDto
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export type HarnessActionDecisionDto = 'auto-apply' | 'requires-confirmation' | 'blocked'

export type HarnessActionDto = {
  actionId: string
  taskId: string
  actionType:
    | 'write-derived-state'
    | 'write-chapter'
    | 'raise-risk'
    | 'create-change-set'
    | 'create-protection-point'
    | 'undo-change-set'
  targetRef: HarnessTargetRefDto
  decision: HarnessActionDecisionDto
  status: 'pending' | 'applied' | 'blocked' | 'undone'
  summary: string
  riskLevel: HarnessSeverityDto
  createdAt: string
}

export type HarnessEvidenceDto = {
  evidenceId: string
  sourceRef: HarnessTargetRefDto
  summary: string
  locator?: string
  excerpt?: string
  createdAt: string
}

export type HarnessArtifactDto = {
  artifactId: string
  taskId: string
  kind:
    | 'context-bundle'
    | 'character-state'
    | 'foreshadowing-state'
    | 'impact-analysis'
    | 'platform-risk'
    | 'reader-feedback'
    | 'change-set'
    | 'sync-summary'
  title: string
  summary: string
  evidenceIds: string[]
  refId?: string
  createdAt: string
}

export type ProjectionDto = {
  projectionId: string
  kind: 'story-state' | 'character-line' | 'foreshadowing-line' | 'publish-risk' | 'time-machine'
  title: string
  summary: string
  sourceArtifactIds: string[]
  updatedAt: string
}

export type IntentRunDto = {
  runId: string
  projectId: string
  taskId: string
  authorIntent: string
  status: 'running' | 'completed' | 'waiting-confirmation' | 'failed' | 'undone'
  protectionPointId?: string
  changeSetIds: string[]
  createdAt: string
  completedAt?: string
}

export type ProtectionPointDto = {
  pointId: string
  projectId: string
  label: string
  summary: string
  chapterRefs: string[]
  derivedStateRefs: string[]
  snapshotPath: string
  createdAt: string
}

export type StoryPatchDto = {
  patchId: string
  targetKind: 'chapter' | 'character-state' | 'foreshadowing-state' | 'platform-risk' | 'reader-feedback'
  targetRef: HarnessTargetRefDto
  objectId?: string
  riskLevel: HarnessSeverityDto
  status: 'pending' | 'auto-applied' | 'blocked' | 'undone'
  before?: unknown
  after?: unknown
  evidenceIds: string[]
  summary: string
}

export type ChangeSetDto = {
  changeSetId: string
  projectId: string
  intentRunId?: string
  protectionPointId?: string
  contextBundleId?: string
  skillRefs?: Array<{
    skillId: string
    version: string
  }>
  title: string
  summary: string
  status: 'pending' | 'applied' | 'blocked' | 'undone'
  riskLevel: HarnessSeverityDto
  patches: StoryPatchDto[]
  affectedRefs: HarnessTargetRefDto[]
  createdAt: string
  appliedAt?: string
  undoneAt?: string
}

export type DraftBranchDto = {
  branchId: string
  projectId: string
  label: string
  status: 'drafting' | 'accepted' | 'discarded'
  baseProtectionPointId: string
  changeSetIds: string[]
  createdAt: string
  closedAt?: string
}

export type SkillCategoryDto = 'character' | 'foreshadowing' | 'compliance' | 'revision' | 'reader' | 'style'

export type SkillMetadataDto = {
  skillId: string
  version: string
  title: string
  description: string
  category: SkillCategoryDto
  enabled: boolean
  source: 'built-in' | 'project'
  sourcePath?: string
  updatedAt: string
}

export type SkillRunDto = {
  runId: string
  skillId: string
  version: string
  taskId: string
  status: 'completed' | 'failed' | 'blocked'
  summary: string
  createdAt: string
}

export type CharacterCurrentStateDto = {
  stateId: string
  characterId: string
  name: string
  currentGoal: string
  situation: string
  relationshipPressure: string
  knownInformation: string[]
  confidence: number
  evidenceChapterIds: string[]
  updatedAt: string
}

export type ForeshadowingLifecycleStatusDto = 'planted' | 'deepened' | 'misdirected' | 'resolved' | 'overdue' | 'needs-confirmation'

export type ForeshadowingStateDto = {
  threadId: string
  title: string
  status: ForeshadowingLifecycleStatusDto
  plantedChapterId: string
  latestChapterId: string
  evidence: string[]
  nextAction: string
  confidence: number
  updatedAt: string
}

export type PlatformRiskDto = {
  riskId: string
  platform: 'fanqie' | 'qidian' | 'general'
  ruleSource: string
  sourceUpdatedAt?: string
  locationRef: HarnessTargetRefDto
  severity: HarnessSeverityDto
  status: 'open' | 'exempted' | 'resolved'
  contextReason: string
  suggestion: string
  skillId: string
  skillVersion: string
  createdAt: string
  authorDecision?: {
    status: 'exempted' | 'resolved'
    reason: string
    decidedAt: string
  }
}

export type StorySyncRunDto = {
  syncRunId: string
  projectId: string
  status: 'running' | 'completed' | 'failed' | 'undone'
  trigger: 'chapter-save' | 'manual' | 'publish-check'
  protectionPointId: string
  contextBundleIds: string[]
  changeSetId?: string
  syncedChapterIds: string[]
  syncedCharacterIds: string[]
  syncedForeshadowingIds: string[]
  failedTasks: Array<{
    taskKind: HarnessTaskKindDto
    reason: string
  }>
  summary: string
  createdAt: string
  completedAt?: string
}

export type StoryStateDashboardDto = {
  currentProgress: string
  mainPressure: string
  primaryCharacterStates: CharacterCurrentStateDto[]
  unresolvedForeshadowing: ForeshadowingStateDto[]
  pacingRisks: DiagnosticFindingDto[]
  readerExpectations: ReaderFeedbackMappingDto[]
  platformRisks: PlatformRiskDto[]
  nextChapterMoves: string[]
  latestContextBundle?: StoryContextBundleDto
  recentChangeEvents: StoryChangeEventDto[]
  recentSyncRuns: StorySyncRunDto[]
  pendingActions: HarnessActionDto[]
  protectionPoints: ProtectionPointDto[]
  changeSets: ChangeSetDto[]
  enabledSkills: SkillMetadataDto[]
}

export type HarnessCommandInputDto =
  | {
      command: 'sync-story-state'
      chapterId?: string
      intent?: string
      triggerEventId?: string
    }
  | {
      command: 'update-character-line' | 'check-foreshadowing' | 'analyze-revision-impact'
      chapterId?: string
      intent?: string
    }
  | {
      command: 'check-platform-risk'
      chapterId?: string
      platform?: PlatformRiskDto['platform']
      intent?: string
    }
  | {
      command: 'import-reader-feedback'
      comments: string
      source?: string
    }
  | {
      command: 'toggle-skill'
      skillId: string
      enabled: boolean
    }
  | {
      command: 'update-platform-risk'
      riskId: string
      status: 'exempted' | 'resolved'
      reason?: string
    }
  | {
      command: 'undo-change-set'
      changeSetId: string
    }
  | {
      command: 'undo-derived-state'
      changeSetId?: string
    }

export type HarnessCommandResultDto = {
  command: HarnessCommandInputDto['command']
  summary: string
  taskId?: string
  protectionPointId?: string
  contextBundleId?: string
  changeSetId?: string
  syncRunId?: string
  affectedRefs: HarnessTargetRefDto[]
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
    | 'story-state'
    | 'platform-risk'
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
  storyEvents: StoryEventDto[]
  storyChangeEvents: StoryChangeEventDto[]
  storyContextBundles: StoryContextBundleDto[]
  harnessTasks: HarnessTaskRunDto[]
  harnessActions: HarnessActionDto[]
  harnessArtifacts: HarnessArtifactDto[]
  harnessEvidence: HarnessEvidenceDto[]
  projections: ProjectionDto[]
  intentRuns: IntentRunDto[]
  protectionPoints: ProtectionPointDto[]
  changeSets: ChangeSetDto[]
  draftBranches: DraftBranchDto[]
  skillCatalog: SkillMetadataDto[]
  skillRuns: SkillRunDto[]
  characterStates: CharacterCurrentStateDto[]
  foreshadowingStates: ForeshadowingStateDto[]
  platformRisks: PlatformRiskDto[]
  storySyncRuns: StorySyncRunDto[]
  storyState: StoryStateDashboardDto
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

export type StartTaskRuntimeOptionsDto = {
  metadata?: Record<string, unknown>
}

export type StartTaskInputDto = {
  surface: NovelSurfaceId
  intent: string
  chapterId?: string
  runtimeOptions?: StartTaskRuntimeOptionsDto
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
