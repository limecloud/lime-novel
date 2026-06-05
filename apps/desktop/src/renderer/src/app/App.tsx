import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  AgentTaskDto,
  AgentRuntimeConnectionTestResultDto,
  AgentRuntimeSettingsDto,
  AgentRuntimeSettingsStateDto,
  GenerateKnowledgeAnswerInputDto,
  GenerateKnowledgeAnswerResultDto,
  HarnessCommandInputDto,
  ImportKnowledgeDocumentResultDto,
  StartTaskInputDto
} from '@lime-novel/application'
import type { FeatureToolId, NovelSurfaceId } from '@lime-novel/domain-novel'
import { desktopApi } from '../lib/desktop-api'
import { agentFeedStore, useAgentFeedState } from '../lib/agent-feed-store'
import { queryClient } from '../lib/query-client'
import type { AgentSidebarMode } from '../features/agent-feed/AgentSidebar'
import { NovelWorkbench } from '../features/workbench/NovelWorkbench'
import limeLogoUrl from '../assets/logo-lime.png'
import {
  buildFeatureToolSurfaceState,
  buildSurfaceHeaderFallback,
  normalizeWorkspaceSurfaceState,
  resolveRuntimeSurface,
  resolveSidebarModeForSurface
} from './app-surface-policy'
import { limeNovelBrand } from './branding'

const runtimeProviderLabel: Record<AgentRuntimeSettingsStateDto['resolvedProvider'], string> = {
  legacy: '本地规则模式',
  anthropic: 'Claude / Anthropic',
  'openai-compatible': 'OpenAI Compatible'
}

const resolveRuntimeLabel = (state: AgentRuntimeSettingsStateDto): string =>
  state.appServer?.mode === 'external' ? 'Lime App Server external backend' : runtimeProviderLabel[state.resolvedProvider]

const terminalAgentTaskStatuses = new Set<AgentTaskDto['status']>(['completed', 'failed', 'waiting_approval'])

const harnessCommandStatusLabel: Record<HarnessCommandInputDto['command'], string> = {
  'sync-story-state': '故事状态同步',
  'update-character-line': '人物线更新',
  'check-foreshadowing': '伏笔线检查',
  'analyze-revision-impact': '改动影响检查',
  'check-platform-risk': '发布避雷检查',
  'import-reader-feedback': '读者反馈导入',
  'toggle-skill': '能力包切换',
  'update-platform-risk': '发布风险确认',
  'undo-change-set': '变更包撤回',
  'undo-derived-state': '派生状态撤回'
}

const writingAgentHarnessCommands = new Set<HarnessCommandInputDto['command']>([
  'sync-story-state',
  'update-character-line',
  'check-foreshadowing',
  'analyze-revision-impact',
  'check-platform-risk',
  'import-reader-feedback'
])

const localCompatHarnessCommands = new Set<HarnessCommandInputDto['command']>([
  'toggle-skill',
  'update-platform-risk',
  'undo-change-set',
  'undo-derived-state'
])

const buildIntent = (lines: Array<string | undefined>): string =>
  lines.filter((line): line is string => Boolean(line?.trim())).join('\n')

const buildLiveHarnessRequirement = (command: HarnessCommandInputDto['command']): string =>
  buildIntent([
    `来源命令：${command}。`,
    '必须通过真实 Lime App Server / AI Agent 运行服务执行，不允许使用本地规则、mock、静态样例或旧 harness 结果替代。',
    '需要先读取工作区快照；涉及章节时读取当前章正文；涉及跨章节、人物线、伏笔线、读者反馈或发布规则时使用搜索和 Novel Harness 工具。',
    '需要落结构化产物时先调用对应工具保存 report、impact、intent plan、feedback 或 timeline iteration，最后必须调用 submit_task_result。'
  ])

const buildWritingAgentIntent = (input: HarnessCommandInputDto): string => {
  if (input.command === 'sync-story-state') {
    return buildIntent([
      buildLiveHarnessRequirement(input.command),
      input.chapterId ? `目标章节：${input.chapterId}。` : '目标范围：项目/全书故事状态。',
      input.triggerEventId ? `触发事件：${input.triggerEventId}。` : undefined,
      `作者意图：${input.intent ?? '同步当前故事状态，整理人物线、伏笔线、平台风险和下一步动作。'}`,
      '输出要求：生成可审阅的故事状态同步结果；如果需要改动正文或派生状态，必须以待确认结果呈现，不要直接静默落地。'
    ])
  }

  if (input.command === 'update-character-line') {
    return buildIntent([
      buildLiveHarnessRequirement(input.command),
      input.chapterId ? `目标章节：${input.chapterId}。` : undefined,
      `作者意图：${input.intent ?? '根据当前章同步人物线。'}`,
      '输出要求：读取正文、场景目标、已有角色状态和设定卡，提炼人物目标、关系压力、状态变化和证据；需要写回时必须生成待确认产物。'
    ])
  }

  if (input.command === 'check-foreshadowing') {
    return buildIntent([
      buildLiveHarnessRequirement(input.command),
      input.chapterId ? `目标章节：${input.chapterId}。` : undefined,
      `作者意图：${input.intent ?? '检查当前章伏笔线。'}`,
      '输出要求：检查埋下、加深、误导、接近回收和逾期伏笔，给出证据、风险等级和下一步动作。'
    ])
  }

  if (input.command === 'analyze-revision-impact') {
    return buildIntent([
      buildLiveHarnessRequirement(input.command),
      input.chapterId ? `目标章节：${input.chapterId}。` : undefined,
      `作者意图：${input.intent ?? '分析当前改动会牵动哪些人物线、伏笔线、后文反转和读者体验。'}`,
      '输出要求：必须生成冲击波分析或诊断结果，列出受影响对象、风险、建议和是否需要作者确认。'
    ])
  }

  if (input.command === 'check-platform-risk') {
    return buildIntent([
      buildLiveHarnessRequirement(input.command),
      input.chapterId ? `目标章节：${input.chapterId}。` : undefined,
      input.platform ? `目标平台：${input.platform}。` : '目标平台：general。',
      `作者意图：${input.intent ?? '检查当前内容的发布避雷风险。'}`,
      '输出要求：按平台规则检查敏感表达、节奏、发布阻断和替代表达；只记录风险时不要生成正文 patch。'
    ])
  }

  if (input.command === 'import-reader-feedback') {
    return buildIntent([
      buildLiveHarnessRequirement(input.command),
      `反馈来源：${input.source ?? '未标注来源'}。`,
      `读者反馈：${input.comments}`,
      '输出要求：映射到章节、人物、节奏、设定、伏笔、期待或发布风险，生成证据映射和待确认动作。'
    ])
  }

  return buildLiveHarnessRequirement(input.command)
}

const buildWritingAgentTaskInput = (
  input: HarnessCommandInputDto,
  fallbackChapterId?: string
): StartTaskInputDto => {
  const chapterId = 'chapterId' in input ? input.chapterId ?? fallbackChapterId : fallbackChapterId

  return {
    surface: input.command === 'import-reader-feedback' ? 'home' : 'writing',
    chapterId,
    intent: buildWritingAgentIntent(input),
    runtimeOptions: {
      metadata: {
        requiresLive: true,
        sourceCommand: input.command,
        command: {
          kind: `harness.${input.command}`
        }
      }
    }
  }
}

export const App = () => {
  const [activeSurface, setActiveSurface] = useState<NovelSurfaceId>('home')
  const [activeFeatureTool, setActiveFeatureTool] = useState<FeatureToolId | undefined>()
  const [sidebarMode, setSidebarMode] = useState<AgentSidebarMode>('suggestions')
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [backgroundAutomationCount, setBackgroundAutomationCount] = useState(0)
  const lastHydratedWorkspaceKeyRef = useRef<string | null>(null)
  const autoMaintenanceKeysRef = useRef(new Set<string>())
  const autoMaintenanceBatchesRef = useRef(new Map<string, Set<string>>())
  const feedState = useAgentFeedState()

  const shellQuery = useQuery({
    queryKey: ['workspace-shell'],
    queryFn: () => desktopApi.workspace.loadShell()
  })

  const agentSettingsQuery = useQuery({
    queryKey: ['agent-runtime-settings'],
    queryFn: () => desktopApi.agent.loadSettings()
  })

  const activeWorkspacePath = shellQuery.data?.workspacePath ?? ''
  const agentRuntimeState = agentSettingsQuery.data
  const isLiveAgentReady = agentRuntimeState?.mode === 'live'

  const showLiveAgentRequiredStatus = (title = '需要真实 AI 运行服务'): void => {
    agentFeedStore.addLocalStatus(
      title,
      agentRuntimeState?.mode === 'legacy'
        ? '当前仍是本地规则模式，写作生成、分析、同步和诊断已禁止走 mock/harness 兜底。'
        : 'AI Agent 设置尚未加载完成，暂时不能提交需要真实模型的任务。',
      '请在 AI Agent 设置中配置 Anthropic 或 OpenAI Compatible provider、模型和 API Key 后重试。'
    )
  }

  const canSubmitLiveAgentTask = (): boolean => {
    if (isLiveAgentReady) {
      return true
    }

    showLiveAgentRequiredStatus()
    return false
  }

  const syncBackgroundAutomationCount = (): void => {
    setBackgroundAutomationCount(autoMaintenanceKeysRef.current.size)
  }

  const resolveAutomationChapterId = (automationKey: string): string => {
    const [, chapterId] = automationKey.split('::')
    return chapterId || automationKey
  }

  const closePostSaveAutomation = (automationKey: string, shouldNotify: boolean): void => {
    const wasActive = autoMaintenanceKeysRef.current.delete(automationKey)
    autoMaintenanceBatchesRef.current.delete(automationKey)

    if (!wasActive) {
      return
    }

    syncBackgroundAutomationCount()

    if (shouldNotify) {
      agentFeedStore.addLocalStatus(
        '后台整理已收口',
        '设定候选、修订问题或失败提示已经同步到右栏与项目状态。',
        `章节 ${resolveAutomationChapterId(automationKey)}`
      )
    }

    void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
  }

  const settlePostSaveAutomationTask = (task: AgentTaskDto): void => {
    if (!terminalAgentTaskStatuses.has(task.status)) {
      return
    }

    for (const [automationKey, taskIds] of autoMaintenanceBatchesRef.current.entries()) {
      if (!taskIds.delete(task.taskId)) {
        continue
      }

      if (taskIds.size === 0) {
        closePostSaveAutomation(automationKey, true)
      }

      return
    }
  }

  const reconcilePostSaveAutomation = (tasks: AgentTaskDto[]): void => {
    if (autoMaintenanceBatchesRef.current.size === 0) {
      return
    }

    for (const task of tasks) {
      settlePostSaveAutomationTask(task)
    }
  }

  const triggerPostSaveAutomation = (chapterId: string) => {
    if (!activeWorkspacePath) {
      return
    }

    if (!isLiveAgentReady) {
      agentFeedStore.addLocalStatus(
        '后台整理未启动',
        '正文已保存；设定代理与修订代理需要真实 AI 运行服务，已阻止本地规则兜底。',
        '配置 live provider 后可重新保存或手动发起整理。'
      )
      return
    }

    const automationKey = `${activeWorkspacePath}::${chapterId}`

    if (autoMaintenanceKeysRef.current.has(automationKey)) {
      return
    }

    autoMaintenanceKeysRef.current.add(automationKey)
    syncBackgroundAutomationCount()
    agentFeedStore.addLocalStatus(
      '后台整理已启动',
      '设定代理与修订代理正在同步候选卡和问题队列。',
      `章节 ${chapterId}`
    )

    void (async () => {
      const batchTaskIds = new Set<string>()
      autoMaintenanceBatchesRef.current.set(automationKey, batchTaskIds)
      const maintenanceTasks: Array<{ surface: NovelSurfaceId; intent: string }> = [
        {
          surface: 'canon',
          intent: '请把当前章节新增的角色、物件和规则提炼成候选设定卡，并标出证据。'
        },
        {
          surface: 'revision',
          intent: '请检查本章是否出现连续性、视角或节奏问题，并把问题写回修订队列。'
        }
      ]

      for (const task of maintenanceTasks) {
        try {
          const result = await desktopApi.agent.startTask({
            surface: task.surface,
            intent: task.intent,
            chapterId,
            runtimeOptions: {
              metadata: {
                requiresLive: true,
                sourceCommand: 'post-save-automation'
              }
            }
          })
          batchTaskIds.add(result.task.taskId)
        } catch (error) {
          agentFeedStore.addLocalStatus(
            `${task.surface === 'canon' ? '设定' : '修订'}后台更新失败`,
            error instanceof Error ? error.message : '后台自动更新没有执行成功。',
            chapterId
          )
        }
      }

      if (batchTaskIds.size === 0) {
        closePostSaveAutomation(automationKey, false)
        return
      }

      reconcilePostSaveAutomation(shellQuery.data?.agentTasks ?? [])
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
    })()
  }

  const chapterQuery = useQuery({
    queryKey: ['chapter-document', activeWorkspacePath, activeChapterId],
    enabled: Boolean(activeChapterId),
    queryFn: () => desktopApi.chapter.loadDocument(activeChapterId as string)
  })

  const startTaskMutation = useMutation({
    mutationFn: (payload: StartTaskInputDto) => desktopApi.agent.startTask(payload),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      const runtimeState = agentSettingsQuery.data

      if (runtimeState?.mode === 'legacy') {
        agentFeedStore.addLocalStatus(
          '代理任务已提交',
          `${result.task.title} 已进入 Lime App Server 主链路。`,
          '当前未配置 live provider 时任务会失败并提示，不再使用本地规则结果冒充完成。'
        )
        return
      }

      if (runtimeState) {
        agentFeedStore.addLocalStatus(
          '代理任务已提交',
          `${result.task.title} 已接入 ${resolveRuntimeLabel(runtimeState)}，正在后台执行。`,
          `${runtimeState.resolvedModel} · ${result.task.summary}`
        )
        return
      }

      agentFeedStore.addLocalStatus('代理任务已提交', result.task.title, result.task.summary)
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '代理任务启动失败',
        error instanceof Error ? error.message : '当前任务暂时无法启动。',
        '请稍后重试'
      )
    }
  })

  const saveAgentSettingsMutation = useMutation({
    mutationFn: (input: AgentRuntimeSettingsDto) => desktopApi.agent.saveSettings(input),
    onSuccess: (result) => {
      queryClient.setQueryData(['agent-runtime-settings'], result)
      agentFeedStore.addLocalStatus(
        'AI Agent 设置已保存',
        result.mode === 'legacy'
          ? '尚未配置 Lime App Server external backend；写作生成、分析、同步和诊断不会走规则型兜底。'
          : `已接入 ${resolveRuntimeLabel(result)}，新发起的任务会使用 ${result.resolvedModel}。`,
        result.mode === 'legacy' ? '需要真实 AI 运行服务的任务会被阻止' : `${result.resolvedBaseUrl} · 新任务立即生效`
      )
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        'AI Agent 设置保存失败',
        error instanceof Error ? error.message : '当前模型设置暂时没有保存成功。',
        '请稍后重试'
      )
    }
  })

  const testAgentSettingsMutation = useMutation({
    mutationFn: (input: AgentRuntimeSettingsDto): Promise<AgentRuntimeConnectionTestResultDto> =>
      desktopApi.agent.testSettings(input),
    onSuccess: (result) => {
      agentFeedStore.addLocalStatus(
        'AI Agent 连接测试成功',
        result.summary,
        `${runtimeProviderLabel[result.provider]} · ${result.model} · ${result.latencyMs}ms`
      )
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        'AI Agent 连接测试失败',
        error instanceof Error ? error.message : '当前配置没有通过连接测试。',
        '请检查 provider、API Key、模型和 Base URL'
      )
    }
  })

  const runHarnessCommandMutation = useMutation({
    mutationFn: (input: HarnessCommandInputDto) => desktopApi.harness.runCommand(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      const relatedRefs = [
        result.syncRunId ? `同步 ${result.syncRunId}` : undefined,
        result.changeSetId ? `变更包 ${result.changeSetId}` : undefined,
        result.protectionPointId ? `保护点 ${result.protectionPointId}` : undefined,
        result.contextBundleId ? `上下文 ${result.contextBundleId}` : undefined
      ].filter(Boolean)

      agentFeedStore.addLocalStatus(
        `${harnessCommandStatusLabel[result.command]}已完成`,
        result.summary,
        relatedRefs.length > 0 ? relatedRefs.join(' · ') : `${result.affectedRefs.length} 个故事对象已更新`
      )
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '故事指令执行失败',
        error instanceof Error ? error.message : '当前故事指令暂时没有执行成功。',
        '请稍后重试'
      )
    }
  })

  const runWritingAgentCommand = (input: HarnessCommandInputDto): void => {
    if (writingAgentHarnessCommands.has(input.command)) {
      if (!canSubmitLiveAgentTask()) {
        return
      }

      const taskInput = buildWritingAgentTaskInput(input, activeChapterId ?? undefined)
      startTaskMutation.mutate(taskInput)
      return
    }

    if (localCompatHarnessCommands.has(input.command)) {
      runHarnessCommandMutation.mutate(input)
      return
    }

    agentFeedStore.addLocalStatus(
      '故事指令未执行',
      `${input.command} 还没有被归类到 live agent 或本地兼容路径。`,
      '请先完成命令治理分类。'
    )
  }

  const updateContextMutation = useMutation({
    mutationFn: (payload: { surface: NovelSurfaceId; featureTool?: FeatureToolId; chapterId?: string }) =>
      desktopApi.workspace.updateContext(payload)
  })

  const generateKnowledgeAnswerMutation = useMutation({
    mutationFn: (payload: GenerateKnowledgeAnswerInputDto): Promise<GenerateKnowledgeAnswerResultDto> =>
      desktopApi.knowledge.generateAnswer(payload),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('知识问答已写入项目', result.summary, result.relativePath)
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '知识问答生成失败',
        error instanceof Error ? error.message : '当前问题暂时无法写入知识输出目录。',
        '请换个问法，或先补充更多项目资料'
      )
    }
  })

  const importKnowledgeDocumentMutation = useMutation({
    mutationFn: (): Promise<ImportKnowledgeDocumentResultDto | null> => desktopApi.knowledge.importDocument(),
    onSuccess: async (result) => {
      if (!result) {
        return
      }

      setActiveSurface('knowledge')
      setActiveFeatureTool(undefined)
      setSidebarMode(resolveSidebarModeForSurface('knowledge'))
      await queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('知识资料已导入', result.summary, result.relativePath)
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '导入知识资料失败',
        error instanceof Error ? error.message : '当前资料暂时无法写入知识库。',
        '请选择一个 .txt 或 .md 文件后重试'
      )
    }
  })

  const createProjectMutation = useMutation({
    mutationFn: (payload: {
      title: string
      genre: string
      premise: string
      template: 'blank' | 'mystery'
    }) => desktopApi.workspace.createProject(payload),
    onSuccess: async (result) => {
      lastHydratedWorkspaceKeyRef.current = null
      setActiveSurface('home')
      setActiveFeatureTool(undefined)
      setActiveChapterId(null)
      setSidebarMode(resolveSidebarModeForSurface('home'))
      queryClient.removeQueries({ queryKey: ['chapter-document'] })
      await queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('项目已创建', result.title, result.workspacePath)
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '创建项目失败',
        error instanceof Error ? error.message : '新的项目目录暂时无法创建。',
        '请稍后重试'
      )
    }
  })

  const openProjectMutation = useMutation({
    mutationFn: () => desktopApi.workspace.openProjectDialog(),
    onSuccess: async (result) => {
      if (!result) {
        return
      }

      lastHydratedWorkspaceKeyRef.current = null
      setActiveSurface('home')
      setActiveFeatureTool(undefined)
      setActiveChapterId(null)
      setSidebarMode(resolveSidebarModeForSurface('home'))
      queryClient.removeQueries({ queryKey: ['chapter-document'] })
      await queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('项目已打开', result.title, result.workspacePath)
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '打开项目失败',
        error instanceof Error ? error.message : '项目目录暂时不可用。',
        '请确认目录下包含 novel.json'
      )
    }
  })

  const saveChapterMutation = useMutation({
    mutationFn: (payload: { chapterId: string; content: string }) =>
      desktopApi.chapter.saveDocument(payload),
    onSuccess: (result) => {
      queryClient.setQueryData(['chapter-document', activeWorkspacePath, result.chapterId], (previous) =>
        previous && typeof previous === 'object'
          ? {
              ...(previous as Record<string, unknown>),
              content: result.content,
              wordCount: result.wordCount,
              lastEditedAt: result.lastEditedAt
            }
          : previous
      )
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('正文已保存', result.summary, `${result.lastEditedAt} · ${result.wordCount} 字`)
      triggerPostSaveAutomation(result.chapterId)
    }
  })

  const importAnalysisSampleMutation = useMutation({
    mutationFn: () => desktopApi.analysis.importSample(),
    onSuccess: async (result) => {
      if (!result) {
        return
      }

      setActiveSurface('feature-center')
      setActiveFeatureTool('analysis')
      setSidebarMode(resolveSidebarModeForSurface('feature-center'))
      await queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('爆款样本已导入', result.summary, result.title)
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '导入样本失败',
        error instanceof Error ? error.message : '当前样本暂时没有完成导入。',
        '请选择一个 .txt 或 .md 文件后重试。'
      )
    }
  })

  const applyProjectStrategyProposalMutation = useMutation({
    mutationFn: (payload: { sampleId: string }) => desktopApi.analysis.applyStrategyProposal(payload),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus(
        '拆书结论已回写',
        result.summary,
        `${result.createdCanonCardIds.length} 张候选卡 · ${result.createdQuickActionIds.length} 个快捷动作`
      )
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '回写项目策略失败',
        error instanceof Error ? error.message : '当前拆书结论暂时无法回写。',
        '请稍后重试'
      )
    }
  })

  const applyProposalMutation = useMutation({
    mutationFn: (proposalId: string) => desktopApi.chapter.applyProposal(proposalId),
    onSuccess: (result) => {
      queryClient.setQueryData(['chapter-document', activeWorkspacePath, result.chapterId], (previous) =>
        previous && typeof previous === 'object'
          ? {
              ...(previous as Record<string, unknown>),
              content: result.content,
              wordCount: result.content.length
            }
          : previous
      )
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      void queryClient.invalidateQueries({ queryKey: ['chapter-document', activeWorkspacePath, result.chapterId] })
      agentFeedStore.addLocalStatus('提议已应用', result.summary, '正文草稿已同步更新')
      triggerPostSaveAutomation(result.chapterId)
    }
  })

  const rejectProposalMutation = useMutation({
    mutationFn: (proposalId: string) => desktopApi.chapter.rejectProposal(proposalId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('提议已拒绝', result.summary, result.proposalId)
    }
  })

  const commitCanonCardMutation = useMutation({
    mutationFn: (payload: { cardId: string; visibility: 'candidate' | 'confirmed' | 'archived' }) =>
      desktopApi.canon.commitCard(payload),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('设定卡已写回', result.summary, result.outputPath)
    }
  })

  const updateRevisionIssueMutation = useMutation({
    mutationFn: (payload: { issueId: string; status: 'open' | 'deferred' | 'resolved' }) =>
      desktopApi.revision.updateIssue(payload),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('修订队列已更新', result.summary, result.issueId)
    }
  })

  const undoRevisionRecordMutation = useMutation({
    mutationFn: (recordId: string) => desktopApi.revision.undoRecord(recordId),
    onSuccess: (result) => {
      setActiveChapterId(result.chapterId)
      queryClient.setQueryData(['chapter-document', activeWorkspacePath, result.chapterId], (previous) =>
        previous && typeof previous === 'object'
          ? {
              ...(previous as Record<string, unknown>),
              content: result.content,
              wordCount: result.content.length
            }
          : previous
      )
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      void queryClient.invalidateQueries({ queryKey: ['chapter-document', activeWorkspacePath, result.chapterId] })
      agentFeedStore.addLocalStatus('修订已撤销', result.summary, result.recordId)
      triggerPostSaveAutomation(result.chapterId)
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '撤销修订失败',
        error instanceof Error ? error.message : '当前修订记录暂时不能直接撤销。',
        '请先比较当前正文与修订快照。'
      )
    }
  })

  const createExportPackageMutation = useMutation({
    mutationFn: (payload: {
      presetId: string
      synopsis: string
      splitChapters: number
      versionTag: string
      notes: string
    }) =>
      desktopApi.publish.createExportPackage(payload),
    onSuccess: async (result) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('导出包已生成', result.summary, `${result.versionTag} · ${result.outputDir}`)

      if (!isLiveAgentReady) {
        agentFeedStore.addLocalStatus(
          '发布复核未自动启动',
          '发布代理需要真实 AI 运行服务，已阻止本地规则兜底。',
          result.versionTag
        )
        return
      }

      try {
        await desktopApi.agent.startTask({
          surface: 'publish',
          intent: '请复核这次导出结果并同步平台反馈与最终确认建议。',
          runtimeOptions: {
            metadata: {
              requiresLive: true,
              sourceCommand: 'publish-export-review'
            }
          }
        })
      } catch (error) {
        agentFeedStore.addLocalStatus(
          '发布复核未自动完成',
          error instanceof Error ? error.message : '导出后的发布复核暂时没有成功启动。',
          result.versionTag
        )
      }
    }
  })

  useEffect(() => {
    const unsubscribe = desktopApi.agent.subscribeTaskEvents((event) => {
      agentFeedStore.applyEvent(event)

      if (event.type === 'task.updated') {
        settlePostSaveAutomationTask(event.task)
      }

      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!shellQuery.data) {
      return
    }

    reconcilePostSaveAutomation(shellQuery.data.agentTasks)
  }, [shellQuery.data])

  useEffect(() => {
    const shell = shellQuery.data

    if (!shell) {
      return
    }

    const workspaceKey = `${shell.workspacePath}::${shell.project.projectId}`

    if (workspaceKey === lastHydratedWorkspaceKeyRef.current) {
      agentFeedStore.syncFromShell({
        header: shell.agentHeader,
        tasks: shell.agentTasks,
        feed: shell.agentFeed
      })
      return
    }

    lastHydratedWorkspaceKeyRef.current = workspaceKey
    const nextState = normalizeWorkspaceSurfaceState(shell.project.currentSurface, shell.project.currentFeatureTool)
    setActiveSurface(nextState.surface)
    setActiveFeatureTool(nextState.featureTool)
    setActiveChapterId(shell.project.currentChapterId)
    setSidebarMode(resolveSidebarModeForSurface(nextState.surface))
    agentFeedStore.hydrate({
      header: shell.agentHeader,
      tasks: shell.agentTasks,
      feed: shell.agentFeed
    })
  }, [shellQuery.data])

  useEffect(() => {
    const shell = shellQuery.data

    if (!shell) {
      return
    }

    const activeTaskIds = new Set(shell.agentTasks.map((task) => task.taskId))
    let disposed = false

    void desktopApi.agent.loadTaskDiagnostics().then((diagnostics) => {
      if (disposed) {
        return
      }

      agentFeedStore.mergeDiagnostics(diagnostics.filter((item) => activeTaskIds.has(item.taskId)))
    }).catch(() => undefined)

    return () => {
      disposed = true
    }
  }, [shellQuery.data])

  const displayFeedState = useMemo(() => {
    const feedSurface = resolveRuntimeSurface({
      surface: activeSurface,
      featureTool: activeFeatureTool
    })
    const isSurfaceAligned = feedState.header.surface === feedSurface
    const fallbackHeader = buildSurfaceHeaderFallback(feedSurface)
    const surfaceTasks = feedState.tasks.filter((task) => task.surface === feedSurface)

    return {
      header: isSurfaceAligned
        ? feedState.header
        : {
            ...feedState.header,
            ...fallbackHeader
          },
      tasks: surfaceTasks.length > 0 ? surfaceTasks : feedState.tasks.slice(0, 3),
      feed: feedState.feed,
      diagnosticsByTaskId: feedState.diagnosticsByTaskId
    }
  }, [activeFeatureTool, activeSurface, feedState])

  const isAgentCommandPending = runHarnessCommandMutation.isPending || startTaskMutation.isPending

  const workspaceActivityLabel = useMemo(() => {
    if (openProjectMutation.isPending) {
      return '正在切换项目'
    }

    if (createProjectMutation.isPending) {
      return '正在创建项目'
    }

    if (saveChapterMutation.isPending) {
      return '正在保存正文'
    }

    if (importAnalysisSampleMutation.isPending) {
      return '正在导入爆款样本'
    }

    if (importKnowledgeDocumentMutation.isPending) {
      return '正在导入知识资料'
    }

    if (applyProjectStrategyProposalMutation.isPending) {
      return '正在回写项目策略'
    }

    if (backgroundAutomationCount > 0) {
      return '后台正在同步设定与修订'
    }

    if (applyProposalMutation.isPending) {
      return '正在应用提议'
    }

    if (rejectProposalMutation.isPending) {
      return '正在拒绝提议'
    }

    if (commitCanonCardMutation.isPending) {
      return '正在写回设定'
    }

    if (updateRevisionIssueMutation.isPending) {
      return '正在更新修订队列'
    }

    if (undoRevisionRecordMutation.isPending) {
      return '正在撤销修订'
    }

    if (createExportPackageMutation.isPending) {
      return '正在生成导出包'
    }

    if (generateKnowledgeAnswerMutation.isPending) {
      return '正在生成知识问答'
    }

    if (startTaskMutation.isPending) {
      return '正在提交 AI Agent 任务'
    }

    if (runHarnessCommandMutation.isPending) {
      return '正在更新本地故事状态'
    }

    if (chapterQuery.isFetching && activeChapterId) {
      return '正在加载章节'
    }

    return '桌面工作台已就绪'
  }, [
    activeChapterId,
    applyProposalMutation.isPending,
    applyProjectStrategyProposalMutation.isPending,
    backgroundAutomationCount,
    chapterQuery.isFetching,
    commitCanonCardMutation.isPending,
    createProjectMutation.isPending,
    createExportPackageMutation.isPending,
    generateKnowledgeAnswerMutation.isPending,
    importAnalysisSampleMutation.isPending,
    importKnowledgeDocumentMutation.isPending,
    openProjectMutation.isPending,
    rejectProposalMutation.isPending,
    runHarnessCommandMutation.isPending,
    saveChapterMutation.isPending,
    startTaskMutation.isPending,
    undoRevisionRecordMutation.isPending,
    updateRevisionIssueMutation.isPending
  ])

  if (shellQuery.isError) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <img className="brand-mark brand-mark--loading" src={limeLogoUrl} alt="Lime Novel 标志" />
          <span className="eyebrow">{limeNovelBrand.name}</span>
          <h1>工作台启动失败</h1>
          <p className="loading-card__slogan">{limeNovelBrand.slogan}</p>
          <p>
            {shellQuery.error instanceof Error
              ? shellQuery.error.message
              : '当前工作区暂时没有完成装配，请重试一次。'}
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => void shellQuery.refetch()}>
              重新加载工作台
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (shellQuery.isLoading || !shellQuery.data) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <img className="brand-mark brand-mark--loading" src={limeLogoUrl} alt="Lime Novel 标志" />
          <span className="eyebrow">{limeNovelBrand.name}</span>
          <h1>正在整理小说工作台...</h1>
          <p className="loading-card__slogan">{limeNovelBrand.slogan}</p>
          <p>项目壳、代理侧栏和章节上下文正在接驳。</p>
        </div>
      </div>
    )
  }

  return (
    <NovelWorkbench
      shell={shellQuery.data}
      chapterDocument={chapterQuery.data}
      activeChapterId={activeChapterId}
      activeSurface={activeSurface}
      activeFeatureTool={activeFeatureTool}
      sidebarMode={sidebarMode}
      feedState={displayFeedState}
      activityLabel={workspaceActivityLabel}
      isCreatingProject={createProjectMutation.isPending}
      isOpeningProject={openProjectMutation.isPending}
      isImportingAnalysisSample={importAnalysisSampleMutation.isPending}
      isImportingKnowledgeDocument={importKnowledgeDocumentMutation.isPending}
      isApplyingAnalysisStrategy={applyProjectStrategyProposalMutation.isPending}
      isCreatingExportPackage={createExportPackageMutation.isPending}
      isGeneratingKnowledgeAnswer={generateKnowledgeAnswerMutation.isPending}
      isRunningHarnessCommand={isAgentCommandPending}
      agentSettingsState={agentSettingsQuery.data}
      agentSettingsError={agentSettingsQuery.error instanceof Error ? agentSettingsQuery.error.message : undefined}
      isAgentSettingsLoading={agentSettingsQuery.isLoading}
      isSavingAgentSettings={saveAgentSettingsMutation.isPending}
      agentSettingsTestResult={testAgentSettingsMutation.data}
      agentSettingsTestError={testAgentSettingsMutation.error instanceof Error ? testAgentSettingsMutation.error.message : undefined}
      isTestingAgentSettings={testAgentSettingsMutation.isPending}
      onSurfaceChange={(surface) => {
        const nextState = normalizeWorkspaceSurfaceState(surface)
        setActiveSurface(nextState.surface)
        setActiveFeatureTool(nextState.featureTool)
        setSidebarMode(resolveSidebarModeForSurface(nextState.surface))
        updateContextMutation.mutate({
          surface: nextState.surface,
          featureTool: nextState.featureTool,
          chapterId: activeChapterId ?? undefined
        })
      }}
      onFeatureToolChange={(featureTool) => {
        const nextState = buildFeatureToolSurfaceState(featureTool)
        setActiveSurface(nextState.surface)
        setActiveFeatureTool(nextState.featureTool)
        setSidebarMode(resolveSidebarModeForSurface('feature-center'))
        updateContextMutation.mutate({
          surface: nextState.surface,
          featureTool: nextState.featureTool,
          chapterId: activeChapterId ?? undefined
        })
      }}
      onOpenProject={() => {
        openProjectMutation.mutate()
      }}
      onCreateProject={(payload) => {
        createProjectMutation.mutate(payload)
      }}
      onSidebarModeChange={setSidebarMode}
      onSelectChapter={(chapterId) => {
        setActiveSurface('writing')
        setActiveFeatureTool(undefined)
        setSidebarMode('dialogue')
        setActiveChapterId(chapterId)
        updateContextMutation.mutate({
          surface: 'writing',
          chapterId
        })
      }}
      onInspectRevisionIssueChapter={(chapterId) => {
        setActiveSurface('revision')
        setActiveFeatureTool(undefined)
        setSidebarMode(resolveSidebarModeForSurface('revision'))
        setActiveChapterId(chapterId)
        updateContextMutation.mutate({
          surface: 'revision',
          chapterId
        })
      }}
      onStartTask={(intent, surface) => {
        if (!canSubmitLiveAgentTask()) {
          return
        }

        const requestedSurface = surface ?? activeSurface
        const requestedFeatureTool =
          requestedSurface === 'feature-center'
            ? activeFeatureTool
            : requestedSurface === 'analysis'
              ? 'analysis'
              : undefined
        const nextState = normalizeWorkspaceSurfaceState(requestedSurface, requestedFeatureTool)
        const runtimeSurface = resolveRuntimeSurface(nextState)

        if (nextState.surface !== activeSurface) {
          setActiveSurface(nextState.surface)
        }

        if (nextState.featureTool !== activeFeatureTool) {
          setActiveFeatureTool(nextState.featureTool)
        }

        setSidebarMode('dialogue')
        updateContextMutation.mutate({
          surface: nextState.surface,
          featureTool: nextState.featureTool,
          chapterId: activeChapterId ?? undefined
        })
        startTaskMutation.mutate({
          intent,
          surface: runtimeSurface,
          chapterId: activeChapterId ?? undefined,
          runtimeOptions: {
            metadata: {
              requiresLive: true,
              sourceCommand: 'agent.startTask'
            }
          }
        })
      }}
      onApplyProposal={(proposalId) => {
        applyProposalMutation.mutate(proposalId)
      }}
      onRejectProposal={(proposalId) => {
        rejectProposalMutation.mutate(proposalId)
      }}
      onSaveChapter={(chapterId, content) => {
        saveChapterMutation.mutate({ chapterId, content })
      }}
      onImportAnalysisSample={() => {
        importAnalysisSampleMutation.mutate()
      }}
      onApplyProjectStrategyProposal={(payload) => {
        applyProjectStrategyProposalMutation.mutate(payload)
      }}
      onCommitCanonCard={(cardId, visibility) => {
        commitCanonCardMutation.mutate({ cardId, visibility })
      }}
      onUpdateRevisionIssue={(issueId, status) => {
        updateRevisionIssueMutation.mutate({ issueId, status })
      }}
      onUndoRevisionRecord={(recordId) => {
        undoRevisionRecordMutation.mutate(recordId)
      }}
      onCreateExportPackage={(payload) => {
        createExportPackageMutation.mutate(payload)
      }}
      onCreateKnowledgeAnswer={(payload) => generateKnowledgeAnswerMutation.mutateAsync(payload)}
      onImportKnowledgeDocument={() => {
        importKnowledgeDocumentMutation.mutate()
      }}
      onSaveAgentSettings={(input) => {
        saveAgentSettingsMutation.mutate(input)
      }}
      onTestAgentSettings={(input) => {
        testAgentSettingsMutation.mutate(input)
      }}
      onRunHarnessCommand={(input) => {
        runWritingAgentCommand(input)
      }}
    />
  )
}
