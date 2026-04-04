import type { LegacyAgentResultBuilderContext } from './legacy-agent-result-builder-context'
import type { SubmittedTaskResult } from './live-agent-types'
import { buildProjectSurfaceSupportingLabel } from './agent-surface-policy'

export const buildLegacyHomeSubmittedResult = (
  context: LegacyAgentResultBuilderContext
): SubmittedTaskResult => {
  const { shell } = context
  const activeChapter =
    shell.chapterTree.find(
      (chapter) => chapter.chapterId === shell.project.currentChapterId
    ) ?? shell.chapterTree[0]
  const highRiskIssues = shell.revisionIssues.filter(
    (issue) => issue.severity === 'high'
  ).length

  return {
    status: 'completed',
    summary: '项目现场恢复完成。',
    artifacts: [
      {
        kind: 'status',
        title: '项目现场已恢复',
        body: `当前项目共 ${shell.chapterTree.length} 章、${shell.canonCandidates.length} 张候选设定卡，最近可以继续从 ${activeChapter?.title ?? '当前章节'} 往前。`,
        supportingLabel: buildProjectSurfaceSupportingLabel(shell.project.title, 'home')
      },
      {
        kind: highRiskIssues > 0 ? 'issue' : 'evidence',
        title: highRiskIssues > 0 ? '仍有高优先修订问题待处理' : '当前主链可继续推进',
        body:
          highRiskIssues > 0
            ? `当前还有 ${highRiskIssues} 个高风险问题，建议先切到修订工作面确认。`
            : `当前没有高风险阻塞，建议直接继续 ${activeChapter?.title ?? '当前章节'} 的正文推进。`,
        supportingLabel: `${shell.revisionIssues.length} 个修订问题 / ${shell.recentExports.length} 次导出`,
        severity: highRiskIssues > 0 ? 'high' : undefined
      }
    ]
  }
}
