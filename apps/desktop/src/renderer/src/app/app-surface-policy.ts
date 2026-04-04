import {
  buildWorkspaceAgentHeader
} from '@lime-novel/application'
import {
  buildFeatureCenterSurfaceState,
  normalizeWorkspaceSurfaceState,
  resolveWorkspaceRuntimeSurface
} from '@lime-novel/domain-novel'
import type { FeatureToolId, NovelSurfaceId } from '@lime-novel/domain-novel'
import type { AgentSidebarMode } from '../features/agent-feed/AgentSidebar'

export { normalizeWorkspaceSurfaceState } from '@lime-novel/domain-novel'

export const resolveSidebarModeForSurface = (surface: NovelSurfaceId): AgentSidebarMode =>
  surface === 'writing' ? 'dialogue' : 'suggestions'

export const buildFeatureToolSurfaceState = (featureTool?: FeatureToolId) =>
  buildFeatureCenterSurfaceState(featureTool)

export const resolveRuntimeSurface = (state: {
  surface: NovelSurfaceId
  featureTool?: FeatureToolId
}): NovelSurfaceId => resolveWorkspaceRuntimeSurface(state)

export const buildSurfaceHeaderFallback = (surface: NovelSurfaceId) =>
  buildWorkspaceAgentHeader(surface)
