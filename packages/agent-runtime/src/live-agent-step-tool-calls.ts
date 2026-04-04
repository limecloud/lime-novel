import { LiveAgentExecutionSession } from './live-agent-execution-session'
import {
  executePreparedToolCall,
  prepareToolCall,
  toToolEvent,
  validateToolCalls
} from './live-agent-tool-execution'
import { runToolCalls } from './live-agent-tool-orchestration'
import { SUBMIT_TASK_RESULT_TOOL_NAME } from './live-agent-result-tool'
import type {
  AgentTool,
  AgentToolContext,
  ProviderToolCall,
  SubmittedTaskResult
} from './live-agent-types'
import type { LiveAgentStepProgressHandler } from './live-agent-step-state'

export type LiveAgentStepToolExecutionResult = {
  submittedResult?: SubmittedTaskResult
  submitTaskResultCallCountIncrement: number
}

type ExecuteLiveAgentStepToolCallsInput = {
  step: number
  executionSession: LiveAgentExecutionSession
  toolsByName: Map<string, AgentTool<unknown, unknown>>
  toolContext: AgentToolContext
  maxToolConcurrency: number
  onProgress?: LiveAgentStepProgressHandler
  toolCalls: ProviderToolCall[]
}

export const executeLiveAgentStepToolCalls = async (
  input: ExecuteLiveAgentStepToolCallsInput
): Promise<LiveAgentStepToolExecutionResult> => {
  const preparedToolCalls = input.toolCalls.map((toolCall) =>
    prepareToolCall(toolCall, input.toolsByName)
  )

  await input.executionSession.appendToolEvents(
    preparedToolCalls.map((toolCall) =>
      toToolEvent(toolCall, {
        turnIndex: input.step,
        status: 'requested'
      })
    )
  )

  const validation = validateToolCalls(preparedToolCalls, input.step)
  let submittedResult: SubmittedTaskResult | undefined

  for (const result of validation.syntheticResults) {
    await input.executionSession.appendMessage(result.message, input.step)
    await input.executionSession.appendToolEvents(result.toolEvents)
  }

  const results =
    validation.executableToolCalls.length > 0
      ? await runToolCalls(
          validation.executableToolCalls.map((toolCall) => ({
            id: toolCall.id,
            isConcurrencySafe: toolCall.isConcurrencySafe,
            payload: toolCall
          })),
          {
            maxConcurrency: input.maxToolConcurrency,
            execute: async ({ payload }) =>
              executePreparedToolCall(
                payload,
                input.toolContext,
                input.step,
                input.onProgress
              )
          }
        )
      : []

  for (const result of results) {
    await input.executionSession.appendMessage(result.message, input.step)
    await input.executionSession.appendToolEvents(result.toolEvents)
    submittedResult = result.submittedResult ?? submittedResult
  }

  return {
    submittedResult,
    submitTaskResultCallCountIncrement: preparedToolCalls.filter(
      (toolCall) => toolCall.toolCall.name === SUBMIT_TASK_RESULT_TOOL_NAME
    ).length
  }
}
