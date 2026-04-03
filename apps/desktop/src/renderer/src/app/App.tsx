import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { GenerateKnowledgeAnswerInputDto, GenerateKnowledgeAnswerResultDto } from '@lime-novel/application'
import type { FeatureToolId, NovelSurfaceId } from '@lime-novel/domain-novel'
import { desktopApi } from '../lib/desktop-api'
import { agentFeedStore, useAgentFeedState } from '../lib/agent-feed-store'
import { queryClient } from '../lib/query-client'
import { NovelWorkbench } from '../features/workbench/NovelWorkbench'
import type { AgentSidebarMode } from '../features/agent-feed/AgentSidebar'
import limeLogoUrl from '../assets/logo-lime.png'
import { limeNovelBrand } from './branding'

const surfaceHeaderFallback = {
  home: {
    currentAgent: '项目总控代理',
    activeSubAgent: '章节代理',
    memorySources: ['项目摘要', '第 12 章', '人物画像', '最近任务'],
    riskLevel: 'medium' as const
  },
  writing: {
    currentAgent: '章节代理',
    activeSubAgent: '设定扫描子代理',
    memorySources: ['本章目标', '当前场景', '人物画像', '最近提议'],
    riskLevel: 'medium' as const
  },
  knowledge: {
    currentAgent: '知识代理',
    activeSubAgent: '知识编译子代理',
    memorySources: ['raw 素材', 'compiled 知识页', 'canon 设定', 'outputs 结果'],
    riskLevel: 'medium' as const
  },
  'feature-center': {
    currentAgent: '功能中心',
    memorySources: ['插件能力', '样本导入', '项目回写', '最近功能'],
    riskLevel: 'low' as const
  },
  analysis: {
    currentAgent: '拆书代理',
    activeSubAgent: '样本建模子代理',
    memorySources: ['样本文本', '题材词', '结构信号', '项目 premise'],
    riskLevel: 'medium' as const
  },
  canon: {
    currentAgent: '设定代理',
    activeSubAgent: '事实抽取子代理',
    memorySources: ['候选卡', '证据片段', '章节引用', '时间线'],
    riskLevel: 'medium' as const
  },
  revision: {
    currentAgent: '修订代理',
    activeSubAgent: '连续性检查子代理',
    memorySources: ['问题队列', '相邻章节', '证据片段', '修订记录'],
    riskLevel: 'high' as const
  },
  publish: {
    currentAgent: '发布代理',
    activeSubAgent: '导出预检子代理',
    memorySources: ['导出预设', '版本快照', '平台提示', '元数据'],
    riskLevel: 'medium' as const
  }
}

const resolveSidebarModeForSurface = (surface: NovelSurfaceId): AgentSidebarMode =>
  surface === 'writing' ? 'dialogue' : 'suggestions'

const resolveWorkspaceSurfaceState = (
  surface: NovelSurfaceId,
  featureTool?: FeatureToolId
): { surface: NovelSurfaceId; featureTool?: FeatureToolId } => {
  if (surface === 'analysis') {
    return {
      surface: 'feature-center',
      featureTool: 'analysis'
    }
  }

  return {
    surface,
    featureTool: surface === 'feature-center' ? featureTool : undefined
  }
}

const resolveRuntimeSurface = (surface: NovelSurfaceId, featureTool?: FeatureToolId): NovelSurfaceId => {
  if (surface !== 'feature-center') {
    return surface
  }

  return featureTool === 'analysis' ? 'analysis' : 'home'
}

export const App = () => {
  const [activeSurface, setActiveSurface] = useState<NovelSurfaceId>('home')
  const [activeFeatureTool, setActiveFeatureTool] = useState<FeatureToolId | undefined>()
  const [sidebarMode, setSidebarMode] = useState<AgentSidebarMode>('suggestions')
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [backgroundAutomationCount, setBackgroundAutomationCount] = useState(0)
  const lastHydratedWorkspaceKeyRef = useRef<string | null>(null)
  const autoMaintenanceKeysRef = useRef(new Set<string>())
  const feedState = useAgentFeedState()

  const shellQuery = useQuery({
    queryKey: ['workspace-shell'],
    queryFn: () => desktopApi.workspace.loadShell()
  })

  const activeWorkspacePath = shellQuery.data?.workspacePath ?? ''

  const triggerPostSaveAutomation = (chapterId: string) => {
    if (!activeWorkspacePath) {
      return
    }

    const automationKey = `${activeWorkspacePath}::${chapterId}`

    if (autoMaintenanceKeysRef.current.has(automationKey)) {
      return
    }

    autoMaintenanceKeysRef.current.add(automationKey)
    setBackgroundAutomationCount((count) => count + 1)
    agentFeedStore.addLocalStatus(
      '后台整理已启动',
      '设定代理与修订代理正在同步候选卡和问题队列。',
      `章节 ${chapterId}`
    )

    void (async () => {
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
          await desktopApi.agent.startTask({
            surface: task.surface,
            intent: task.intent,
            chapterId
          })
        } catch (error) {
          agentFeedStore.addLocalStatus(
            `${task.surface === 'canon' ? '设定' : '修订'}后台更新失败`,
            error instanceof Error ? error.message : '后台自动更新没有执行成功。',
            chapterId
          )
        }
      }

      autoMaintenanceKeysRef.current.delete(automationKey)
      setBackgroundAutomationCount((count) => Math.max(0, count - 1))
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
    })()
  }

  const chapterQuery = useQuery({
    queryKey: ['chapter-document', activeWorkspacePath, activeChapterId],
    enabled: Boolean(activeChapterId),
    queryFn: () => desktopApi.chapter.loadDocument(activeChapterId as string)
  })

  const startTaskMutation = useMutation({
    mutationFn: (payload: { intent: string; surface: NovelSurfaceId; chapterId?: string }) =>
      desktopApi.agent.startTask({
        surface: payload.surface,
        intent: payload.intent,
        chapterId: payload.chapterId
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('代理任务已启动', result.task.title, result.task.summary)
    },
    onError: (error) => {
      agentFeedStore.addLocalStatus(
        '代理任务启动失败',
        error instanceof Error ? error.message : '当前任务暂时无法启动。',
        '请稍后重试'
      )
    }
  })

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

      try {
        await desktopApi.agent.startTask({
          surface: 'publish',
          intent: '请复核这次导出结果并同步平台反馈与最终确认建议。'
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
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
    })

    return () => {
      unsubscribe()
    }
  }, [])

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
    const nextState = resolveWorkspaceSurfaceState(shell.project.currentSurface, shell.project.currentFeatureTool)
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
    const feedSurface =
      activeSurface === 'feature-center' && activeFeatureTool === 'analysis' ? 'analysis' : activeSurface
    const isSurfaceAligned = feedState.header.surface === feedSurface
    const fallbackHeader = surfaceHeaderFallback[feedSurface]
    const surfaceTasks = feedState.tasks.filter((task) => task.surface === feedSurface)

    return {
      header: isSurfaceAligned
        ? feedState.header
        : {
            ...feedState.header,
            ...fallbackHeader,
            surface: feedSurface
          },
      tasks: surfaceTasks.length > 0 ? surfaceTasks : feedState.tasks.slice(0, 3),
      feed: feedState.feed,
      diagnosticsByTaskId: feedState.diagnosticsByTaskId
    }
  }, [activeFeatureTool, activeSurface, feedState])

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
    openProjectMutation.isPending,
    rejectProposalMutation.isPending,
    saveChapterMutation.isPending,
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
      isApplyingAnalysisStrategy={applyProjectStrategyProposalMutation.isPending}
      isCreatingExportPackage={createExportPackageMutation.isPending}
      isGeneratingKnowledgeAnswer={generateKnowledgeAnswerMutation.isPending}
      onSurfaceChange={(surface) => {
        const nextState = resolveWorkspaceSurfaceState(surface)
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
        setActiveSurface('feature-center')
        setActiveFeatureTool(featureTool)
        setSidebarMode(resolveSidebarModeForSurface('feature-center'))
        updateContextMutation.mutate({
          surface: 'feature-center',
          featureTool,
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
        const requestedSurface = surface ?? activeSurface
        const requestedFeatureTool =
          requestedSurface === 'feature-center'
            ? activeFeatureTool
            : requestedSurface === 'analysis'
              ? 'analysis'
              : undefined
        const nextState = resolveWorkspaceSurfaceState(requestedSurface, requestedFeatureTool)
        const runtimeSurface = resolveRuntimeSurface(nextState.surface, nextState.featureTool)

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
          chapterId: activeChapterId ?? undefined
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
    />
  )
}
