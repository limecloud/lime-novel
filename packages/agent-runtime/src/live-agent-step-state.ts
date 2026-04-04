import type { AgentProviderErrorCode } from './live-agent-provider'
import { SUBMIT_TASK_RESULT_TOOL_NAME } from './live-agent-result-tool'
import type {
  LiveAgentFailureSubtype,
  SubmittedTaskResult
} from './live-agent-types'

export type LiveAgentStepState = {
  lastAssistantText?: string
  submitTaskResultCallCount: number
}

export type LiveAgentStepResult =
  | {
      kind: 'continue'
      state: LiveAgentStepState
    }
  | {
      kind: 'success'
      state: LiveAgentStepState
      submittedResult: SubmittedTaskResult
      assistantText?: string
    }
  | {
      kind: 'error'
      state: LiveAgentStepState
      subtype: LiveAgentFailureSubtype
      detail: string
      providerCode?: AgentProviderErrorCode
      assistantText?: string
    }

export type LiveAgentStepProgressHandler = (
  summary: string
) => Promise<void> | void

export const createInitialLiveAgentStepState = (): LiveAgentStepState => ({
  submitTaskResultCallCount: 0
})

export const advanceLiveAgentStepState = (
  state: LiveAgentStepState,
  input: {
    assistantText?: string
    submitTaskResultCallCountIncrement?: number
  }
): LiveAgentStepState => ({
  lastAssistantText: input.assistantText || state.lastAssistantText,
  submitTaskResultCallCount:
    state.submitTaskResultCallCount +
    (input.submitTaskResultCallCountIncrement ?? 0)
})

export const buildLiveAgentStructuredOutputReminder = (
  assistantText?: string
): string =>
  assistantText
    ? `你刚才输出了自然语言文本，但这不算完成。请不要重复总结，直接调用 ${SUBMIT_TASK_RESULT_TOOL_NAME} 提交最终结构化结果。`
    : `你还没有调用 ${SUBMIT_TASK_RESULT_TOOL_NAME}。请直接使用工具提交最终结构化结果。`

export const buildLiveAgentStepContinueResult = (
  state: LiveAgentStepState
): LiveAgentStepResult => ({
  kind: 'continue',
  state
})

export const buildLiveAgentStepSuccessResult = (
  state: LiveAgentStepState,
  input: {
    submittedResult: SubmittedTaskResult
    assistantText?: string
  }
): LiveAgentStepResult => ({
  kind: 'success',
  state,
  submittedResult: input.submittedResult,
  assistantText: input.assistantText
})

export const buildLiveAgentStepFailureResult = (
  state: LiveAgentStepState,
  input: {
    subtype: LiveAgentFailureSubtype
    detail: string
    providerCode?: AgentProviderErrorCode
    assistantText?: string
  }
): LiveAgentStepResult => ({
  kind: 'error',
  state,
  subtype: input.subtype,
  detail: input.detail,
  providerCode: input.providerCode,
  assistantText: input.assistantText
})

export const buildLiveAgentStructuredOutputRetryLimitDetail = (
  state: LiveAgentStepState,
  maxStructuredOutputRetries: number
): string =>
  `${SUBMIT_TASK_RESULT_TOOL_NAME} 在单次任务里已经调用 ${state.submitTaskResultCallCount} 次，超过上限 ${maxStructuredOutputRetries} 次，任务已提前终止。`

export const buildLiveAgentMissingStructuredOutputDetail = (
  lastAssistantText?: string
): string =>
  lastAssistantText
    ? `模型在限定轮次内没有按约定调用 ${SUBMIT_TASK_RESULT_TOOL_NAME}。最后一轮文本：${lastAssistantText}`
    : `模型在限定轮次内没有调用 ${SUBMIT_TASK_RESULT_TOOL_NAME}。`
