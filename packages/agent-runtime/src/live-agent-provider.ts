import { createId } from '@lime-novel/shared-kernel'
import type {
  LLMProvider,
  ProviderCompletionResult,
  ProviderMessage,
  ProviderToolCall,
  ProviderToolDefinition
} from './live-agent-types'

type AgentRuntimeProviderKind = 'legacy' | 'openai-compatible'
export type AgentProviderErrorCode =
  | 'timeout'
  | 'http_error'
  | 'invalid_json'
  | 'invalid_response'
  | 'request_error'

export type AgentRuntimeConfig = {
  provider: AgentRuntimeProviderKind
  baseUrl: string
  apiKey?: string
  model: string
  maxSteps: number
  maxToolConcurrency: number
  maxStructuredOutputRetries: number
  requestTimeoutMs: number
  temperature: number
}

export class AgentProviderError extends Error {
  constructor(
    readonly code: AgentProviderErrorCode,
    message: string,
    readonly metadata?: {
      statusCode?: number
    }
  ) {
    super(message)
    this.name = 'AgentProviderError'
  }
}

const parseInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseFloatValue = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const resolveAgentRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): AgentRuntimeConfig => {
  const baseUrl = env.LIME_NOVEL_AGENT_BASE_URL?.trim() || 'https://api.openai.com/v1'
  const apiKey = env.LIME_NOVEL_AGENT_API_KEY?.trim()
  const explicitProvider = env.LIME_NOVEL_AGENT_PROVIDER?.trim() as AgentRuntimeProviderKind | undefined
  const hasLiveProviderSignal = Boolean(env.LIME_NOVEL_AGENT_BASE_URL?.trim() || apiKey)

  return {
    provider: explicitProvider ?? (hasLiveProviderSignal ? 'openai-compatible' : 'legacy'),
    baseUrl,
    apiKey,
    model: env.LIME_NOVEL_AGENT_MODEL?.trim() || 'gpt-4.1-mini',
    maxSteps: parseInteger(env.LIME_NOVEL_AGENT_MAX_STEPS, 6),
    maxToolConcurrency: parseInteger(env.LIME_NOVEL_AGENT_MAX_TOOL_CONCURRENCY, 4),
    maxStructuredOutputRetries: parseInteger(env.LIME_NOVEL_AGENT_MAX_STRUCTURED_OUTPUT_RETRIES, 5),
    requestTimeoutMs: parseInteger(env.LIME_NOVEL_AGENT_REQUEST_TIMEOUT_MS, 90_000),
    temperature: parseFloatValue(env.LIME_NOVEL_AGENT_TEMPERATURE, 0.2)
  }
}

type OpenAIChatMessage =
  | {
      role: 'system' | 'user'
      content: string
    }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: {
          name: string
          arguments: string
        }
      }>
    }
  | {
      role: 'tool'
      tool_call_id: string
      content: string
    }

const resolveChatCompletionsUrl = (baseUrl: string): string =>
  baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`

const extractAssistantText = (content: unknown): string | undefined => {
  if (typeof content === 'string') {
    return content.trim() || undefined
  }

  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }

        if (
          item &&
          typeof item === 'object' &&
          'type' in item &&
          (item as { type?: string }).type === 'text' &&
          'text' in item &&
          typeof (item as { text?: unknown }).text === 'string'
        ) {
          return (item as { text: string }).text
        }

        return ''
      })
      .join('\n')
      .trim()

    return text || undefined
  }

  return undefined
}

const toOpenAIChatMessages = (messages: ProviderMessage[]): OpenAIChatMessage[] =>
  messages.map((message) => {
    if (message.role === 'system' || message.role === 'user') {
      return {
        role: message.role,
        content: message.content
      }
    }

    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.toolCallId,
        content: message.content
      }
    }

    if (message.role === 'assistant') {
      return {
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.toolCalls?.map((toolCall: ProviderToolCall) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.input ?? {})
          }
        }))
      }
    }

    return {
      role: 'assistant',
      content: ''
    }
  })

const toOpenAITools = (tools: ProviderToolDefinition[]) =>
  tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }))

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  try {
    return (await response.json()) as T
  } catch (error) {
    throw new AgentProviderError(
      'invalid_json',
      `模型返回了无法解析的 JSON 响应：${error instanceof Error ? error.message : String(error)}`
    )
  }
}

class OpenAICompatibleProvider implements LLMProvider {
  constructor(private readonly config: AgentRuntimeConfig) {}

  async completeTurn(input: {
    messages: ProviderMessage[]
    tools: ProviderToolDefinition[]
  }): Promise<ProviderCompletionResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs)
    let response: Response

    try {
      response = await fetch(resolveChatCompletionsUrl(this.config.baseUrl), {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          temperature: this.config.temperature,
          tool_choice: 'auto',
          messages: toOpenAIChatMessages(input.messages),
          tools: toOpenAITools(input.tools)
        })
      })
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || controller.signal.aborted)
      ) {
        throw new AgentProviderError('timeout', `模型调用超时（${this.config.requestTimeoutMs}ms）。`)
      }

      throw new AgentProviderError(
        'request_error',
        `模型调用失败：${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const errorBody = await response.text()
      throw new AgentProviderError(
        'http_error',
        `模型调用失败（${response.status}）：${errorBody.slice(0, 400)}`,
        {
          statusCode: response.status
        }
      )
    }

    const payload = await parseJsonResponse<{
      choices?: Array<{
        finish_reason?: string | null
        message?: {
          content?: unknown
          tool_calls?: Array<{
            id?: string
            function?: {
              name?: string
              arguments?: string
            }
          }>
        }
      }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
      }
    }>(response)

    const message = payload.choices?.[0]?.message
    if (!message) {
      throw new AgentProviderError('invalid_response', '模型返回格式无效：缺少 choices[0].message。')
    }

    const toolCalls: ProviderToolCall[] =
      message?.tool_calls?.map((toolCall) => {
        const rawArguments = toolCall.function?.arguments?.trim() || '{}'
        let parsedInput: unknown = {}

        try {
          parsedInput = JSON.parse(rawArguments)
        } catch {
          parsedInput = {
            _raw: rawArguments
          }
        }

        return {
          id: toolCall.id ?? createId('tool-call'),
          name: toolCall.function?.name ?? 'unknown_tool',
          input: parsedInput
        }
      }) ?? []

    return {
      assistantText: extractAssistantText(message?.content),
      toolCalls,
      stopReason: payload.choices?.[0]?.finish_reason ?? undefined,
      usage: {
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens
      }
    }
  }
}

export const createConfiguredLLMProvider = (
  config: AgentRuntimeConfig
): LLMProvider | null => {
  if (config.provider === 'legacy') {
    return null
  }

  return new OpenAICompatibleProvider(config)
}
