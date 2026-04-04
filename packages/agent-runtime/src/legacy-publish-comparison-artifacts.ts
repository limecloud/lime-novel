import type { WorkspaceShellDto } from '@lime-novel/application'
import type { SubmittedTaskArtifact } from './live-agent-types'

export const buildLegacyPublishComparisonArtifacts = (
  shell: WorkspaceShellDto
): SubmittedTaskArtifact[] => {
  const latestExport = shell.recentExports[0]
  const comparison = shell.latestExportComparison

  if (!comparison) {
    return [
      {
        kind: 'evidence',
        title: '当前还不足以比较版本',
        body:
          latestExport != null
            ? `当前只有 ${latestExport.versionTag} 一次正式导出，再完成一版后才能生成真实版本比较。`
            : '当前项目还没有正式导出记录，需要先完成第一次导出后才能比较版本差异。',
        supportingLabel: `${shell.recentExports.length} 次最近导出`
      }
    ]
  }

  return [
    {
      kind: comparison.riskLevel === 'high' ? 'issue' : 'evidence',
      title: '最近两次版本比较已完成',
      body: comparison.summary,
      supportingLabel: `${comparison.previousVersionTag} -> ${comparison.currentVersionTag}`,
      severity: comparison.riskLevel === 'low' ? undefined : comparison.riskLevel
    },
    {
      kind:
        comparison.addedFeedback.length > 0 && comparison.riskLevel !== 'low'
          ? 'issue'
          : 'evidence',
      title:
        comparison.addedFeedback.length > 0
          ? '新增平台反馈需要确认'
          : '最近版本反馈已收口',
      body:
        comparison.addedFeedback.length > 0
          ? comparison.addedFeedback.join('；')
          : comparison.removedFeedback.length > 0
            ? `已消除的反馈：${comparison.removedFeedback.join('；')}`
            : '最近两次导出之间没有新增平台反馈，当前参数可以继续沿用。',
      supportingLabel: comparison.changedFields.join(' / ') || '暂无参数变化',
      severity:
        comparison.addedFeedback.length > 0 && comparison.riskLevel === 'high'
          ? 'high'
          : undefined
    }
  ]
}
