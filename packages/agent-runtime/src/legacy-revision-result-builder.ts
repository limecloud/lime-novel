import type { LegacyAgentResultBuilderContext } from './legacy-agent-result-builder-context'
import type { SubmittedTaskResult } from './live-agent-types'
import { extractBodyParagraphs } from './legacy-agent-text-utils'
import {
  loadLegacyTargetChapter,
  saveLegacyGeneratedProposal,
  saveLegacyRevisionIssue
} from './legacy-agent-repository'
import { buildLegacyRevisionSubmittedResultArtifacts } from './legacy-revision-artifacts'
import { buildLegacyRevisionIssue } from './legacy-revision-issue'
import {
  buildLegacyRevisionProposal,
  shouldGenerateLegacyRevisionProposal
} from './legacy-revision-proposal'

export const buildLegacyRevisionSubmittedResult = async (
  context: LegacyAgentResultBuilderContext
): Promise<SubmittedTaskResult> => {
  const { repository, shell, input } = context
  const { chapterId, chapter } = await loadLegacyTargetChapter(context)
  const paragraphs = extractBodyParagraphs(chapter.content)
  const averageLength =
    paragraphs.length > 0
      ? Math.round(
          paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0) /
            paragraphs.length
        )
      : chapter.content.length

  const issue = buildLegacyRevisionIssue({
    shell,
    chapterId,
    averageParagraphLength: averageLength,
    intent: input.intent
  })

  await saveLegacyRevisionIssue(repository, issue)

  const proposal = shouldGenerateLegacyRevisionProposal(input.intent)
    ? buildLegacyRevisionProposal(chapter, issue, input.intent)
    : undefined

  if (proposal) {
    await saveLegacyGeneratedProposal({
      repository,
      chapterId,
      sourceSurface: 'revision',
      sourceIntent: input.intent,
      proposal,
      linkedIssueId: issue.issueId
    })
  }

  return buildLegacyRevisionSubmittedResultArtifacts({
    shell,
    startInput: input,
    chapterTitle: chapter.title,
    averageParagraphLength: averageLength,
    issue,
    proposal
  })
}
