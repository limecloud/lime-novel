import type { AgentTool, AgentToolContext, LiveAgentToolEvent, ProviderMessage, ProviderToolCall, SubmittedTaskResult } from './live-agent-types'
import { SUBMIT_TASK_RESULT_TOOL_NAME } from './live-agent-result-tool'

const MAX_TOOL_RESULT_CHARS = 12_000

export type LiveAgentProgressHandler = (summary: string) => Promise<void> | void

export type PreparedToolCall = {
  id: string
  toolCall: ProviderToolCall
  tool?: AgentTool<unknown, unknown>
  parsedInput?: unknown
  parseError?: string
  isConcurrencySafe: boolean
  progressLabel: string
}

export type ToolExecutionResult = {
  message: ProviderMessage
  submittedResult?: SubmittedTaskResult
  isStructuredOutputError?: boolean
  toolEvents: LiveAgentToolEvent[]
}

type ToolCallValidationResult = {
  executableToolCalls: PreparedToolCall[]
  syntheticResults: ToolExecutionResult[]
}

const truncate = (value: string, maxLength = MAX_TOOL_RESULT_CHARS): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n...[已截断]`

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return typeof error === 'string' ? error : '发生未知错误。'
}

const stringifyToolResult = (payload: unknown): string => {
  try {
    return truncate(JSON.stringify(payload, null, 2))
  } catch {
    return truncate(String(payload))
  }
}

const buildToolMessage = (
  preparedToolCall: PreparedToolCall,
  payload: {
    ok: boolean
    data?: unknown
    error?: string
  }
): ProviderMessage => ({
  role: 'tool',
  toolCallId: preparedToolCall.toolCall.id,
  toolName: preparedToolCall.toolCall.name,
  content: stringifyToolResult(payload)
})

export const toToolEvent = (
  preparedToolCall: PreparedToolCall,
  input: {
    turnIndex: number
    status: LiveAgentToolEvent['status']
    error?: string
  }
): LiveAgentToolEvent => ({
  turnIndex: input.turnIndex,
  toolCallId: preparedToolCall.toolCall.id,
  toolName: preparedToolCall.toolCall.name,
  status: input.status,
  isConcurrencySafe: preparedToolCall.isConcurrencySafe,
  progressLabel: preparedToolCall.progressLabel,
  error: input.error,
  isStructuredOutputTool:
    preparedToolCall.toolCall.name === SUBMIT_TASK_RESULT_TOOL_NAME
})

const buildRejectedToolResult = (
  preparedToolCall: PreparedToolCall,
  input: {
    turnIndex: number
    error: string
    isStructuredOutputError?: boolean
  }
): ToolExecutionResult => ({
  message: buildToolMessage(preparedToolCall, {
    ok: false,
    error: input.error
  }),
  isStructuredOutputError: input.isStructuredOutputError,
  toolEvents: [
    toToolEvent(preparedToolCall, {
      turnIndex: input.turnIndex,
      status: 'rejected',
      error: input.error
    })
  ]
})

export const prepareToolCall = (
  toolCall: ProviderToolCall,
  toolsByName: Map<string, AgentTool<unknown, unknown>>
): PreparedToolCall => {
  const tool = toolsByName.get(toolCall.name)

  if (!tool) {
    return {
      id: toolCall.id,
      toolCall,
      isConcurrencySafe: false,
      progressLabel: `执行工具：${toolCall.name}`,
      parseError: `未知工具：${toolCall.name}`
    }
  }

  try {
    const parsedInput = tool.parse(toolCall.input)
    const isConcurrencySafe = Boolean(tool.isConcurrencySafe?.(parsedInput))

    return {
      id: toolCall.id,
      toolCall,
      tool,
      parsedInput,
      isConcurrencySafe,
      progressLabel: tool.getProgressLabel?.(parsedInput) ?? `执行工具：${tool.name}`
    }
  } catch (error) {
    return {
      id: toolCall.id,
      toolCall,
      tool,
      isConcurrencySafe: false,
      progressLabel: `执行工具：${tool.name}`,
      parseError: formatError(error)
    }
  }
}

export const validateToolCalls = (
  preparedToolCalls: PreparedToolCall[],
  turnIndex: number
): ToolCallValidationResult => {
  const submitToolCalls = preparedToolCalls.filter(
    (toolCall) => toolCall.toolCall.name === SUBMIT_TASK_RESULT_TOOL_NAME
  )

  if (submitToolCalls.length === 0) {
    return {
      executableToolCalls: preparedToolCalls,
      syntheticResults: []
    }
  }

  if (submitToolCalls.length > 1) {
    return {
      executableToolCalls: preparedToolCalls.filter(
        (toolCall) => toolCall.toolCall.name !== SUBMIT_TASK_RESULT_TOOL_NAME
      ),
      syntheticResults: submitToolCalls.map((toolCall) =>
        buildRejectedToolResult(toolCall, {
          turnIndex,
          error: `${SUBMIT_TASK_RESULT_TOOL_NAME} 同一轮只能调用一次，并且必须单独调用。`,
          isStructuredOutputError: true
        })
      )
    }
  }

  if (preparedToolCalls.length > 1) {
    const submitToolCall = submitToolCalls[0] as PreparedToolCall

    return {
      executableToolCalls: preparedToolCalls.filter(
        (toolCall) => toolCall.toolCall.name !== SUBMIT_TASK_RESULT_TOOL_NAME
      ),
      syntheticResults: [
        buildRejectedToolResult(submitToolCall, {
          turnIndex,
          error: `${SUBMIT_TASK_RESULT_TOOL_NAME} 必须在所有其他工具完成后，单独再调用一次。`,
          isStructuredOutputError: true
        })
      ]
    }
  }

  return {
    executableToolCalls: preparedToolCalls,
    syntheticResults: []
  }
}

export const executePreparedToolCall = async (
  preparedToolCall: PreparedToolCall,
  toolContext: AgentToolContext,
  turnIndex: number,
  onProgress?: LiveAgentProgressHandler
): Promise<ToolExecutionResult> => {
  const startedEvent = toToolEvent(preparedToolCall, {
    turnIndex,
    status: 'started'
  })

  if (onProgress) {
    await onProgress(preparedToolCall.progressLabel)
  }

  if (preparedToolCall.parseError) {
    const error = preparedToolCall.parseError

    return {
      message: buildToolMessage(preparedToolCall, {
        ok: false,
        error
      }),
      isStructuredOutputError:
        preparedToolCall.toolCall.name === SUBMIT_TASK_RESULT_TOOL_NAME,
      toolEvents: [
        startedEvent,
        toToolEvent(preparedToolCall, {
          turnIndex,
          status: 'failed',
          error
        })
      ]
    }
  }

  try {
    const result = await preparedToolCall.tool!.execute(preparedToolCall.parsedInput, toolContext)

    return {
      message: buildToolMessage(preparedToolCall, {
        ok: true,
        data: result
      }),
      submittedResult:
        preparedToolCall.toolCall.name === SUBMIT_TASK_RESULT_TOOL_NAME
          ? (result as SubmittedTaskResult)
          : undefined,
      toolEvents: [
        startedEvent,
        toToolEvent(preparedToolCall, {
          turnIndex,
          status: 'completed'
        })
      ]
    }
  } catch (error) {
    const errorMessage = formatError(error)

    return {
      message: buildToolMessage(preparedToolCall, {
        ok: false,
        error: errorMessage
      }),
      isStructuredOutputError:
        preparedToolCall.toolCall.name === SUBMIT_TASK_RESULT_TOOL_NAME,
      toolEvents: [
        startedEvent,
        toToolEvent(preparedToolCall, {
          turnIndex,
          status: 'failed',
          error: errorMessage
        })
      ]
    }
  }
}
