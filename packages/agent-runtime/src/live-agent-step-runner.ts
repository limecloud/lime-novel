import {
  type LiveAgentStepProgressHandler,
  type LiveAgentStepResult,
  type LiveAgentStepState
} from './live-agent-step-state'
import type { LiveAgentExecutionSession } from './live-agent-execution-session'
import { executeLiveAgentStepCompletion } from './live-agent-step-completion'
import {
  continueLiveAgentStepWithoutToolCalls,
  projectLiveAgentStepOutcome
} from './live-agent-step-outcome'
import { executeLiveAgentStepToolCalls } from './live-agent-step-tool-calls'
import type {
  AgentTool,
  AgentToolContext,
  LLMProvider,
  ProviderToolDefinition
} from './live-agent-types'

type RunLiveAgentStepInput = {
  step: number
  provider: LLMProvider
  providerTools: ProviderToolDefinition[]
  executionSession: LiveAgentExecutionSession
  toolsByName: Map<string, AgentTool<unknown, unknown>>
  toolContext: AgentToolContext
  state: LiveAgentStepState
  maxToolConcurrency: number
  maxStructuredOutputRetries: number
  onProgress?: LiveAgentStepProgressHandler
}

export const executeLiveAgentStep = async (
  input: RunLiveAgentStepInput
): Promise<LiveAgentStepResult> => {
  const completionResult = await executeLiveAgentStepCompletion({
    step: input.step,
    provider: input.provider,
    providerTools: input.providerTools,
    executionSession: input.executionSession,
    state: input.state,
    onProgress: input.onProgress
  })

  if (completionResult.kind === 'error') {
    return completionResult.result
  }

  const { assistantText, toolCalls, state } = completionResult.completion

  if (toolCalls.length === 0) {
    return continueLiveAgentStepWithoutToolCalls({
      executionSession: input.executionSession,
      step: input.step,
      state,
      assistantText
    })
  }

  const toolCallResult = await executeLiveAgentStepToolCalls({
    step: input.step,
    executionSession: input.executionSession,
    toolsByName: input.toolsByName,
    toolContext: input.toolContext,
    maxToolConcurrency: input.maxToolConcurrency,
    onProgress: input.onProgress,
    toolCalls
  })

  return projectLiveAgentStepOutcome({
    state,
    assistantText,
    submittedResult: toolCallResult.submittedResult,
    submitTaskResultCallCountIncrement:
      toolCallResult.submitTaskResultCallCountIncrement,
    maxStructuredOutputRetries: input.maxStructuredOutputRetries
  })
}
