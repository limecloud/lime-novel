import type { SubmittedTaskArtifact } from './live-agent-types'
import type { WorkspaceShellDto } from '@lime-novel/application'
import { buildLegacyPublishSynopsisDraft } from './legacy-publish-drafts'
import { buildLegacyPublishComparisonArtifacts as buildComparisonArtifacts } from './legacy-publish-comparison-artifacts'
import { buildLegacyPublishReviewArtifacts as buildReviewArtifacts } from './legacy-publish-review-artifacts'

export const buildLegacyPublishComparisonArtifacts = (
  shell: WorkspaceShellDto
): SubmittedTaskArtifact[] => buildComparisonArtifacts(shell)

export const buildLegacyPublishSynopsisArtifact = (
  shell: WorkspaceShellDto
): SubmittedTaskArtifact => ({
  kind: 'evidence',
  title: '平台简介草案已生成',
  body: buildLegacyPublishSynopsisDraft(shell),
  supportingLabel: '发布参数 / 可直接回填简介',
  template: 'publish-synopsis-draft'
})

export const buildLegacyPublishReviewArtifacts = (
  shell: WorkspaceShellDto
): SubmittedTaskArtifact[] => buildReviewArtifacts(shell)
