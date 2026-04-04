import type { WorkspaceShellDto } from '@lime-novel/application'
import { toSnippet } from './legacy-agent-text-utils'

export const buildLegacyPublishSynopsisDraft = (
  shell: WorkspaceShellDto
): string => {
  const premise = shell.project.premise.replace(/\s+/g, ' ').trim()
  const latestExport = shell.recentExports[0]
  const comparison = shell.latestExportComparison

  return [
    `《${shell.project.title}》是一部${shell.project.genre}长篇小说，围绕${toSnippet(premise, 42)}持续推进。`,
    latestExport
      ? `当前准备发布的 ${latestExport.versionTag} 后续版本，会延续既有悬念，同时把主角欲望与代价说得更清楚。`
      : '当前准备发布的是首个正式版本，需要先把主角处境、核心冲突和持续悬念一起交代清楚。',
    comparison?.changedFields.includes('平台简介')
      ? '最近两版的平台简介已经发生变化，建议继续保留“人物处境 + 主线秘密 + 下一步危险”这三层结构。'
      : '简介建议保持“人物处境 + 主线秘密 + 下一步危险”的三层结构，避免只剩题材概括。'
  ].join('')
}

export const buildLegacyPublishNotesDraft = (
  shell: WorkspaceShellDto
): string => {
  const latestExport = shell.recentExports[0]
  const comparison = shell.latestExportComparison
  const highRiskIssues = shell.revisionIssues.filter(
    (issue) => issue.severity === 'high' && issue.status !== 'resolved'
  )
  const leadingRisk = comparison?.addedFeedback[0] ?? highRiskIssues[0]?.title

  return [
    latestExport
      ? `延续 ${latestExport.versionTag} 的发布基线，聚焦本轮正文推进、简介更新与平台化资产复核。`
      : `首个正式导出版本将围绕《${shell.project.title}》建立发布基线，并同步生成完整平台资产。`,
    comparison?.changedFields.length
      ? `这次重点变化包括：${comparison.changedFields.join('、')}。`
      : '这次导出延续既有发布参数，重点确认版本号、简介和拆章是否仍然成立。',
    leadingRisk
      ? `确认前仍需复看：${leadingRisk}。`
      : '当前没有新增高风险阻塞，可以在确认单里继续核对版本与备注后导出。'
  ].join('')
}
