import type {
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentTaskDto,
  ProjectRepositoryPort,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { RiskLevel, TaskStatus } from '@lime-novel/domain-novel'

export type ToolJsonSchema =
  | {
      type: 'string' | 'number' | 'boolean'
      description?: string
      enum?: string[]
    }
  | {
      type: 'array'
      description?: string
      items?: ToolJsonSchema
    }
  | {
      type: 'object'
      description?: string
      properties?: Record<string, ToolJsonSchema>
      required?: string[]
      additionalProperties?: boolean
    }

export type ProviderToolCall = {
  id: string
  name: string
  input: unknown
}

export type ProviderMessage =
  | {
      role: 'system' | 'user'
      content: string
    }
  | {
      role: 'assistant'
      content?: string
      toolCalls?: ProviderToolCall[]
    }
  | {
      role: 'tool'
      toolCallId: string
      toolName: string
      content: string
    }

export type LiveAgentTraceEntry = {
  role: ProviderMessage['role']
  turnIndex: number
  content?: string
  toolCallId?: string
  toolName?: string
  toolCalls?: Array<{
    id: string
    name: string
  }>
  stopReason?: string
}

export type LiveAgentToolEvent = {
  turnIndex: number
  toolCallId: string
  toolName: string
  status: 'requested' | 'rejected' | 'started' | 'completed' | 'failed'
  isConcurrencySafe: boolean
  progressLabel?: string
  error?: string
  isStructuredOutputTool?: boolean
}

export type ProviderToolDefinition = {
  name: string
  description: string
  inputSchema: Extract<ToolJsonSchema, { type: 'object' }>
}

export type ProviderCompletionResult = {
  assistantText?: string
  toolCalls: ProviderToolCall[]
  stopReason?: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
}

export interface LLMProvider {
  completeTurn(input: {
    messages: ProviderMessage[]
    tools: ProviderToolDefinition[]
  }): Promise<ProviderCompletionResult>
}

export type AgentToolContext = {
  repository: ProjectRepositoryPort
  shell: WorkspaceShellDto
  input: StartTaskInputDto
  task: AgentTaskDto
  header: AgentHeaderDto
}

export type SubmittedTaskArtifact = {
  kind: 'status' | 'evidence' | 'proposal' | 'issue' | 'approval'
  title?: string
  body: string
  supportingLabel?: string
  severity?: RiskLevel
  proposalId?: string
  linkedIssueId?: string
  template?: 'publish-synopsis-draft' | 'publish-notes-draft' | 'publish-confirm-suggestion'
  diffPreview?: {
    before: string
    after: string
  }
}

export type SubmittedTaskResult = {
  status: Extract<TaskStatus, 'completed' | 'failed' | 'waiting_approval'>
  summary: string
  artifacts: SubmittedTaskArtifact[]
}

export type AgentTool<Input, Output> = {
  name: string
  description: string
  inputSchema: Extract<ToolJsonSchema, { type: 'object' }>
  parse: (input: unknown) => Input
  execute: (input: Input, context: AgentToolContext) => Promise<Output>
  isConcurrencySafe?: (input: Input) => boolean
  getProgressLabel?: (input: Input) => string
}

export type LiveAgentFailureSubtype =
  | 'error_max_turns'
  | 'error_max_structured_output_retries'
  | 'error_during_execution'

export type LiveAgentFailureInfo = {
  subtype: LiveAgentFailureSubtype
  detail: string
  providerCode?: string
  stopReason?: string
  turnCount: number
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export type LiveAgentExecutionStats = {
  turnCount: number
  usage: {
    inputTokens: number
    outputTokens: number
  }
  stopReason?: string
}

export type LiveAgentDiagnosticsSnapshot = {
  trace: LiveAgentTraceEntry[]
  toolEvents: LiveAgentToolEvent[]
  stats: LiveAgentExecutionStats
  failure?: LiveAgentFailureInfo
}

export type LiveAgentExecutionResult =
  | {
      kind: 'success'
      submittedResult: SubmittedTaskResult
      assistantText?: string
      stats: LiveAgentExecutionStats
      trace: LiveAgentTraceEntry[]
      toolEvents: LiveAgentToolEvent[]
    }
  | {
      kind: 'error'
      subtype: LiveAgentFailureSubtype
      detail: string
      providerCode?: string
      assistantText?: string
      stats: LiveAgentExecutionStats
      trace: LiveAgentTraceEntry[]
      toolEvents: LiveAgentToolEvent[]
    }
