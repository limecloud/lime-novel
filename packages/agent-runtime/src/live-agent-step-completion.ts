import { AgentProviderError } from './live-agent-provider'
import type { LiveAgentExecutionSession } from './live-agent-execution-session'
import {
  advanceLiveAgentStepState,
  buildLiveAgentStepFailureResult,
  type LiveAgentStepProgressHandler,
  type LiveAgentStepResult,
  type LiveAgentStepState
} from './live-agent-step-state'
import type { LLMProvider, ProviderToolCall, ProviderToolDefinition } from './live-agent-types'

export type LiveAgentStepCompletion = {
  assistantText?: string
  toolCalls: ProviderToolCall[]
  state: LiveAgentStepState
}

export type LiveAgentStepCompletionResult =
  | {
      kind: 'error'
      result: LiveAgentStepResult
    }
  | {
      kind: 'completed'
      completion: LiveAgentStepCompletion
    }

type ExecuteLiveAgentStepCompletionInput = {
  step: number
  provider: LLMProvider
  providerTools: ProviderToolDefinition[]
  executionSession: LiveAgentExecutionSession
  state: LiveAgentStepState
  onProgress?: LiveAgentStepProgressHandler
}

export const executeLiveAgentStepCompletion = async (
  input: ExecuteLiveAgentStepCompletionInput
): Promise<LiveAgentStepCompletionResult> => {
  if (input.onProgress) {
    await input.onProgress(`模型思考第 ${input.step} 轮`)
  }

  let completion

  try {
    completion = await input.provider.completeTurn({
      messages: input.executionSession.getCompletionMessages(),
      tools: input.providerTools
    })
  } catch (error) {
    if (error instanceof AgentProviderError) {
      return {
        kind: 'error',
        result: buildLiveAgentStepFailureResult(input.state, {
          subtype: 'error_during_execution',
          detail: error.message,
          providerCode: error.code,
          assistantText: input.state.lastAssistantText
        })
      }
    }

    return {
      kind: 'error',
      result: buildLiveAgentStepFailureResult(input.state, {
        subtype: 'error_during_execution',
        detail:
          error instanceof Error ? error.message : '代理执行过程中出现未知错误。',
        assistantText: input.state.lastAssistantText
      })
    }
  }

  input.executionSession.recordCompletion({
    inputTokens: completion.usage?.inputTokens,
    outputTokens: completion.usage?.outputTokens,
    stopReason: completion.stopReason
  })

  const assistantText = completion.assistantText?.trim()
  const nextState = advanceLiveAgentStepState(input.state, {
    assistantText
  })

  await input.executionSession.appendMessage(
    {
      role: 'assistant',
      content: assistantText,
      toolCalls: completion.toolCalls.length > 0 ? completion.toolCalls : undefined
    },
    input.step,
    completion.stopReason
  )

  return {
    kind: 'completed',
    completion: {
      assistantText,
      toolCalls: completion.toolCalls,
      state: nextState
    }
  }
}
