import {
  buildFeatureCenterSurfaceState,
  resolveWorkspaceRuntimeSurface
} from '@lime-novel/domain-novel'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'

export type AgentRuntimeSurface = Exclude<NovelSurfaceId, 'feature-center'>

const surfaceLabelMap: Record<AgentRuntimeSurface, string> = {
  home: '首页',
  writing: '写作工作面',
  knowledge: '知识工作面',
  analysis: '拆书工作面',
  canon: '设定工作面',
  revision: '修订工作面',
  publish: '发布工作面'
}

export const normalizeRuntimeSurface = (
  surface: NovelSurfaceId
): AgentRuntimeSurface =>
  resolveWorkspaceRuntimeSurface(
    surface === 'feature-center'
      ? buildFeatureCenterSurfaceState('analysis')
      : { surface }
  ) as AgentRuntimeSurface

export const getRuntimeSurfaceLabel = (surface: NovelSurfaceId): string =>
  surfaceLabelMap[normalizeRuntimeSurface(surface)]

export const buildProjectSurfaceSupportingLabel = (
  projectTitle: string,
  surface: NovelSurfaceId
): string => `${projectTitle} / ${getRuntimeSurfaceLabel(surface)}`
