import type { WorkspaceShellDto } from '@lime-novel/application'

export const pickLegacyAnalysisSample = (
  shell: WorkspaceShellDto,
  intent: string
): WorkspaceShellDto['analysisSamples'][number] | undefined =>
  shell.analysisSamples.find((sample) => intent.includes(sample.title)) ??
  shell.analysisSamples[0]
