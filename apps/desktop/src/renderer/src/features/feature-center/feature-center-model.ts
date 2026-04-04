import type { WorkspaceSearchItemDto } from '@lime-novel/application'
import type { FeatureToolId } from '@lime-novel/domain-novel'
import { surfaceLabel } from '../workbench/workbench-navigation-model'

export const featureToolDefinitions: Array<{
  id: FeatureToolId
  label: string
  description: string
  emptyStateSummary: string
  activeStateSummary: (count: number) => string
}> = [
  {
    id: 'analysis',
    label: '拆书',
    description: '导入 `.txt`、`.md` 或 `.markdown` 文件，自动建立样本模型与项目启发。',
    emptyStateSummary: '导入 TXT / Markdown 自动开始拆解',
    activeStateSummary: (count) => `${count} 个样本已导入`
  }
]

export const featureToolLabel: Record<FeatureToolId, string> = {
  analysis: '拆书'
}

export const featureCenterEntry = {
  id: 'feature-center' as const,
  label: '功能中心',
  description: '插件式创作能力与辅助工具'
}

export const resolveFeatureToolLabel = (tool?: FeatureToolId): string =>
  tool ? featureToolLabel[tool] : featureCenterEntry.label

export const findFeatureToolDefinition = (tool: FeatureToolId) =>
  featureToolDefinitions.find((item) => item.id === tool)

export const resolveWorkspaceSearchSurfaceLabel = (item: WorkspaceSearchItemDto): string => {
  if (item.surface === 'feature-center' && item.featureTool) {
    return `${surfaceLabel[item.surface]} / ${featureToolLabel[item.featureTool]}`
  }

  return surfaceLabel[item.surface]
}
