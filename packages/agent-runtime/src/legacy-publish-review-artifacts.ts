import type { WorkspaceShellDto } from '@lime-novel/application'
import type { SubmittedTaskArtifact } from './live-agent-types'
import { buildLegacyPublishNotesDraft } from './legacy-publish-drafts'

export const buildLegacyPublishReviewArtifacts = (
  shell: WorkspaceShellDto
): SubmittedTaskArtifact[] => {
  const latestExport = shell.recentExports[0]
  const comparison = shell.latestExportComparison
  const draftPresetCount = shell.exportPresets.filter(
    (preset) => preset.status === 'draft'
  ).length

  return [
    {
      kind:
        draftPresetCount > 0 || comparison?.riskLevel === 'high'
          ? 'issue'
          : latestExport
            ? 'evidence'
            : 'status',
      title: '发布校验结果已生成',
      body:
        draftPresetCount > 0
          ? `当前还有 ${draftPresetCount} 个草稿预设未补齐，公开发布前建议优先确认格式与元数据。`
          : comparison?.riskLevel === 'high'
            ? `最近版本比较仍有高风险项：${comparison.addedFeedback[0] ?? comparison.summary}`
            : latestExport
              ? `最近导出 ${latestExport.versionTag} 已包含 ${latestExport.fileCount} 个产物，可继续进入确认单决定是否发布新版本。`
              : '当前没有历史导出，可以直接以首个正式版本进入确认单。',
      supportingLabel: `${shell.exportPresets.length} 个导出预设 / ${shell.recentExports.length} 次导出`,
      severity:
        comparison?.riskLevel === 'high'
          ? 'high'
          : draftPresetCount > 0
            ? 'medium'
            : undefined
    },
    {
      kind: 'evidence',
      title: '发布备注草案已生成',
      body: buildLegacyPublishNotesDraft(shell),
      supportingLabel: '发布参数 / 可直接回填备注',
      template: 'publish-notes-draft'
    },
    {
      kind: 'status',
      body:
        comparison?.riskLevel === 'high'
          ? '建议先处理新增平台反馈，再执行最终导出确认，避免把高风险版本直接推进到公开发布。'
          : '当前可以进入发布工作面的确认单，核对版本号、简介、拆章与发布备注后再执行导出。',
      template: 'publish-confirm-suggestion'
    }
  ]
}
