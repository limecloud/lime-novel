import type { LiveAgentExecutionSession } from './live-agent-execution-session'
import {
  advanceLiveAgentStepState,
  buildLiveAgentStepContinueResult,
  buildLiveAgentStepFailureResult,
  buildLiveAgentStepSuccessResult,
  buildLiveAgentStructuredOutputReminder,
  buildLiveAgentStructuredOutputRetryLimitDetail,
  type LiveAgentStepResult,
  type LiveAgentStepState
} from './live-agent-step-state'
import type { SubmittedTaskResult } from './live-agent-types'

type ContinueWithoutToolCallsInput = {
  executionSession: LiveAgentExecutionSession
  step: number
  state: LiveAgentStepState
  assistantText?: string
}

type ProjectLiveAgentStepOutcomeInput = {
  state: LiveAgentStepState
  assistantText?: string
  submittedResult?: SubmittedTaskResult
  submitTaskResultCallCountIncrement: number
  maxStructuredOutputRetries: number
}

export const continueLiveAgentStepWithoutToolCalls = async (
  input: ContinueWithoutToolCallsInput
): Promise<LiveAgentStepResult> => {
  await input.executionSession.appendMessage(
    {
      role: 'user',
      content: buildLiveAgentStructuredOutputReminder(input.assistantText)
    },
    input.step
  )

  return buildLiveAgentStepContinueResult(input.state)
}

export const projectLiveAgentStepOutcome = (
  input: ProjectLiveAgentStepOutcomeInput
): LiveAgentStepResult => {
  const finalState = advanceLiveAgentStepState(input.state, {
    submitTaskResultCallCountIncrement:
      input.submitTaskResultCallCountIncrement
  })

  if (input.submittedResult) {
    return buildLiveAgentStepSuccessResult(finalState, {
      submittedResult: input.submittedResult,
      assistantText: input.assistantText
    })
  }

  if (finalState.submitTaskResultCallCount >= input.maxStructuredOutputRetries) {
    return buildLiveAgentStepFailureResult(finalState, {
      subtype: 'error_max_structured_output_retries',
      detail: buildLiveAgentStructuredOutputRetryLimitDetail(
        finalState,
        input.maxStructuredOutputRetries
      ),
      assistantText: input.assistantText
    })
  }

  return buildLiveAgentStepContinueResult(finalState)
}
