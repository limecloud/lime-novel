import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'
import { desktopApi } from '../lib/desktop-api'
import { agentFeedStore, useAgentFeedState } from '../lib/agent-feed-store'
import { queryClient } from '../lib/query-client'
import { NovelWorkbench } from '../features/workbench/NovelWorkbench'

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

export const App = () => {
  const [activeSurface, setActiveSurface] = useState<NovelSurfaceId>('home')
  const [sidebarMode, setSidebarMode] = useState<'suggestions' | 'dialogue'>('suggestions')
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const lastHydratedWorkspaceKeyRef = useRef<string | null>(null)
  const feedState = useAgentFeedState()

  const shellQuery = useQuery({
    queryKey: ['workspace-shell'],
    queryFn: () => desktopApi.workspace.loadShell()
  })

  const activeWorkspacePath = shellQuery.data?.workspacePath ?? 'fallback-workspace'

  const chapterQuery = useQuery({
    queryKey: ['chapter-document', activeWorkspacePath, activeChapterId],
    enabled: Boolean(activeChapterId),
    queryFn: () => desktopApi.chapter.loadDocument(activeChapterId as string)
  })

  const startTaskMutation = useMutation({
    mutationFn: (intent: string) =>
      desktopApi.agent.startTask({
        surface: activeSurface,
        intent,
        chapterId: activeChapterId ?? undefined
      })
  })

  const updateContextMutation = useMutation({
    mutationFn: (payload: { surface: NovelSurfaceId; chapterId?: string }) =>
      desktopApi.workspace.updateContext(payload)
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
      setActiveChapterId(null)
      setSidebarMode('suggestions')
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
      setActiveChapterId(null)
      setSidebarMode('suggestions')
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

  const createExportPackageMutation = useMutation({
    mutationFn: (payload: { presetId: string; synopsis: string; splitChapters: number }) =>
      desktopApi.publish.createExportPackage(payload),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-shell'] })
      agentFeedStore.addLocalStatus('导出包已生成', result.summary, result.outputDir)
    }
  })

  useEffect(() => {
    const unsubscribe = desktopApi.agent.subscribeTaskEvents((event) => {
      agentFeedStore.applyEvent(event)
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
      return
    }

    lastHydratedWorkspaceKeyRef.current = workspaceKey
    setActiveSurface(shell.project.currentSurface)
    setActiveChapterId(shell.project.currentChapterId)
    setSidebarMode(shell.project.currentSurface === 'writing' ? 'dialogue' : 'suggestions')
    agentFeedStore.hydrate({
      header: shell.agentHeader,
      tasks: shell.agentTasks,
      feed: shell.agentFeed
    })
  }, [shellQuery.data])

  const displayFeedState = useMemo(() => {
    const isSurfaceAligned = feedState.header.surface === activeSurface
    const fallbackHeader = surfaceHeaderFallback[activeSurface]
    const surfaceTasks = feedState.tasks.filter((task) => task.surface === activeSurface)

    return {
      header: isSurfaceAligned
        ? feedState.header
        : {
            ...feedState.header,
            ...fallbackHeader,
            surface: activeSurface
          },
      tasks: surfaceTasks.length > 0 ? surfaceTasks : feedState.tasks.slice(0, 3),
      feed: feedState.feed
    }
  }, [activeSurface, feedState])

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

    if (applyProposalMutation.isPending) {
      return '正在应用提议'
    }

    if (commitCanonCardMutation.isPending) {
      return '正在写回设定'
    }

    if (updateRevisionIssueMutation.isPending) {
      return '正在更新修订队列'
    }

    if (createExportPackageMutation.isPending) {
      return '正在生成导出包'
    }

    if (chapterQuery.isFetching && activeChapterId) {
      return '正在加载章节'
    }

    return '桌面工作台已就绪'
  }, [
    activeChapterId,
    applyProposalMutation.isPending,
    chapterQuery.isFetching,
    commitCanonCardMutation.isPending,
    createProjectMutation.isPending,
    createExportPackageMutation.isPending,
    openProjectMutation.isPending,
    saveChapterMutation.isPending,
    updateRevisionIssueMutation.isPending
  ])

  if (shellQuery.isLoading || !shellQuery.data) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <img className="brand-mark brand-mark--loading" src="/logo-lime-192.png" alt="Lime Novel 标志" />
          <span className="eyebrow">Lime Novel</span>
          <h1>正在整理小说工作台...</h1>
          <p className="loading-card__slogan">青柠一下，灵感即来</p>
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
      sidebarMode={sidebarMode}
      feedState={displayFeedState}
      activityLabel={workspaceActivityLabel}
      isCreatingProject={createProjectMutation.isPending}
      isOpeningProject={openProjectMutation.isPending}
      onSurfaceChange={(surface) => {
        setActiveSurface(surface)
        updateContextMutation.mutate({
          surface,
          chapterId: activeChapterId ?? undefined
        })
        if (surface === 'writing') {
          setSidebarMode('dialogue')
        } else {
          setSidebarMode('suggestions')
        }
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
        setSidebarMode('dialogue')
        setActiveChapterId(chapterId)
        updateContextMutation.mutate({
          surface: 'writing',
          chapterId
        })
      }}
      onInspectRevisionIssueChapter={(chapterId) => {
        setActiveChapterId(chapterId)
        updateContextMutation.mutate({
          surface: 'revision',
          chapterId
        })
      }}
      onStartTask={(intent) => {
        setSidebarMode('dialogue')
        startTaskMutation.mutate(intent)
      }}
      onApplyProposal={(proposalId) => {
        applyProposalMutation.mutate(proposalId)
      }}
      onSaveChapter={(chapterId, content) => {
        saveChapterMutation.mutate({ chapterId, content })
      }}
      onCommitCanonCard={(cardId, visibility) => {
        commitCanonCardMutation.mutate({ cardId, visibility })
      }}
      onUpdateRevisionIssue={(issueId, status) => {
        updateRevisionIssueMutation.mutate({ issueId, status })
      }}
      onCreateExportPackage={(presetId, synopsis, splitChapters) => {
        createExportPackageMutation.mutate({ presetId, synopsis, splitChapters })
      }}
    />
  )
}
