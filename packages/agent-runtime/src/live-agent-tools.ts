import type {
  AgentTool,
  AgentToolContext,
  ProviderToolDefinition
} from './live-agent-types'
import { createLivePersistenceTools } from './live-agent-persistence-tools'
import {
  createSubmitTaskResultTool
} from './live-agent-result-tool'
import { createLiveWorkspaceTools } from './live-agent-workspace-tools'

export const createLiveAgentTools = (
  context: AgentToolContext
): AgentTool<unknown, unknown>[] => [
  ...createLiveWorkspaceTools(context),
  ...createLivePersistenceTools(context),
  createSubmitTaskResultTool()
]

export const toProviderToolDefinitions = (tools: AgentTool<unknown, unknown>[]): ProviderToolDefinition[] =>
  tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
