import type {
  RevisionIssueDto,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { SubmittedTaskArtifact, SubmittedTaskResult } from './live-agent-types'
import { buildProjectSurfaceSupportingLabel } from './agent-surface-policy'
import type { LegacyRevisionProposal } from './legacy-revision-proposal'

export const buildLegacyRevisionSubmittedResultArtifacts = (input: {
  shell: WorkspaceShellDto
  startInput: StartTaskInputDto
  chapterTitle: string
  averageParagraphLength: number
  issue: RevisionIssueDto
  proposal?: LegacyRevisionProposal
}): SubmittedTaskResult => {
  const artifacts: SubmittedTaskArtifact[] = [
    {
      kind: 'status',
      title: '修订扫描已完成',
      body: `已对 ${input.chapterTitle} 做本地规则检查，并把问题队列同步回项目运行仓储。`,
      supportingLabel: buildProjectSurfaceSupportingLabel(
        input.shell.project.title,
        input.startInput.surface
      )
    },
    {
      kind: 'issue',
      title: input.issue.title,
      body: input.issue.summary,
      supportingLabel: `${input.chapterTitle} / 平均段长 ${input.averageParagraphLength} 字`,
      severity: input.issue.severity
    }
  ]

  if (input.proposal) {
    artifacts.push(
      {
        kind: 'proposal',
        title: input.proposal.title,
        body: input.proposal.body,
        supportingLabel: `${input.chapterTitle} / ${input.issue.title}`,
        proposalId: input.proposal.proposalId,
        linkedIssueId: input.issue.issueId,
        diffPreview: {
          before: input.proposal.before,
          after: input.proposal.after
        }
      },
      {
        kind: 'approval',
        title: '修订方案等待确认',
        body: '修订代理已经给出一版可应用方案。确认前不会直接改正文，适合先比较差异再决定。',
        supportingLabel: `${input.chapterTitle} / ${input.issue.title}`,
        proposalId: input.proposal.proposalId,
        linkedIssueId: input.issue.issueId
      }
    )
  }

  return {
    status: input.proposal ? 'waiting_approval' : 'completed',
    summary: input.proposal
      ? '修订问题与可应用方案已同步回当前项目。'
      : '修订问题已同步回当前项目。',
    artifacts
  }
}
