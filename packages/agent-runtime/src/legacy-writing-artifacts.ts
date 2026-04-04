import type {
  ChapterDocumentDto,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { SubmittedTaskResult } from './live-agent-types'
import { buildProjectSurfaceSupportingLabel } from './agent-surface-policy'
import type { LegacyWritingProposal } from './legacy-writing-proposal'

export const buildLegacyWritingSubmittedResultArtifacts = (input: {
  shell: WorkspaceShellDto
  startInput: StartTaskInputDto
  chapter: ChapterDocumentDto
  proposal: LegacyWritingProposal
}): SubmittedTaskResult => ({
  status: 'waiting_approval',
  summary: '已经生成一版可应用的正文提议。',
  artifacts: [
    {
      kind: 'status',
      title: `${input.chapter.title} 的上下文已装配`,
      body: `当前任务会围绕“${input.chapter.objective}”继续推进，并优先贴合 ${input.shell.sceneList[0]?.title ?? '当前场景'}。`,
      supportingLabel: buildProjectSurfaceSupportingLabel(
        input.shell.project.title,
        input.startInput.surface
      )
    },
    {
      kind: 'evidence',
      title: '当前场景目标已命中',
      body: input.shell.sceneList[0]?.goal ?? input.chapter.objective,
      supportingLabel: `${input.chapter.title} / 场景目标`
    },
    {
      kind: 'proposal',
      title: input.proposal.title,
      body: input.proposal.body,
      supportingLabel: `${input.chapter.title} / 可直接应用`,
      proposalId: input.proposal.proposalId,
      diffPreview: {
        before: input.proposal.before,
        after: input.proposal.after
      }
    },
    {
      kind: 'approval',
      title: '正文提议等待确认',
      body: '这一版改写不会直接覆盖正文，请先在右栏接受、拒绝或要求再来一版。',
      supportingLabel: `${input.chapter.title} / 审批边界`,
      proposalId: input.proposal.proposalId
    }
  ]
})
