export type NovelSurfaceId =
  | 'home'
  | 'writing'
  | 'knowledge'
  | 'feature-center'
  | 'analysis'
  | 'canon'
  | 'revision'
  | 'publish'

export type NovelAgentType = 'project' | 'chapter' | 'knowledge' | 'analysis' | 'canon' | 'revision' | 'publish'

export type FeatureToolId = 'analysis'

export type WorkspaceSurfaceState = {
  surface: NovelSurfaceId
  featureTool?: FeatureToolId
}

export const normalizeWorkspaceSurfaceState = (
  surface: NovelSurfaceId,
  featureTool?: FeatureToolId
): WorkspaceSurfaceState => {
  if (surface === 'analysis') {
    return {
      surface: 'feature-center',
      featureTool: 'analysis'
    }
  }

  return {
    surface,
    featureTool: surface === 'feature-center' ? featureTool : undefined
  }
}

export const buildFeatureCenterSurfaceState = (featureTool?: FeatureToolId): WorkspaceSurfaceState => ({
  surface: 'feature-center',
  featureTool
})

export const resolveWorkspaceRuntimeSurface = (state: WorkspaceSurfaceState): NovelSurfaceId => {
  if (state.surface !== 'feature-center') {
    return state.surface
  }

  return state.featureTool === 'analysis' ? 'analysis' : 'home'
}

export type TaskStatus = 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed'

export type RiskLevel = 'low' | 'medium' | 'high'

export type Series = {
  seriesId: string
  title: string
  summary?: string
  status: 'planning' | 'active' | 'paused' | 'completed'
}

export type Project = {
  projectId: string
  title: string
  subtitle: string
  status: 'planning' | 'drafting' | 'revising' | 'publishing'
  language: string
  genre: string
  premise: string
  currentSurface: NovelSurfaceId
  currentFeatureTool?: FeatureToolId
  currentChapterId: string
}

export type Volume = {
  volumeId: string
  projectId: string
  order: number
  title: string
  summary: string
}

export type Chapter = {
  chapterId: string
  projectId: string
  volumeId?: string
  order: number
  title: string
  summary: string
  status: 'idea' | 'draft' | 'reviewing' | 'revised' | 'published'
  wordCount: number
}

export type Scene = {
  sceneId: string
  chapterId: string
  order: number
  title: string
  goal: string
  status: 'planned' | 'drafting' | 'completed' | 'revised'
}

export type CanonCard = {
  cardId: string
  kind: 'character' | 'location' | 'faction' | 'rule' | 'item' | 'timeline-event'
  name: string
  summary: string
  visibility: 'confirmed' | 'candidate' | 'archived'
  evidence: string
}

export type RevisionIssue = {
  issueId: string
  chapterId: string
  title: string
  summary: string
  severity: 'low' | 'medium' | 'high'
}

export type RevisionProposal = {
  proposalId: string
  chapterId: string
  title: string
  before: string
  after: string
  reason: string
}

export type ApprovalRequest = {
  approvalId: string
  taskId: string
  title: string
  summary: string
  riskLevel: RiskLevel
}

export type ExportPreset = {
  presetId: string
  title: string
  format: 'markdown' | 'pdf' | 'epub'
  status: 'draft' | 'ready'
  summary: string
}
