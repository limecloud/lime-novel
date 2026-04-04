import type { LegacyAgentResultBuilderContext } from './legacy-agent-result-builder-context'
import type { SubmittedTaskResult } from './live-agent-types'
import {
  loadLegacyTargetChapter,
  saveLegacyGeneratedProposal
} from './legacy-agent-repository'
import { buildLegacyWritingSubmittedResultArtifacts } from './legacy-writing-artifacts'
import { buildLegacyWritingProposal } from './legacy-writing-proposal'

export const buildLegacyWritingSubmittedResult = async (
  context: LegacyAgentResultBuilderContext
): Promise<SubmittedTaskResult> => {
  const { shell, input, repository } = context
  const { chapterId, chapter } = await loadLegacyTargetChapter(context)
  const proposal = buildLegacyWritingProposal(shell, chapter, input.intent)

  await saveLegacyGeneratedProposal({
    repository,
    chapterId,
    sourceSurface: 'writing',
    sourceIntent: input.intent,
    proposal
  })

  return buildLegacyWritingSubmittedResultArtifacts({
    shell,
    startInput: input,
    chapter,
    proposal
  })
}
