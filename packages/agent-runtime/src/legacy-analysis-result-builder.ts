import type { LegacyAgentResultBuilderContext } from './legacy-agent-result-builder-context'
import type { SubmittedTaskResult } from './live-agent-types'
import {
  buildLegacyAnalysisSubmittedResultArtifacts,
  buildLegacyMissingAnalysisSampleResult
} from './legacy-analysis-artifacts'
import { pickLegacyAnalysisSample } from './legacy-analysis-sample'

export const buildLegacyAnalysisSubmittedResult = (
  context: LegacyAgentResultBuilderContext
): SubmittedTaskResult => {
  const { shell, input } = context
  const sample = pickLegacyAnalysisSample(shell, input.intent)

  if (!sample) {
    return buildLegacyMissingAnalysisSampleResult({
      shell,
      startInput: input
    })
  }

  return buildLegacyAnalysisSubmittedResultArtifacts({
    shell,
    sample
  })
}
