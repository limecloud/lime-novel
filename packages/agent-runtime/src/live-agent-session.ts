import type {
  AgentHeaderDto,
  AgentTaskDto,
  ProjectRepositoryPort,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import { type AgentRuntimeConfig } from './live-agent-provider'
import {
  buildLiveAgentSystemPrompt,
  buildLiveAgentUserPrompt
} from './live-agent-prompts'
import {
  LiveAgentExecutionSession,
  type LiveAgentDiagnosticsHandler
} from './live-agent-execution-session'
import {
  buildLiveAgentMissingStructuredOutputDetail,
  createInitialLiveAgentStepState
} from './live-agent-step-state'
import {
  executeLiveAgentStep
} from './live-agent-step-runner'
import {
  createLiveAgentTools,
  toProviderToolDefinitions
} from './live-agent-tools'
import type {
  AgentTool,
  AgentToolContext,
  LiveAgentExecutionResult,
  LLMProvider
} from './live-agent-types'

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
  const toolsByName = new Map(
    tools.map((tool) => [tool.name, tool] satisfies [string, AgentTool<unknown, unknown>])
  )
  const providerTools = toProviderToolDefinitions(tools)
  const executionSession = new LiveAgentExecutionSession(input.onDiagnostics)

  await executionSession.appendMessage(
    {
      role: 'system',
      content: buildLiveAgentSystemPrompt({
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
      content: buildLiveAgentUserPrompt({
        task: input.task,
        header: input.header,
        startInput: input.input,
        shell: input.shell
      })
    },
    0
  )

  let stepState = createInitialLiveAgentStepState()

  for (let step = 1; step <= input.config.maxSteps; step += 1) {
    const stepResult = await executeLiveAgentStep({
      step,
      provider: input.provider,
      providerTools,
      executionSession,
      toolsByName,
      toolContext,
      state: stepState,
      maxToolConcurrency: input.config.maxToolConcurrency,
      maxStructuredOutputRetries: input.config.maxStructuredOutputRetries,
      onProgress: input.onProgress
    })

    stepState = stepResult.state

    if (stepResult.kind === 'success') {
      return executionSession.buildSuccessResult({
        submittedResult: stepResult.submittedResult,
        assistantText: stepResult.assistantText
      })
    }

    if (stepResult.kind === 'error') {
      return executionSession.fail({
        subtype: stepResult.subtype,
        detail: stepResult.detail,
        providerCode: stepResult.providerCode,
        assistantText: stepResult.assistantText
      })
    }
  }

  return executionSession.fail({
    subtype: 'error_max_turns',
    detail: buildLiveAgentMissingStructuredOutputDetail(
      stepState.lastAssistantText
    ),
    assistantText: stepState.lastAssistantText
  })
}
