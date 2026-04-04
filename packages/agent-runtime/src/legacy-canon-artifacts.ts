import type { CanonCandidateDto, StartTaskInputDto, WorkspaceShellDto } from '@lime-novel/application'
import type { SubmittedTaskResult } from './live-agent-types'
import { buildProjectSurfaceSupportingLabel } from './agent-surface-policy'

export const buildLegacyCanonSubmittedResultArtifacts = (input: {
  shell: WorkspaceShellDto
  startInput: StartTaskInputDto
  chapterTitle: string
  cards: CanonCandidateDto[]
}): SubmittedTaskResult => ({
  status: 'completed',
  summary: '候选设定已经写入当前项目。',
  artifacts: [
    {
      kind: 'status',
      title: '设定提取已完成',
      body: `已从 ${input.chapterTitle} 提炼出 ${input.cards.length} 张新的候选设定卡，并写入项目运行仓储。`,
      supportingLabel: buildProjectSurfaceSupportingLabel(
        input.shell.project.title,
        input.startInput.surface
      )
    },
    ...input.cards.map((card) => ({
      kind: 'evidence' as const,
      title: `候选设定：${card.name}`,
      body: card.summary,
      supportingLabel: card.evidence
    }))
  ]
})
