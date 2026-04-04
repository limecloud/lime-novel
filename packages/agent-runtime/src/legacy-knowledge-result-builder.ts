import type { LegacyAgentResultBuilderContext } from './legacy-agent-result-builder-context'
import type { SubmittedTaskResult } from './live-agent-types'
import { buildProjectSurfaceSupportingLabel } from './agent-surface-policy'

export const buildLegacyKnowledgeSubmittedResult = (
  context: LegacyAgentResultBuilderContext
): SubmittedTaskResult => {
  const { shell } = context

  return {
    status: 'completed',
    summary: '知识工作面已整理当前项目知识上下文。',
    artifacts: [
      {
        kind: 'status',
        title: '知识工作面已恢复',
        body: `当前项目已有 ${shell.knowledgeSummary.totalDocuments} 份知识资产，可继续围绕问题生成报告、核查冲突或补强章节摘要。`,
        supportingLabel: `${shell.knowledgeSummary.compiledDocuments} 页 compiled / ${shell.knowledgeSummary.outputDocuments} 份 outputs`
      },
      {
        kind: shell.knowledgeSummary.conflictedDocuments > 0 ? 'issue' : 'evidence',
        title:
          shell.knowledgeSummary.conflictedDocuments > 0
            ? '知识层仍有冲突待清理'
            : '知识层可继续服务写作',
        body:
          shell.knowledgeSummary.conflictedDocuments > 0
            ? `当前有 ${shell.knowledgeSummary.conflictedDocuments} 页知识资产标记为冲突，建议先处理高影响项。`
            : `最近结果包括：${shell.knowledgeDocuments.slice(0, 3).map((document) => document.title).join('、') || '等待更多知识页'}。`,
        supportingLabel: buildProjectSurfaceSupportingLabel(shell.project.title, 'knowledge'),
        severity: shell.knowledgeSummary.conflictedDocuments > 0 ? 'high' : undefined
      }
    ]
  }
}
