import type { LegacyAgentResultBuilderContext } from './legacy-agent-result-builder-context'
import type { SubmittedTaskResult } from './live-agent-types'
import {
  loadLegacyTargetChapter,
  saveLegacyCanonCandidates
} from './legacy-agent-repository'
import { buildLegacyCanonSubmittedResultArtifacts } from './legacy-canon-artifacts'
import { buildLegacyCanonCandidates } from './legacy-canon-candidates'

export const buildLegacyCanonSubmittedResult = async (
  context: LegacyAgentResultBuilderContext
): Promise<SubmittedTaskResult> => {
  const { repository, shell, input } = context
  const { chapter } = await loadLegacyTargetChapter(context)
  const cards = buildLegacyCanonCandidates({
    shell,
    chapter: {
      title: chapter.title,
      content: chapter.content,
      objective: chapter.objective
    }
  })

  await saveLegacyCanonCandidates(repository, cards)

  return buildLegacyCanonSubmittedResultArtifacts({
    shell,
    startInput: input,
    chapterTitle: chapter.title,
    cards
  })
}
