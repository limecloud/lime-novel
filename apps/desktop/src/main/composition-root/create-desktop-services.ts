import { app, dialog } from 'electron'
import { access } from 'node:fs/promises'
import {
  type AgentRuntimeConnectionTestResultDto,
  type AgentRuntimeSettingsDto,
  type AgentRuntimeSettingsStateDto,
  createApplyProjectStrategyProposalUseCase,
  createApplyProposalUseCase,
  createCommitCanonCardUseCase,
  createCreateProjectWorkspaceUseCase,
  createCreateExportPackageUseCase,
  createGenerateKnowledgeAnswerUseCase,
  createImportAnalysisSampleUseCase,
  createLoadKnowledgeDocumentUseCase,
  createLoadChapterDocumentUseCase,
  createLoadWorkspaceShellUseCase,
  createRejectProposalUseCase,
  createSaveChapterDocumentUseCase,
  createSearchWorkspaceUseCase,
  createUndoRevisionRecordUseCase,
  createUpdateRevisionIssueUseCase,
  createUpdateWorkspaceContextUseCase
} from '@lime-novel/application'
import {
  createConfiguredLLMProvider,
  createLocalAgentRuntime,
  resolveAgentRuntimeConfig
} from '@lime-novel/agent-runtime'
import { createFileSystemNovelRepository, createNovelProjectWorkspace } from '@lime-novel/infrastructure'
import { join } from 'node:path'
import { createAgentRuntimeSettingsStore } from './agent-runtime-settings-store'
import { createWorkspaceStateStore } from './workspace-state'

const toAgentRuntimeEnv = (settings: AgentRuntimeSettingsDto): NodeJS.ProcessEnv => {
  const env = {
    ...process.env
  }

  env.LIME_NOVEL_AGENT_PROVIDER = settings.provider

  if (settings.baseUrl) {
    env.LIME_NOVEL_AGENT_BASE_URL = settings.baseUrl
  } else {
    delete env.LIME_NOVEL_AGENT_BASE_URL
  }

  if (settings.apiKey) {
    env.LIME_NOVEL_AGENT_API_KEY = settings.apiKey
  } else {
    delete env.LIME_NOVEL_AGENT_API_KEY
  }

  if (settings.model) {
    env.LIME_NOVEL_AGENT_MODEL = settings.model
  } else {
    delete env.LIME_NOVEL_AGENT_MODEL
  }

  return env
}

const buildAgentRuntimeSettingsState = (
  settings: AgentRuntimeSettingsDto
): AgentRuntimeSettingsStateDto => {
  const runtimeConfig = resolveAgentRuntimeConfig(toAgentRuntimeEnv(settings))

  return {
    settings,
    resolvedProvider: runtimeConfig.provider,
    resolvedBaseUrl: runtimeConfig.baseUrl,
    resolvedModel: runtimeConfig.provider === 'legacy' ? '规则型本地收口' : runtimeConfig.model,
    mode: runtimeConfig.provider === 'legacy' ? 'legacy' : 'live'
  }
}

const testAgentRuntimeSettingsConnection = async (
  settings: AgentRuntimeSettingsDto
): Promise<AgentRuntimeConnectionTestResultDto> => {
  const runtimeConfig = resolveAgentRuntimeConfig(toAgentRuntimeEnv(settings))

  if (runtimeConfig.provider === 'legacy') {
    return {
      mode: 'legacy',
      provider: 'legacy',
      model: '规则型本地收口',
      baseUrl: '',
      latencyMs: 0,
      summary: '当前是本地规则模式，无需进行外部模型连接测试。'
    }
  }

  const provider = createConfiguredLLMProvider({
    ...runtimeConfig,
    requestTimeoutMs: Math.min(runtimeConfig.requestTimeoutMs, 15_000),
    temperature: 0
  })

  if (!provider) {
    throw new Error('当前 Provider 没有可用的 live 连接器。')
  }

  const startedAt = Date.now()
  const completion = await provider.completeTurn({
    messages: [
      {
        role: 'system',
        content: '你是 Lime Novel 的连通性检测助手。请只用简体中文回复“连接成功”。'
      },
      {
        role: 'user',
        content: '请回复：连接成功'
      }
    ],
    tools: []
  })

  return {
    mode: 'live',
    provider: runtimeConfig.provider,
    model: runtimeConfig.model,
    baseUrl: runtimeConfig.baseUrl,
    latencyMs: Date.now() - startedAt,
    summary: `已成功连到 ${runtimeConfig.provider}，模型 ${runtimeConfig.model} 可以响应请求。`,
    responseText: completion.assistantText,
    stopReason: completion.stopReason
  }
}

export const createDesktopServices = async () => {
  const projectsRoot = join(app.getPath('documents'), 'Lime Novel Projects')
  const envRuntimeConfig = resolveAgentRuntimeConfig()
  const agentRuntimeSettingsStore = createAgentRuntimeSettingsStore(app.getPath('userData'), {
    provider: envRuntimeConfig.provider,
    baseUrl: process.env.LIME_NOVEL_AGENT_BASE_URL?.trim() || '',
    apiKey: process.env.LIME_NOVEL_AGENT_API_KEY?.trim() || '',
    model: process.env.LIME_NOVEL_AGENT_MODEL?.trim() || ''
  })
  const workspaceStateStore = createWorkspaceStateStore(app.getPath('userData'), projectsRoot)
  let repository = createFileSystemNovelRepository(await workspaceStateStore.resolveInitialWorkspace())
  const agentRuntime = createLocalAgentRuntime(() => repository, async () => {
    const settings = await agentRuntimeSettingsStore.load()
    return resolveAgentRuntimeConfig(toAgentRuntimeEnv(settings))
  })

  const switchWorkspace = async (workspacePath: string) => {
    await access(join(workspacePath, 'novel.json'))
    repository = createFileSystemNovelRepository(workspacePath)
    await workspaceStateStore.rememberWorkspace(workspacePath)
    const shell = await repository.loadWorkspaceShell()

    return {
      workspacePath: shell.workspacePath,
      projectId: shell.project.projectId,
      title: shell.project.title
    }
  }

  return {
    agentRuntime,
    loadWorkspaceShell: () => createLoadWorkspaceShellUseCase(repository)(),
    searchWorkspace: (input: Parameters<ReturnType<typeof createSearchWorkspaceUseCase>>[0]) =>
      createSearchWorkspaceUseCase(repository)(input),
    loadKnowledgeDocument: (relativePath: string) => createLoadKnowledgeDocumentUseCase(repository)(relativePath),
    generateKnowledgeAnswer: (input: Parameters<ReturnType<typeof createGenerateKnowledgeAnswerUseCase>>[0]) =>
      createGenerateKnowledgeAnswerUseCase(repository)(input),
    updateWorkspaceContext: (input: Parameters<ReturnType<typeof createUpdateWorkspaceContextUseCase>>[0]) =>
      createUpdateWorkspaceContextUseCase(repository)(input),
    createProject: async (input: Parameters<ReturnType<typeof createCreateProjectWorkspaceUseCase>>[0]) => {
      const project = await createCreateProjectWorkspaceUseCase({
        createProject: (payload) => createNovelProjectWorkspace(projectsRoot, payload)
      })(input)

      await switchWorkspace(project.workspacePath)

      return project
    },
    openProjectDialog: async () => {
      const result = await dialog.showOpenDialog({
        title: '打开小说项目',
        properties: ['openDirectory'],
        buttonLabel: '打开项目目录'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      try {
        return await switchWorkspace(result.filePaths[0])
      } catch {
        await dialog.showMessageBox({
          type: 'error',
          title: '无法打开项目',
          message: '所选目录不是有效的 Lime Novel 项目。',
          detail: '请确认目录下包含 novel.json 配置文件。'
        })

        return null
      }
    },
    loadChapterDocument: (chapterId: string) => createLoadChapterDocumentUseCase(repository)(chapterId),
    saveChapterDocument: (input: Parameters<ReturnType<typeof createSaveChapterDocumentUseCase>>[0]) =>
      createSaveChapterDocumentUseCase(repository)(input),
    applyProposal: (proposalId: string) => createApplyProposalUseCase(repository)(proposalId),
    rejectProposal: (proposalId: string) => createRejectProposalUseCase(repository)(proposalId),
    importAnalysisSample: async () => {
      const result = await dialog.showOpenDialog({
        title: '导入拆书样本',
        properties: ['openFile'],
        buttonLabel: '导入样本文件',
        filters: [
          {
            name: '文本文件',
            extensions: ['txt', 'md', 'markdown']
          }
        ]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return createImportAnalysisSampleUseCase(repository)({
        filePath: result.filePaths[0]
      })
    },
    applyProjectStrategyProposal: (
      input: Parameters<ReturnType<typeof createApplyProjectStrategyProposalUseCase>>[0]
    ) => createApplyProjectStrategyProposalUseCase(repository)(input),
    commitCanonCard: (input: Parameters<ReturnType<typeof createCommitCanonCardUseCase>>[0]) =>
      createCommitCanonCardUseCase(repository)(input),
    updateRevisionIssue: (input: Parameters<ReturnType<typeof createUpdateRevisionIssueUseCase>>[0]) =>
      createUpdateRevisionIssueUseCase(repository)(input),
    undoRevisionRecord: (recordId: string) => createUndoRevisionRecordUseCase(repository)(recordId),
    createExportPackage: (input: Parameters<ReturnType<typeof createCreateExportPackageUseCase>>[0]) =>
      createCreateExportPackageUseCase(repository)(input),
    loadAgentRuntimeSettings: async () => buildAgentRuntimeSettingsState(await agentRuntimeSettingsStore.load()),
    saveAgentRuntimeSettings: async (input: AgentRuntimeSettingsDto) =>
      buildAgentRuntimeSettingsState(await agentRuntimeSettingsStore.save(input)),
    testAgentRuntimeSettings: (input: AgentRuntimeSettingsDto) => testAgentRuntimeSettingsConnection(input),
    startAgentTask: (input: Parameters<typeof agentRuntime.startTask>[0]) => agentRuntime.startTask(input),
    loadAgentTaskDiagnostics: () => agentRuntime.loadTaskDiagnostics()
  }
}

export type DesktopServices = Awaited<ReturnType<typeof createDesktopServices>>
