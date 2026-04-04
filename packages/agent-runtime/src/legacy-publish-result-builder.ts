import type { LegacyAgentResultBuilderContext } from './legacy-agent-result-builder-context'
import type { SubmittedTaskArtifact, SubmittedTaskResult } from './live-agent-types'
import { buildProjectSurfaceSupportingLabel } from './agent-surface-policy'
import {
  buildLegacyPublishComparisonArtifacts,
  buildLegacyPublishReviewArtifacts,
  buildLegacyPublishSynopsisArtifact
} from './legacy-publish-artifacts'

export const buildLegacyPublishSubmittedResult = (
  context: LegacyAgentResultBuilderContext
): SubmittedTaskResult => {
  const { shell, input } = context
  const intent = input.intent.trim()
  const wantsSynopsis = /(简介|文案|宣传)/u.test(intent)
  const wantsComparison = /(比较|差异|版本|变化)/u.test(intent)
  const wantsReview =
    /(确认|复核|导出|发布|预检)/u.test(intent) || (!wantsSynopsis && !wantsComparison)
  const artifacts: SubmittedTaskArtifact[] = [
    {
      kind: 'status',
      title: '发布上下文已装配',
      body: `当前项目版本为 ${shell.project.releaseVersion}，发布代理已读取导出预设、最近导出与版本比较结果。`,
      supportingLabel: buildProjectSurfaceSupportingLabel(shell.project.title, input.surface)
    }
  ]

  if (wantsComparison) {
    artifacts.push(...buildLegacyPublishComparisonArtifacts(shell))
  }

  if (wantsSynopsis) {
    artifacts.push(buildLegacyPublishSynopsisArtifact(shell))
  }

  if (wantsReview) {
    artifacts.push(...buildLegacyPublishReviewArtifacts(shell))
  }

  const finalSummary =
    wantsSynopsis && wantsComparison
      ? '发布文案与版本比较已同步到当前项目。'
      : wantsSynopsis
        ? '发布文案草案已生成。'
        : wantsComparison
          ? '发布版本差异已同步。'
          : '发布预检与确认建议已完成。'

  return {
    status: 'completed',
    summary: finalSummary,
    artifacts
  }
}
