import type { AgentProviderErrorCode } from './live-agent-provider'
import type {
  LiveAgentDiagnosticsSnapshot,
  LiveAgentExecutionResult,
  LiveAgentExecutionStats,
  LiveAgentFailureInfo,
  LiveAgentFailureSubtype,
  LiveAgentToolEvent,
  LiveAgentTraceEntry,
  ProviderMessage,
  SubmittedTaskResult
} from './live-agent-types'

export type LiveAgentDiagnosticsHandler = (
  snapshot: LiveAgentDiagnosticsSnapshot
) => Promise<void> | void

const createInitialExecutionStats = (): LiveAgentExecutionStats => ({
  turnCount: 0,
  usage: {
    inputTokens: 0,
    outputTokens: 0
  }
})

const accumulateExecutionStats = (
  currentStats: LiveAgentExecutionStats,
  input: {
    inputTokens?: number
    outputTokens?: number
    stopReason?: string
  }
): LiveAgentExecutionStats => ({
  turnCount: currentStats.turnCount + 1,
  usage: {
    inputTokens: currentStats.usage.inputTokens + (input.inputTokens ?? 0),
    outputTokens: currentStats.usage.outputTokens + (input.outputTokens ?? 0)
  },
  stopReason: input.stopReason ?? currentStats.stopReason
})

const toTraceEntry = (
  message: ProviderMessage,
  input: {
    turnIndex: number
    stopReason?: string
  }
): LiveAgentTraceEntry => {
  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      turnIndex: input.turnIndex,
      content: message.content,
      stopReason: input.stopReason,
      toolCalls: message.toolCalls?.map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.name
      }))
    }
  }

  if (message.role === 'tool') {
    return {
      role: 'tool',
      turnIndex: input.turnIndex,
      content: message.content,
      toolCallId: message.toolCallId,
      toolName: message.toolName
    }
  }

  return {
    role: message.role,
    turnIndex: input.turnIndex,
    content: message.content
  }
}

const filterIncompleteToolCallMessages = (messages: ProviderMessage[]): ProviderMessage[] => {
  const toolCallIdsWithResults = new Set<string>()

  for (const message of messages) {
    if (message.role === 'tool') {
      toolCallIdsWithResults.add(message.toolCallId)
    }
  }

  return messages.filter((message) => {
    if (message.role !== 'assistant' || !message.toolCalls?.length) {
      return true
    }

    return message.toolCalls.every((toolCall) => toolCallIdsWithResults.has(toolCall.id))
  })
}

const buildExecutionErrorResult = (input: {
  subtype: LiveAgentFailureSubtype
  detail: string
  stats: LiveAgentExecutionStats
  providerCode?: AgentProviderErrorCode
  assistantText?: string
  trace: LiveAgentTraceEntry[]
  toolEvents: LiveAgentToolEvent[]
}): LiveAgentExecutionResult => ({
  kind: 'error',
  subtype: input.subtype,
  detail: input.detail,
  providerCode: input.providerCode,
  assistantText: input.assistantText,
  stats: input.stats,
  trace: input.trace,
  toolEvents: input.toolEvents
})

export class LiveAgentExecutionSession {
  private readonly messages: ProviderMessage[] = []
  private readonly traceEntries: LiveAgentTraceEntry[] = []
  private readonly toolEventEntries: LiveAgentToolEvent[] = []
  private statsSnapshot = createInitialExecutionStats()
  private failureInfo?: LiveAgentFailureInfo

  constructor(private readonly onDiagnostics?: LiveAgentDiagnosticsHandler) {}

  getCompletionMessages(): ProviderMessage[] {
    return filterIncompleteToolCallMessages(this.messages)
  }

  recordCompletion(input: {
    inputTokens?: number
    outputTokens?: number
    stopReason?: string
  }): void {
    this.statsSnapshot = accumulateExecutionStats(this.statsSnapshot, input)
  }

  async appendMessage(
    message: ProviderMessage,
    turnIndex: number,
    stopReason?: string
  ): Promise<void> {
    this.messages.push(message)
    this.traceEntries.push(
      toTraceEntry(message, {
        turnIndex,
        stopReason
      })
    )
    await this.publishDiagnostics()
  }

  async appendToolEvents(events: LiveAgentToolEvent[]): Promise<void> {
    if (events.length === 0) {
      return
    }

    this.toolEventEntries.push(...events)
    await this.publishDiagnostics()
  }

  async fail(input: {
    subtype: LiveAgentFailureSubtype
    detail: string
    providerCode?: AgentProviderErrorCode
    assistantText?: string
  }): Promise<LiveAgentExecutionResult> {
    this.failureInfo = {
      subtype: input.subtype,
      detail: input.detail,
      providerCode: input.providerCode,
      stopReason: this.statsSnapshot.stopReason,
      turnCount: this.statsSnapshot.turnCount,
      usage: this.statsSnapshot.usage
    }
    await this.publishDiagnostics()

    return buildExecutionErrorResult({
      subtype: input.subtype,
      detail: input.detail,
      providerCode: input.providerCode,
      assistantText: input.assistantText,
      stats: this.statsSnapshot,
      trace: [...this.traceEntries],
      toolEvents: [...this.toolEventEntries]
    })
  }

  buildSuccessResult(input: {
    submittedResult: SubmittedTaskResult
    assistantText?: string
  }): LiveAgentExecutionResult {
    return {
      kind: 'success',
      submittedResult: input.submittedResult,
      assistantText: input.assistantText,
      stats: this.statsSnapshot,
      trace: [...this.traceEntries],
      toolEvents: [...this.toolEventEntries]
    }
  }

  private async publishDiagnostics(): Promise<void> {
    if (!this.onDiagnostics) {
      return
    }

    await this.onDiagnostics({
      trace: [...this.traceEntries],
      toolEvents: [...this.toolEventEntries],
      stats: this.statsSnapshot,
      failure: this.failureInfo
    })
  }
}
