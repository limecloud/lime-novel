import type { StartTaskInputDto, WorkspaceShellDto } from '@lime-novel/application'
import type { SubmittedTaskResult } from './live-agent-types'
import { buildProjectSurfaceSupportingLabel } from './agent-surface-policy'

export const buildLegacyMissingAnalysisSampleResult = (input: {
  shell: WorkspaceShellDto
  startInput: StartTaskInputDto
}): SubmittedTaskResult => ({
  status: 'completed',
  summary: '当前没有可分析的爆款样本。',
  artifacts: [
    {
      kind: 'status',
      title: '拆书代理还没有拿到样本',
      body: '先导入至少一个爆款样本，再让拆书代理生成立项启发或对标建议。',
      supportingLabel: buildProjectSurfaceSupportingLabel(
        input.shell.project.title,
        input.startInput.surface
      )
    }
  ]
})

export const buildLegacyAnalysisSubmittedResultArtifacts = (input: {
  shell: WorkspaceShellDto
  sample: WorkspaceShellDto['analysisSamples'][number]
}): SubmittedTaskResult => {
  const overview = input.shell.analysisOverview

  return {
    status: 'completed',
    summary: '拆书结论与立项启发已同步到当前工作面。',
    artifacts: [
      {
        kind: 'status',
        title: `拆书代理已装配《${input.sample.title}》`,
        body: `当前已把 ${overview.sampleCount} 个样本的共性读进来，并优先围绕《${input.sample.title}》生成立项参考。`,
        supportingLabel: `${input.sample.sourceLabel} / ${input.sample.author}`
      },
      {
        kind: 'evidence',
        title: '样本钩子与人物吸引点已命中',
        body: `${input.sample.hookSummary} ${input.sample.characterSummary}`,
        supportingLabel: input.sample.tags.join(' / ')
      },
      {
        kind: input.sample.riskSignals.length > 0 ? 'issue' : 'evidence',
        title:
          input.sample.riskSignals.length > 0
            ? '样本风险边界需要保留'
            : '当前样本没有明显风险外露',
        body:
          input.sample.riskSignals[0] ??
          '当前样本最值得保留的是其题材承诺与角色反差之间的咬合方式。',
        supportingLabel: input.sample.pacingSummary,
        severity: input.sample.riskSignals.length > 0 ? 'medium' : undefined
      },
      {
        kind: 'status',
        title: '立项启发已整理',
        body: input.sample.inspirationSignals.join(' '),
        supportingLabel: `对标 ${input.shell.project.title} / ${overview.dominantTags.join('、') || input.shell.project.genre}`
      }
    ]
  }
}
