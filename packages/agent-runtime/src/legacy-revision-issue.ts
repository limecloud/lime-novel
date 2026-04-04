import { createId } from '@lime-novel/shared-kernel'
import type { RevisionIssueDto, WorkspaceShellDto } from '@lime-novel/application'

export const buildLegacyRevisionIssue = (input: {
  shell: WorkspaceShellDto
  chapterId: string
  averageParagraphLength: number
  intent: string
}): RevisionIssueDto => {
  const title =
    input.intent.includes('视角')
      ? '视角边界待复核'
      : input.averageParagraphLength > 120
        ? '段落密度偏高'
        : '推进节点还可再收紧'
  const summary =
    input.intent.includes('视角')
      ? '需要确认叙述信息都仍然留在当前角色可感知范围内，避免越界说明。'
      : input.averageParagraphLength > 120
        ? '当前章节段落平均长度偏高，阅读呼吸点不足，建议拆句并提前动作落点。'
        : '当前章的推进仍然以解释为主，建议把动作和选择提前半步。'

  const existingIssue = input.shell.revisionIssues.find(
    (issue) => issue.chapterId === input.chapterId && issue.title === title
  )

  return {
    issueId: existingIssue?.issueId ?? createId('issue'),
    chapterId: input.chapterId,
    title,
    summary,
    severity: input.intent.includes('视角') ? 'high' : 'medium',
    status: 'open'
  }
}
