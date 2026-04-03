import type {
  AgentHeaderDto,
  AgentTaskDto,
  ProjectRepositoryPort,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'
import {
  AgentProviderError,
  type AgentRuntimeConfig
} from './live-agent-provider'
import {
  LiveAgentExecutionSession,
  type LiveAgentDiagnosticsHandler
} from './live-agent-execution-session'
import {
  createLiveAgentTools,
  SUBMIT_TASK_RESULT_TOOL_NAME,
  toProviderToolDefinitions
} from './live-agent-tools'
import { runToolCalls } from './live-agent-tool-orchestration'
import type {
  AgentTool,
  AgentToolContext,
  LiveAgentExecutionResult,
  LLMProvider,
  LiveAgentToolEvent,
  ProviderMessage,
  ProviderToolCall,
  SubmittedTaskResult
} from './live-agent-types'

const MAX_TOOL_RESULT_CHARS = 12_000
type RunLiveAgentTaskInput = {
  repository: ProjectRepositoryPort
  shell: WorkspaceShellDto
  input: StartTaskInputDto
  task: AgentTaskDto
  header: AgentHeaderDto
  provider: LLMProvider
  config: AgentRuntimeConfig
  onProgress?: (summary: string) => Promise<void> | void
  onDiagnostics?: LiveAgentDiagnosticsHandler
}

type PreparedToolCall = {
  id: string
  toolCall: ProviderToolCall
  tool?: AgentTool<unknown, unknown>
  parsedInput?: unknown
  parseError?: string
  isConcurrencySafe: boolean
  progressLabel: string
}

type ToolExecutionResult = {
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

const toToolEvent = (
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

const normalizeExecutionSurface = (surface: NovelSurfaceId): Exclude<NovelSurfaceId, 'feature-center'> =>
  surface === 'feature-center' ? 'analysis' : surface

const surfaceLabelMap: Record<NovelSurfaceId, string> = {
  home: '首页',
  writing: '写作工作面',
  knowledge: '知识工作面',
  'feature-center': '功能中心',
  analysis: '拆书工作面',
  canon: '设定工作面',
  revision: '修订工作面',
  publish: '发布工作面'
}

const resolveChapterLabel = (
  shell: WorkspaceShellDto,
  input: StartTaskInputDto
): string | undefined => {
  const chapterId = input.chapterId ?? shell.project.currentChapterId
  return shell.chapterTree.find((chapter) => chapter.chapterId === chapterId)?.title
}

const buildSystemPrompt = (input: {
  header: AgentHeaderDto
  startInput: StartTaskInputDto
  shell: WorkspaceShellDto
}): string => {
  const effectiveSurface = normalizeExecutionSurface(input.startInput.surface)
  const baseRules = [
    '你是 Lime Novel 的执行型单代理，负责通过工具完成当前任务。',
    '所有回复与结构化结果都必须使用简体中文。',
    '不要假装已经读过正文、保存过提议或写回过仓储；凡是需要读取或写入，都必须先调用对应工具。',
    '遇到工具报错时，不要放弃；先根据错误修正参数，再继续执行。',
    '如果不确定当前上下文，优先调用 load_workspace_snapshot。',
    '需要查看正文时，调用 load_chapter_document。',
    `任务结束前必须调用一次 ${SUBMIT_TASK_RESULT_TOOL_NAME}。`,
    `自然语言文本不算完成，只有 ${SUBMIT_TASK_RESULT_TOOL_NAME} 才算最终结果。`,
    `${SUBMIT_TASK_RESULT_TOOL_NAME} 必须单独调用，不要和其他工具放在同一轮。`,
    `${SUBMIT_TASK_RESULT_TOOL_NAME} 里的 artifacts 只保留真正需要显示给右栏和工作面的结果，避免冗余。`
  ]

  const surfaceRules =
    effectiveSurface === 'writing'
      ? [
          '写作任务如果生成可应用正文，必须先调用 save_proposal_draft 保存完整正文，再在 submit_task_result 中引用 proposalId。',
          '写作提议通常应该用 waiting_approval 结束，并至少提交一条 proposal artifact；最好再补一条 approval artifact。'
        ]
      : effectiveSurface === 'revision'
        ? [
            '修订任务如果发现问题，必须先调用 upsert_revision_issue 写回问题队列。',
            '修订任务如果同时生成可应用正文，必须先 save_proposal_draft，再 submit_task_result，并优先使用 waiting_approval。'
          ]
        : effectiveSurface === 'knowledge'
          ? [
              '知识工作面优先围绕项目内已有资料、知识页和查询产物组织结果。',
              '如果当前问题明显缺资料，直接指出缺口，不要假装已经完成深度研究。'
            ]
        : effectiveSurface === 'canon'
          ? [
              '设定任务如果沉淀出候选卡，必须先调用 upsert_canon_candidate 写回，再提交最终结果。'
            ]
          : effectiveSurface === 'publish'
            ? [
                '发布任务如果要生成平台简介草案，请在 artifact 上使用 template=publish-synopsis-draft。',
                '发布任务如果要生成发布备注草案，请在 artifact 上使用 template=publish-notes-draft。',
                '发布任务如果要生成最终确认建议，请在 artifact 上使用 template=publish-confirm-suggestion。'
              ]
            : effectiveSurface === 'analysis'
              ? [
                  '拆书任务优先基于已有样本与工作区快照给出结论；如果当前没有样本，直接明确指出缺口并结束。'
                ]
              : [
                  '首页任务以恢复现场、总结风险和建议下一步为主，除非任务明确要求写回，否则优先保持只读。'
                ]

  return [...baseRules, ...surfaceRules].join('\n')
}

const buildUserPrompt = (input: {
  task: AgentTaskDto
  header: AgentHeaderDto
  startInput: StartTaskInputDto
  shell: WorkspaceShellDto
}): string => {
  const currentChapterLabel = resolveChapterLabel(input.shell, input.startInput) ?? '当前章节未定位'

  return [
    `任务标题：${input.task.title}`,
    `当前工作面：${surfaceLabelMap[input.startInput.surface]}`,
    `用户意图：${input.startInput.intent}`,
    `项目：${input.shell.project.title} / ${input.shell.project.genre}`,
    `当前章节：${currentChapterLabel}`,
    `风险等级：${input.header.riskLevel}`,
    `记忆来源：${input.header.memorySources.join(' / ') || '暂无'}`,
    '请直接开始执行，必要时先读取工作区快照。'
  ].join('\n')
}

const prepareToolCall = (
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

const validateToolCalls = (
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

const executePreparedToolCall = async (
  preparedToolCall: PreparedToolCall,
  toolContext: AgentToolContext,
  turnIndex: number,
  onProgress?: RunLiveAgentTaskInput['onProgress']
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

export const executeLiveAgentSession = async (
  input: RunLiveAgentTaskInput
): Promise<LiveAgentExecutionResult> => {
  const toolContext: AgentToolContext = {
    repository: input.repository,
    shell: input.shell,
    input: input.input,
    task: input.task,
    header: input.header
  }
  const tools = createLiveAgentTools(toolContext)
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool] satisfies [string, AgentTool<unknown, unknown>]))
  const executionSession = new LiveAgentExecutionSession(input.onDiagnostics)

  await executionSession.appendMessage(
    {
      role: 'system',
      content: buildSystemPrompt({
        header: input.header,
        startInput: input.input,
        shell: input.shell
      })
    },
    0
  )
  await executionSession.appendMessage(
    {
      role: 'user',
      content: buildUserPrompt({
        task: input.task,
        header: input.header,
        startInput: input.input,
        shell: input.shell
      })
    },
    0
  )

  let lastAssistantText: string | undefined
  let submitTaskResultCallCount = 0

  for (let step = 1; step <= input.config.maxSteps; step += 1) {
    if (input.onProgress) {
      await input.onProgress(`模型思考第 ${step} 轮`)
    }

    let completion

    try {
      completion = await input.provider.completeTurn({
        messages: executionSession.getCompletionMessages(),
        tools: toProviderToolDefinitions(tools)
      })
    } catch (error) {
      if (error instanceof AgentProviderError) {
        return executionSession.fail({
          subtype: 'error_during_execution',
          detail: error.message,
          providerCode: error.code,
          assistantText: lastAssistantText
        })
      }

      return executionSession.fail({
        subtype: 'error_during_execution',
        detail: error instanceof Error ? error.message : '代理执行过程中出现未知错误。',
        assistantText: lastAssistantText
      })
    }

    executionSession.recordCompletion({
      inputTokens: completion.usage?.inputTokens,
      outputTokens: completion.usage?.outputTokens,
      stopReason: completion.stopReason
    })

    const assistantText = completion.assistantText?.trim()
    lastAssistantText = assistantText || lastAssistantText

    await executionSession.appendMessage(
      {
        role: 'assistant',
        content: assistantText,
        toolCalls: completion.toolCalls.length > 0 ? completion.toolCalls : undefined
      },
      step,
      completion.stopReason
    )

    if (completion.toolCalls.length === 0) {
      await executionSession.appendMessage(
        {
          role: 'user',
          content: assistantText
            ? `你刚才输出了自然语言文本，但这不算完成。请不要重复总结，直接调用 ${SUBMIT_TASK_RESULT_TOOL_NAME} 提交最终结构化结果。`
            : `你还没有调用 ${SUBMIT_TASK_RESULT_TOOL_NAME}。请直接使用工具提交最终结构化结果。`
        },
        step
      )
      continue
    }

    const preparedToolCalls = completion.toolCalls.map((toolCall) => prepareToolCall(toolCall, toolsByName))
    await executionSession.appendToolEvents(
      preparedToolCalls.map((toolCall) =>
        toToolEvent(toolCall, {
          turnIndex: step,
          status: 'requested'
        })
      )
    )
    submitTaskResultCallCount += preparedToolCalls.filter(
      (toolCall) => toolCall.toolCall.name === SUBMIT_TASK_RESULT_TOOL_NAME
    ).length
    const validation = validateToolCalls(preparedToolCalls, step)
    let submittedResult: SubmittedTaskResult | undefined

    for (const result of validation.syntheticResults) {
      await executionSession.appendMessage(result.message, step)
      await executionSession.appendToolEvents(result.toolEvents)
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
              maxConcurrency: input.config.maxToolConcurrency,
              execute: async ({ payload }) =>
                executePreparedToolCall(payload, toolContext, step, input.onProgress)
            }
          )
        : []

    for (const result of results) {
      await executionSession.appendMessage(result.message, step)
      await executionSession.appendToolEvents(result.toolEvents)
      submittedResult = result.submittedResult ?? submittedResult
    }

    if (submittedResult) {
      return executionSession.buildSuccessResult({
        submittedResult,
        assistantText
      })
    }

    if (submitTaskResultCallCount >= input.config.maxStructuredOutputRetries) {
      return executionSession.fail({
        subtype: 'error_max_structured_output_retries',
        detail: `${SUBMIT_TASK_RESULT_TOOL_NAME} 在单次任务里已经调用 ${submitTaskResultCallCount} 次，超过上限 ${input.config.maxStructuredOutputRetries} 次，任务已提前终止。`,
        assistantText
      })
    }
  }

  const missingResultMessage = lastAssistantText
    ? `模型在限定轮次内没有按约定调用 ${SUBMIT_TASK_RESULT_TOOL_NAME}。最后一轮文本：${lastAssistantText}`
    : `模型在限定轮次内没有调用 ${SUBMIT_TASK_RESULT_TOOL_NAME}。`

  return executionSession.fail({
    subtype: 'error_max_turns',
    detail: missingResultMessage,
    assistantText: lastAssistantText
  })
}
