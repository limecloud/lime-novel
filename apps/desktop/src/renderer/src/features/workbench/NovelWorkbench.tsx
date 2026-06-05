import { useEffect, useState } from 'react'
import type {
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentRuntimeConnectionTestResultDto,
  AgentRuntimeSettingsDto,
  AgentRuntimeSettingsStateDto,
  AgentTaskDiagnosticsDto,
  AgentTaskDto,
  ApplyProjectStrategyProposalInputDto,
  ChapterDocumentDto,
  ChapterListItemDto,
  CreateExportPackageInputDto,
  CreateProjectInputDto,
  GenerateKnowledgeAnswerInputDto,
  GenerateKnowledgeAnswerResultDto,
  QuickActionDto,
  WorkspaceSearchItemDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { FeatureToolId, NovelSurfaceId } from '@lime-novel/domain-novel'
import { ChapterEditor } from '../editor/ChapterEditor'
import { AgentSidebar } from '../agent-feed/AgentSidebar'
import type { AgentSidebarMode } from '../agent-feed/AgentSidebar'
import { AnalysisStructurePanel } from '../analysis/AnalysisStructurePanel'
import { AnalysisSurface } from '../analysis/AnalysisSurface'
import { useAnalysisWorkbenchState } from '../analysis/useAnalysisWorkbenchState'
import limeLogoUrl from '../../assets/logo-lime.png'
import { limeNovelBrand } from '../../app/branding'
import { CanonStructurePanel } from '../canon/CanonStructurePanel'
import { CanonSurface } from '../canon/CanonSurface'
import { useCanonWorkbenchState } from '../canon/useCanonWorkbenchState'
import { FeatureCenterHomeSurface } from '../feature-center/FeatureCenterHomeSurface'
import { FeatureCenterStructurePanel } from '../feature-center/FeatureCenterStructurePanel'
import {
  featureCenterEntry,
  resolveFeatureToolLabel,
  resolveWorkspaceSearchSurfaceLabel
} from '../feature-center/feature-center-model'
import { KnowledgeStructurePanel } from '../knowledge/KnowledgeStructurePanel'
import { KnowledgeSurface } from '../knowledge/KnowledgeSurface'
import { knowledgeBucketLabel } from '../knowledge/knowledge-model'
import { useKnowledgeWorkbenchState } from '../knowledge/useKnowledgeWorkbenchState'
import { PublishStructurePanel } from '../publish/PublishStructurePanel'
import { PublishSurface } from '../publish/PublishSurface'
import { usePublishWorkbenchState } from '../publish/usePublishWorkbenchState'
import { RevisionStructurePanel } from '../revision/RevisionStructurePanel'
import { RevisionSurface } from '../revision/RevisionSurface'
import { useRevisionWorkbenchState } from '../revision/useRevisionWorkbenchState'
import { WorkspaceSearchModal } from '../workspace-search/WorkspaceSearchModal'
import { useWorkspaceSearch } from '../workspace-search/useWorkspaceSearch'
import { excerptParagraphs, formatCount, formatDateTime } from './workbench-format'

type AgentFeedSnapshot = {
  header: AgentHeaderDto
  tasks: AgentTaskDto[]
  feed: AgentFeedItemDto[]
  diagnosticsByTaskId: Record<string, AgentTaskDiagnosticsDto>
}

type NovelWorkbenchProps = {
  shell: WorkspaceShellDto
  chapterDocument?: ChapterDocumentDto
  activeChapterId?: string | null
  activeSurface: NovelSurfaceId
  activeFeatureTool?: FeatureToolId
  sidebarMode: AgentSidebarMode
  feedState: AgentFeedSnapshot
  activityLabel: string
  isCreatingProject: boolean
  isOpeningProject: boolean
  isImportingAnalysisSample: boolean
  isImportingKnowledgeDocument: boolean
  isApplyingAnalysisStrategy: boolean
  isCreatingExportPackage: boolean
  isGeneratingKnowledgeAnswer: boolean
  agentSettingsState?: AgentRuntimeSettingsStateDto
  agentSettingsError?: string
  isAgentSettingsLoading: boolean
  isSavingAgentSettings: boolean
  agentSettingsTestResult?: AgentRuntimeConnectionTestResultDto
  agentSettingsTestError?: string
  isTestingAgentSettings: boolean
  onSurfaceChange: (surface: NovelSurfaceId) => void
  onFeatureToolChange: (tool?: FeatureToolId) => void
  onCreateProject: (input: CreateProjectInputDto) => void
  onOpenProject: () => void
  onSidebarModeChange: (mode: AgentSidebarMode) => void
  onSelectChapter: (chapterId: string) => void
  onInspectRevisionIssueChapter: (chapterId: string) => void
  onStartTask: (intent: string, surface?: NovelSurfaceId) => void
  onApplyProposal: (proposalId: string) => void
  onRejectProposal: (proposalId: string) => void
  onSaveChapter: (chapterId: string, content: string) => void
  onImportAnalysisSample: () => void
  onApplyProjectStrategyProposal: (input: ApplyProjectStrategyProposalInputDto) => void
  onCommitCanonCard: (cardId: string, visibility: 'candidate' | 'confirmed' | 'archived') => void
  onUpdateRevisionIssue: (issueId: string, status: 'open' | 'deferred' | 'resolved') => void
  onUndoRevisionRecord: (recordId: string) => void
  onCreateExportPackage: (input: CreateExportPackageInputDto) => void
  onCreateKnowledgeAnswer: (input: GenerateKnowledgeAnswerInputDto) => Promise<GenerateKnowledgeAnswerResultDto>
  onImportKnowledgeDocument: () => void
  onSaveAgentSettings: (input: AgentRuntimeSettingsDto) => void
  onTestAgentSettings: (input: AgentRuntimeSettingsDto) => void
}

type CreateProjectTemplateId = CreateProjectInputDto['template']

type CreateProjectFormState = {
  title: string
  genre: string
  premise: string
  template: CreateProjectTemplateId
}

const projectStatusLabel: Record<string, string> = {
  planning: '规划中',
  drafting: '写作中',
  revising: '修订中',
  publishing: '发布准备'
}

const projectTemplateDefinitions: Array<{
  id: CreateProjectTemplateId
  label: string
  description: string
}> = [
  {
    id: 'blank',
    label: '空白项目',
    description: '创建一套干净的卷册、章节和基础动作，适合从零开始搭世界与人物。'
  },
  {
    id: 'mystery',
    label: '悬疑样板',
    description: '预装更偏悬念推进的第一章目标、开场提示和诊断动作。'
  }
]

const chapterStatusLabel: Record<string, string> = {
  idea: '提纲已建',
  draft: '当前编辑中',
  reviewing: '等待修订',
  revised: '已完成',
  published: '已发布'
}

const sceneStatusLabel: Record<string, string> = {
  planned: '计划中',
  drafting: '进行中',
  completed: '已完成',
  revised: '已修订'
}

const buildDefaultCreateProjectForm = (): CreateProjectFormState => ({
  title: '',
  genre: '悬疑 / 都市奇幻',
  premise: '',
  template: 'blank'
})

const defaultAgentRuntimeSettings: AgentRuntimeSettingsDto = {
  provider: 'legacy',
  baseUrl: '',
  apiKey: '',
  model: ''
}

const runtimeProviderDefinitions: Array<{
  id: AgentRuntimeSettingsDto['provider']
  label: string
  description: string
}> = [
  {
    id: 'legacy',
    label: '本地规则模式',
    description: '不调用外部模型，继续使用当前仓库里的规则型收口与工作台回写。'
  },
  {
    id: 'anthropic',
    label: 'Claude / Anthropic',
    description: '对齐 CC 的主链消息格式，适合把小说任务接到真实 Claude 模型。'
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI Compatible',
    description: '兼容 OpenAI 接口风格，也可接入 OneAPI、网关或兼容代理。'
  }
]

const runtimeProviderLabel: Record<AgentRuntimeSettingsStateDto['resolvedProvider'], string> = {
  legacy: '本地规则模式',
  anthropic: 'Claude / Anthropic',
  'openai-compatible': 'OpenAI Compatible'
}

const runtimeTestProviderLabel: Record<AgentRuntimeConnectionTestResultDto['provider'], string> = {
  legacy: '本地规则模式',
  anthropic: 'Claude / Anthropic',
  'openai-compatible': 'OpenAI Compatible'
}

const activeTaskStatuses = new Set<AgentTaskDto['status']>(['queued', 'running', 'waiting_approval'])

const resolveActiveWritingTask = (tasks: AgentTaskDto[]): AgentTaskDto | undefined => {
  const writingTasks = tasks.filter((task) => task.surface === 'writing')

  return writingTasks.find((task) => activeTaskStatuses.has(task.status)) ?? writingTasks[0]
}

const resolveTaskFeed = (feed: AgentFeedItemDto[], task?: AgentTaskDto): AgentFeedItemDto[] =>
  task ? feed.filter((item) => item.taskId === task.taskId) : []

const isPendingProposalItem = (item: AgentFeedItemDto): boolean =>
  Boolean(item.proposalId) && item.approvalStatus !== 'accepted' && item.approvalStatus !== 'rejected'

const isReviewFeedItem = (item: AgentFeedItemDto): boolean =>
  isPendingProposalItem(item) || item.kind === 'issue' || item.kind === 'approval'

const taskStatusLabel: Record<AgentTaskDto['status'], string> = {
  queued: '排队中',
  running: '运行中',
  waiting_approval: '待确认',
  completed: '完成',
  failed: '失败'
}

type AgentRunStepState = 'waiting' | 'running' | 'done' | 'approval' | 'failed'

const buildRunStepClassName = (state: AgentRunStepState): string => {
  const baseClass = 'agent-writing-run-step'

  if (state === 'waiting') {
    return baseClass
  }

  return `${baseClass} ${baseClass}--${state}`
}

const buildWritingRunSteps = (
  task: AgentTaskDto | undefined,
  pendingProposalCount: number
): Array<{
  title: string
  body: string
  marker: string
  label: string
  state: AgentRunStepState
}> => {
  if (!task) {
    return [
      {
        title: '等待作者意图',
        body: '在下方输入框告诉 Agent 你想检查、改写或避雷的目标。',
        marker: '1',
        label: '未开始',
        state: 'waiting'
      },
      {
        title: '读取上下文资产',
        body: '启动后会读取当前章、故事资产、人物线、伏笔线和平台规则。',
        marker: '2',
        label: '等待',
        state: 'waiting'
      },
      {
        title: '调用能力包',
        body: '按任务需要调用人物线同步、伏笔线检查、发布避雷或修订检查。',
        marker: '3',
        label: '等待',
        state: 'waiting'
      },
      {
        title: '确认变更包',
        body: '有改动时先生成待确认建议，再由你决定采纳或丢弃。',
        marker: '4',
        label: '等待',
        state: 'waiting'
      }
    ]
  }

  const isQueued = task.status === 'queued'
  const isRunning = task.status === 'running'
  const isApproval = task.status === 'waiting_approval' || pendingProposalCount > 0
  const isCompleted = task.status === 'completed'
  const isFailed = task.status === 'failed'

  return [
    {
      title: '接收作者意图',
      body: task.summary,
      marker: '✓',
      label: '完成',
      state: 'done'
    },
    {
      title: '读取上下文资产',
      body: '当前章、章节材料、故事资产、人物线、伏笔线和平台规则进入同一轮任务。',
      marker: isQueued ? '…' : '✓',
      label: isQueued ? '排队中' : '完成',
      state: isQueued ? 'running' : 'done'
    },
    {
      title: '调用能力包',
      body: '按意图调用人物线同步、伏笔线检查、发布避雷或修订检查。',
      marker: isFailed ? '!' : isCompleted || isApproval ? '✓' : '…',
      label: isFailed ? '失败' : isCompleted || isApproval ? '完成' : '运行中',
      state: isFailed ? 'failed' : isCompleted || isApproval ? 'done' : isRunning || isQueued ? 'running' : 'waiting'
    },
    {
      title: '需要你确认',
      body: '变更包确认后才会写回正文或故事资产。',
      marker: isApproval ? '!' : isCompleted ? '✓' : '4',
      label: isApproval ? `${Math.max(pendingProposalCount, 1)} 项` : isCompleted ? '完成' : taskStatusLabel[task.status],
      state: isApproval ? 'approval' : isCompleted ? 'done' : isFailed ? 'failed' : 'waiting'
    }
  ]
}

const agentSidebarModeDefinitions: Array<{
  id: AgentSidebarMode
  label: string
  description: string
}> = [
  {
    id: 'agent',
    label: '代理',
    description: '查看当前主代理、后台任务和运行轨迹。'
  },
  {
    id: 'suggestions',
    label: '建议',
    description: '查看提议、证据和审批结果。'
  },
  {
    id: 'dialogue',
    label: '对话',
    description: '查看实时 trace，并继续发起对话。'
  }
]

type WritingInspectorPane = 'state' | 'changes' | 'risk' | 'clock'

const writingInspectorPaneDefinitions: Array<{
  id: WritingInspectorPane
  label: string
  description: string
}> = [
  {
    id: 'state',
    label: '环境',
    description: '查看当前章、运行模式和故事资产状态。'
  },
  {
    id: 'changes',
    label: '变更',
    description: '查看待确认的正文或故事资产变更。'
  },
  {
    id: 'risk',
    label: '避雷',
    description: '查看发布风险和平台规则建议。'
  },
  {
    id: 'clock',
    label: '时光机',
    description: '查看最近保护点和可撤回范围。'
  }
]

const trimAgentRuntimeSettings = (settings: AgentRuntimeSettingsDto): AgentRuntimeSettingsDto => ({
  provider: settings.provider,
  baseUrl: settings.baseUrl.trim(),
  apiKey: settings.apiKey.trim(),
  model: settings.model.trim()
})

const isSameAgentRuntimeSettings = (
  left: AgentRuntimeSettingsDto,
  right: AgentRuntimeSettingsDto
): boolean => {
  const normalizedLeft = trimAgentRuntimeSettings(left)
  const normalizedRight = trimAgentRuntimeSettings(right)

  return (
    normalizedLeft.provider === normalizedRight.provider &&
    normalizedLeft.baseUrl === normalizedRight.baseUrl &&
    normalizedLeft.apiKey === normalizedRight.apiKey &&
    normalizedLeft.model === normalizedRight.model
  )
}

const resolveRuntimeModelPlaceholder = (provider: AgentRuntimeSettingsDto['provider']): string =>
  provider === 'anthropic' ? '留空则默认 claude-sonnet-4-6' : provider === 'openai-compatible' ? '留空则默认 gpt-4.1-mini' : '本地规则模式不需要模型'

const resolveRuntimeBaseUrlPlaceholder = (provider: AgentRuntimeSettingsDto['provider']): string =>
  provider === 'anthropic'
    ? '留空则默认 https://api.anthropic.com/v1/messages'
    : provider === 'openai-compatible'
      ? '留空则默认 https://api.openai.com/v1'
      : '本地规则模式不需要网关地址'

const AgentSidebarRailIcon = ({
  mode
}: {
  mode: AgentSidebarMode
}) => {
  if (mode === 'agent') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4.75" y="5.25" width="14.5" height="13.5" rx="4" {...iconStrokeProps} />
        <circle cx="9" cy="10.25" r="1" {...iconStrokeProps} />
        <circle cx="15" cy="10.25" r="1" {...iconStrokeProps} />
        <path d="M8.25 15c1 .85 2.28 1.25 3.75 1.25S14.75 15.85 15.75 15" {...iconStrokeProps} />
      </svg>
    )
  }

  if (mode === 'suggestions') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 10.25a4 4 0 1 1 8 0c0 1.55-.68 2.35-1.55 3.25-.72.74-1.2 1.45-1.2 2.25h-2.5c0-.8-.47-1.5-1.2-2.25-.87-.9-1.55-1.7-1.55-3.25Z" {...iconStrokeProps} />
        <path d="M10 18.25h4" {...iconStrokeProps} />
        <path d="M10.5 20.25h3" {...iconStrokeProps} />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 8.25h10" {...iconStrokeProps} />
      <path d="M7 12h6.5" {...iconStrokeProps} />
      <path d="M7 15.75h8.5" {...iconStrokeProps} />
      <path d="M17.25 7.5 20 10.25l-2.75 2.75" {...iconStrokeProps} />
    </svg>
  )
}

const ExpandSidebarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7.25 5.5v13" {...iconStrokeProps} />
    <path d="M16.5 7.25 11.75 12l4.75 4.75" {...iconStrokeProps} />
  </svg>
)

const CollapseSidebarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M16.75 5.5v13" {...iconStrokeProps} />
    <path d="M7.5 7.25 12.25 12 7.5 16.75" {...iconStrokeProps} />
  </svg>
)

const CollapseStructureIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M16.75 5.5v13" {...iconStrokeProps} />
    <path d="M7.5 7.25 12.25 12 7.5 16.75" {...iconStrokeProps} />
  </svg>
)

const ExpandStructureIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7.25 5.5v13" {...iconStrokeProps} />
    <path d="M16.5 7.25 11.75 12l4.75 4.75" {...iconStrokeProps} />
  </svg>
)

const StructurePanelRail = ({
  className,
  surface,
  onExpand
}: {
  className?: string
  surface: NovelSurfaceId
  onExpand: () => void
}) => (
  <aside className={className ? `structure-panel-rail ${className}` : 'structure-panel-rail'} aria-label="左侧结构面板折叠导航">
    <button
      type="button"
      className="structure-panel-rail__button"
      onClick={onExpand}
      aria-label="展开左侧导航"
      title="展开左侧导航"
    >
      <span className="structure-panel-rail__icon">
        <ExpandStructureIcon />
      </span>
    </button>
    <button
      type="button"
      className="structure-panel-rail__button structure-panel-rail__button--active"
      onClick={onExpand}
      aria-label="展开当前结构导航"
      title="展开当前结构导航"
    >
      <span className="structure-panel-rail__icon">
        <SurfaceIcon surface={surface} />
      </span>
    </button>
  </aside>
)

const AgentSidebarRail = ({
  className,
  mode,
  onModeChange,
  onExpand
}: {
  className?: string
  mode: AgentSidebarMode
  onModeChange: (mode: AgentSidebarMode) => void
  onExpand: () => void
}) => (
  <aside className={className ? `agent-sidebar-rail ${className}` : 'agent-sidebar-rail'} aria-label="AI Agent 侧栏折叠导航">
    <button
      type="button"
      className="agent-sidebar-rail__button agent-sidebar-rail__button--icon"
      onClick={onExpand}
      aria-label="展开右侧栏"
      title="展开右侧栏"
    >
      <span className="agent-sidebar-rail__icon">
        <ExpandSidebarIcon />
      </span>
    </button>

    <div className="agent-sidebar-rail__modes">
      {agentSidebarModeDefinitions.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            item.id === mode
              ? 'agent-sidebar-rail__button agent-sidebar-rail__button--active'
              : 'agent-sidebar-rail__button'
          }
          aria-label={`${item.label}，${item.description}`}
          title={`${item.label} · ${item.description}`}
          aria-pressed={item.id === mode}
          onClick={() => {
            onModeChange(item.id)
            onExpand()
          }}
        >
          <span className="agent-sidebar-rail__icon">
            <AgentSidebarRailIcon mode={item.id} />
          </span>
        </button>
      ))}
    </div>
  </aside>
)

const WritingInspectorPaneIcon = ({ pane }: { pane: WritingInspectorPane }) => {
  if (pane === 'state') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="5.5" {...iconStrokeProps} />
        <path d="M12 6.5v2.25" {...iconStrokeProps} />
        <path d="M12 15.25v2.25" {...iconStrokeProps} />
        <path d="M6.5 12h2.25" {...iconStrokeProps} />
        <path d="M15.25 12h2.25" {...iconStrokeProps} />
      </svg>
    )
  }

  if (pane === 'changes') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 7.5h10" {...iconStrokeProps} />
        <path d="M7 12h6.25" {...iconStrokeProps} />
        <path d="M7 16.5h8.25" {...iconStrokeProps} />
        <path d="M16.75 12 19 14.25l-2.25 2.25" {...iconStrokeProps} />
      </svg>
    )
  }

  if (pane === 'risk') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5.75 18.75 18H5.25L12 5.75Z" {...iconStrokeProps} />
        <path d="M12 10.25v3.25" {...iconStrokeProps} />
        <path d="M12 16.25h.01" {...iconStrokeProps} />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" {...iconStrokeProps} />
      <path d="M12 8.25V12l2.75 2" {...iconStrokeProps} />
    </svg>
  )
}

const WritingInspectorRail = ({
  activePane,
  onPaneChange,
  onExpand
}: {
  activePane: WritingInspectorPane
  onPaneChange: (pane: WritingInspectorPane) => void
  onExpand: () => void
}) => (
  <aside className="writing-inspector-rail" aria-label="写作检查栏折叠导航">
    <button
      type="button"
      className="writing-inspector-rail__button writing-inspector-rail__button--icon"
      onClick={onExpand}
      aria-label="展开写作检查栏"
      title="展开写作检查栏"
    >
      <span className="writing-inspector-rail__icon">
        <ExpandSidebarIcon />
      </span>
    </button>

    <div className="writing-inspector-rail__modes">
      {writingInspectorPaneDefinitions.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            item.id === activePane
              ? 'writing-inspector-rail__button writing-inspector-rail__button--active'
              : 'writing-inspector-rail__button'
          }
          aria-label={`${item.label}，${item.description}`}
          title={`${item.label} · ${item.description}`}
          aria-pressed={item.id === activePane}
          onClick={() => {
            onPaneChange(item.id)
            onExpand()
          }}
        >
          <span className="writing-inspector-rail__icon">
            <WritingInspectorPaneIcon pane={item.id} />
          </span>
        </button>
      ))}
    </div>
  </aside>
)

const iconStrokeProps = {
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

const SurfaceIcon = ({ surface }: { surface: NovelSurfaceId }) => {
  if (surface === 'home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4.75" y="5.75" width="14.5" height="12.5" rx="3" {...iconStrokeProps} />
        <path d="M9.25 5.75v12.5" {...iconStrokeProps} />
        <path d="M12.75 10.25h3.75" {...iconStrokeProps} />
        <path d="M12.75 14h2.75" {...iconStrokeProps} />
      </svg>
    )
  }

  if (surface === 'writing') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 6.5h11" {...iconStrokeProps} />
        <path d="M12 6.5v11" {...iconStrokeProps} />
        <path d="M8.75 17.5h6.5" {...iconStrokeProps} />
      </svg>
    )
  }

  if (surface === 'knowledge') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 6.5h8.75" {...iconStrokeProps} />
        <path d="M7 10h10" {...iconStrokeProps} />
        <path d="M7 13.5h7.25" {...iconStrokeProps} />
        <path d="M6.75 18.25h10.5" {...iconStrokeProps} />
      </svg>
    )
  }

  if (surface === 'feature-center') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="5" width="5.5" height="5.5" rx="1.5" {...iconStrokeProps} />
        <rect x="13.5" y="5" width="5.5" height="5.5" rx="1.5" {...iconStrokeProps} />
        <rect x="5" y="13.5" width="5.5" height="5.5" rx="1.5" {...iconStrokeProps} />
        <path d="M14.25 16.25h4.5" {...iconStrokeProps} />
        <path d="M16.5 14v4.5" {...iconStrokeProps} />
      </svg>
    )
  }

  if (surface === 'analysis') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.75 16.5 10.2 12l2.55 2.55 4.5-6.05" {...iconStrokeProps} />
        <path d="M6.5 18.25h11" {...iconStrokeProps} />
        <circle cx="8.1" cy="9.1" r="1.1" {...iconStrokeProps} />
      </svg>
    )
  }

  if (surface === 'canon') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4.75" y="6" width="14.5" height="12" rx="3" {...iconStrokeProps} />
        <circle cx="9.2" cy="10" r="1.05" {...iconStrokeProps} />
        <path d="m7.25 15.4 2.7-2.85 2.45 2.3 2.1-2.1 2.25 2.65" {...iconStrokeProps} />
      </svg>
    )
  }

  if (surface === 'revision') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 7h8" {...iconStrokeProps} />
        <path d="M6.5 10.75h6.25" {...iconStrokeProps} />
        <path d="M6.5 14.5h4.25" {...iconStrokeProps} />
        <circle cx="15.8" cy="15.25" r="3.1" {...iconStrokeProps} />
        <path d="m18.05 17.55 1.95 1.95" {...iconStrokeProps} />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5.75v9" {...iconStrokeProps} />
      <path d="m8.75 9 3.25-3.25L15.25 9" {...iconStrokeProps} />
      <path d="M6.75 17.25v.5a1.75 1.75 0 0 0 1.75 1.75h7a1.75 1.75 0 0 0 1.75-1.75v-.5" {...iconStrokeProps} />
    </svg>
  )
}

const CreateProjectModal = ({
  form,
  isSubmitting,
  onChange,
  onClose,
  onSubmit
}: {
  form: CreateProjectFormState
  isSubmitting: boolean
  onChange: (nextState: CreateProjectFormState) => void
  onClose: () => void
  onSubmit: () => void
}) => (
  <div className="modal-overlay" role="presentation">
    <div className="modal-card" role="dialog" aria-modal="true" aria-label="新建小说项目">
      <div className="modal-card__header">
        <div>
          <span className="eyebrow">项目创建</span>
          <h2>新建小说项目</h2>
          <p>先把作品标题、题材和核心 premise 定下来，工作台会自动准备第一章入口。</p>
        </div>
        <button className="ghost-button" onClick={onClose} disabled={isSubmitting}>
          取消
        </button>
      </div>

      <div className="template-grid">
        {projectTemplateDefinitions.map((template) => (
          <button
            key={template.id}
            className={form.template === template.id ? 'surface-card surface-card--selectable is-active' : 'surface-card surface-card--selectable'}
            onClick={() => onChange({ ...form, template: template.id })}
            disabled={isSubmitting}
          >
            <span className="eyebrow">默认模板</span>
            <h3>{template.label}</h3>
            <p>{template.description}</p>
          </button>
        ))}
      </div>

      <div className="modal-form-grid">
        <label className="field-stack">
          <span>项目标题</span>
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            placeholder="例如：钟楼之后的雨线"
            disabled={isSubmitting}
          />
        </label>
        <label className="field-stack">
          <span>题材</span>
          <input
            value={form.genre}
            onChange={(event) => onChange({ ...form, genre: event.target.value })}
            placeholder="例如：悬疑 / 都市奇幻"
            disabled={isSubmitting}
          />
        </label>
      </div>

      <label className="field-stack">
        <span>核心 premise</span>
        <textarea
          value={form.premise}
          onChange={(event) => onChange({ ...form, premise: event.target.value })}
          placeholder="一句话说明这部小说最核心的冲突、秘密或人物欲望。"
          disabled={isSubmitting}
        />
      </label>

      <div className="modal-card__footer">
        <div className="supporting-note">新项目会默认创建在系统“文稿 / Documents”目录下的 `Lime Novel Projects` 中。</div>
        <button className="primary-button" onClick={onSubmit} disabled={isSubmitting || form.title.trim().length === 0}>
          {isSubmitting ? '正在创建项目...' : '创建并打开项目'}
        </button>
      </div>
    </div>
  </div>
)

const SettingsModal = ({
  shell,
  activityLabel,
  agentSettingsState,
  agentSettingsError,
  isLoadingSettings,
  isSavingSettings,
  agentSettingsTestResult,
  agentSettingsTestError,
  isTestingAgentSettings,
  onSaveAgentSettings,
  onTestAgentSettings,
  onClose,
  onOpenProject,
  onGoPublish
}: {
  shell: WorkspaceShellDto
  activityLabel: string
  agentSettingsState?: AgentRuntimeSettingsStateDto
  agentSettingsError?: string
  isLoadingSettings: boolean
  isSavingSettings: boolean
  agentSettingsTestResult?: AgentRuntimeConnectionTestResultDto
  agentSettingsTestError?: string
  isTestingAgentSettings: boolean
  onSaveAgentSettings: (input: AgentRuntimeSettingsDto) => void
  onTestAgentSettings: (input: AgentRuntimeSettingsDto) => void
  onClose: () => void
  onOpenProject: () => void
  onGoPublish: () => void
}) => {
  const [form, setForm] = useState<AgentRuntimeSettingsDto>(agentSettingsState?.settings ?? defaultAgentRuntimeSettings)

  useEffect(() => {
    if (agentSettingsState) {
      setForm(agentSettingsState.settings)
    }
  }, [agentSettingsState])

  const currentSettings = agentSettingsState?.settings ?? defaultAgentRuntimeSettings
  const trimmedForm = trimAgentRuntimeSettings(form)
  const hasUnsavedChanges = !isSameAgentRuntimeSettings(form, currentSettings)
  const selectedProvider = runtimeProviderDefinitions.find((item) => item.id === form.provider) ?? runtimeProviderDefinitions[0]

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="工作台设置"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header">
          <div className="settings-modal__identity">
            <div className="settings-avatar" aria-hidden="true">
              <img className="brand-mark settings-avatar__mark" src={limeLogoUrl} alt="" />
            </div>
            <div>
              <span className="eyebrow">设置与账户</span>
              <h2>工作台设置</h2>
              <p>项目信息保留在这里，AI Agent 引擎现在也会在这里直接接到真实模型。</p>
            </div>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="surface-grid surface-grid--two settings-modal__grid">
          <section className="surface-card settings-modal__section">
            <span className="eyebrow">账户入口</span>
            <h3>{limeNovelBrand.name}</h3>
            <p>{limeNovelBrand.descriptor}</p>
            <div className="detail-list">
              <div className="detail-list__item">
                <strong>当前模式</strong>
                <span>本地桌面创作模式，账号层后续再接入；当前优先把小说 Agent 主链跑通。</span>
              </div>
              <div className="detail-list__item">
                <strong>产品口号</strong>
                <span>{limeNovelBrand.slogan}</span>
              </div>
            </div>
          </section>

          <section className="surface-card settings-modal__section">
            <span className="eyebrow">当前项目</span>
            <h3>{shell.project.title}</h3>
            <p>{shell.project.subtitle}</p>
            <div className="detail-list">
              <div className="detail-list__item">
                <strong>题材</strong>
                <span>{shell.project.genre}</span>
              </div>
              <div className="detail-list__item">
                <strong>阶段</strong>
                <span>{projectStatusLabel[shell.project.status] ?? shell.project.status}</span>
              </div>
              <div className="detail-list__item">
                <strong>工作区目录</strong>
                <span className="settings-modal__path" title={shell.workspacePath}>
                  {shell.workspacePath}
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="surface-card settings-modal__section">
          <div className="surface-card__header">
            <div>
              <span className="eyebrow">AI Agent 引擎</span>
              <h3>真实模型接入</h3>
            </div>
            <span className="status-chip">{agentSettingsState ? runtimeProviderLabel[agentSettingsState.resolvedProvider] : '加载中'}</span>
          </div>
          <p className="settings-modal__hint">保存后只影响新发起的任务，当前正在运行的代理不会被中断。</p>

          {isLoadingSettings ? (
            <div className="agent-empty-state">
              <strong>正在加载 Agent 配置</strong>
              <p>模型提供商、默认模型和网关入口正在接入设置面板。</p>
            </div>
          ) : agentSettingsError ? (
            <div className="agent-runtime-card__failure">
              <strong>Agent 设置读取失败</strong>
              <p>{agentSettingsError}</p>
            </div>
          ) : (
            <>
              <div className="detail-list detail-list--compact">
                <div className="detail-list__item">
                  <strong>当前生效模式</strong>
                  <span>{agentSettingsState?.mode === 'legacy' ? '规则型本地收口' : '实时模型执行'}</span>
                </div>
                <div className="detail-list__item">
                  <strong>当前 Provider</strong>
                  <span>{agentSettingsState ? runtimeProviderLabel[agentSettingsState.resolvedProvider] : '未设置'}</span>
                </div>
                <div className="detail-list__item">
                  <strong>当前模型</strong>
                  <span>{agentSettingsState?.resolvedModel ?? '未设置'}</span>
                </div>
                <div className="detail-list__item">
                  <strong>当前入口</strong>
                  <span className="settings-modal__path" title={agentSettingsState?.resolvedBaseUrl}>
                    {agentSettingsState?.resolvedBaseUrl || '本地规则模式无需网关地址'}
                  </span>
                </div>
              </div>

              <div className="settings-runtime-grid">
                <label className="field-stack">
                  <span>运行模式</span>
                  <select
                    value={form.provider}
                    disabled={isSavingSettings}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        provider: event.target.value as AgentRuntimeSettingsDto['provider']
                      })
                    }
                  >
                    {runtimeProviderDefinitions.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>

                {form.provider !== 'legacy' ? (
                  <label className="field-stack">
                    <span>API Key</span>
                    <input
                      type="password"
                      value={form.apiKey}
                      onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                      placeholder="直接填平台 API Key，或填自建网关对应凭证"
                      disabled={isSavingSettings}
                    />
                  </label>
                ) : null}
              </div>

              <div className="supporting-note">{selectedProvider.description}</div>

              {form.provider !== 'legacy' ? (
                <>
                  <div className="settings-runtime-grid">
                    <label className="field-stack">
                      <span>模型 ID（可选）</span>
                      <input
                        value={form.model}
                        onChange={(event) => setForm({ ...form, model: event.target.value })}
                        placeholder={resolveRuntimeModelPlaceholder(form.provider)}
                        disabled={isSavingSettings}
                      />
                    </label>
                    <label className="field-stack">
                      <span>Base URL（可选）</span>
                      <input
                        value={form.baseUrl}
                        onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                        placeholder={resolveRuntimeBaseUrlPlaceholder(form.provider)}
                        disabled={isSavingSettings}
                      />
                    </label>
                  </div>

                  <div className="supporting-note">
                    留空时会自动使用当前 provider 的默认模型与默认入口，这样更接近 CC 的开箱体验；只有你在走代理网关或兼容平台时，才需要手动填写。
                  </div>
                </>
              ) : (
                <div className="supporting-note">
                  当前不会调用任何外部模型。之前保存过的 API Key、模型和网关地址会被保留，切回实时模式即可继续使用。
                </div>
              )}

              <div className="detail-list detail-list--compact">
                <div className="detail-list__item">
                  <strong>连接测试</strong>
                  <span>测试只验证当前表单配置的连通性，不会自动保存设置。</span>
                </div>
              </div>

              {agentSettingsTestError ? (
                <div className="agent-runtime-card__failure">
                  <strong>连接测试失败</strong>
                  <p>{agentSettingsTestError}</p>
                </div>
              ) : null}

              {agentSettingsTestResult ? (
                <article className="agent-runtime-card">
                  <div className="agent-runtime-card__meta">
                    <div>
                      <strong>最近一次测试结果</strong>
                      <p>{agentSettingsTestResult.summary}</p>
                    </div>
                    <span className="agent-runtime-card__time">{agentSettingsTestResult.latencyMs}ms</span>
                  </div>
                  <div className="detail-list detail-list--compact">
                    <div className="detail-list__item">
                      <strong>Provider</strong>
                      <span>{runtimeTestProviderLabel[agentSettingsTestResult.provider]}</span>
                    </div>
                    <div className="detail-list__item">
                      <strong>模型</strong>
                      <span>{agentSettingsTestResult.model}</span>
                    </div>
                    <div className="detail-list__item">
                      <strong>入口</strong>
                      <span className="settings-modal__path" title={agentSettingsTestResult.baseUrl}>
                        {agentSettingsTestResult.baseUrl || '本地规则模式无需网关地址'}
                      </span>
                    </div>
                    {agentSettingsTestResult.stopReason ? (
                      <div className="detail-list__item">
                        <strong>停止原因</strong>
                        <span>{agentSettingsTestResult.stopReason}</span>
                      </div>
                    ) : null}
                    {agentSettingsTestResult.responseText ? (
                      <div className="detail-list__item">
                        <strong>响应内容</strong>
                        <span>{agentSettingsTestResult.responseText}</span>
                      </div>
                    ) : null}
                    {hasUnsavedChanges ? (
                      <div className="detail-list__item">
                        <strong>结果提示</strong>
                        <span>当前表单又有新的未保存改动，最近一次测试结果可能已经过期。</span>
                      </div>
                    ) : null}
                  </div>
                </article>
              ) : null}

              <div className="hero-actions settings-modal__actions">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={isSavingSettings || isTestingAgentSettings || isLoadingSettings}
                  onClick={() => onTestAgentSettings(trimmedForm)}
                >
                  {isTestingAgentSettings ? '正在测试连接...' : '测试当前配置'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={isSavingSettings || !hasUnsavedChanges}
                  onClick={() => setForm(currentSettings)}
                >
                  恢复已保存
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={isSavingSettings || !hasUnsavedChanges}
                  onClick={() => onSaveAgentSettings(trimmedForm)}
                >
                  {isSavingSettings ? '正在保存 Agent 设置...' : '保存 Agent 设置'}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="surface-card settings-modal__section">
          <div className="surface-card__header">
            <div>
              <span className="eyebrow">快捷动作</span>
              <h3>工作区与发布入口</h3>
            </div>
          </div>
          <div className="detail-list">
            <div className="detail-list__item">
              <strong>当前状态</strong>
              <span>{activityLabel}</span>
            </div>
            <div className="detail-list__item">
              <strong>最近章节</strong>
              <span>{shell.project.currentChapterId ?? '尚未定位章节'}</span>
            </div>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                onOpenProject()
                onClose()
              }}
            >
              打开项目
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                onGoPublish()
                onClose()
              }}
            >
              进入发布
            </button>
            <button type="button" className="primary-button" onClick={onClose}>
              返回工作台
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

const HomeSurface = ({
  shell,
  activeChapter,
  feedState,
  onSurfaceChange,
  onCreateProjectRequest,
  onSelectChapter,
  onStartTask
}: {
  shell: WorkspaceShellDto
  activeChapter?: ChapterListItemDto
  feedState: AgentFeedSnapshot
  onSurfaceChange: (surface: NovelSurfaceId) => void
  onCreateProjectRequest: () => void
  onSelectChapter: (chapterId: string) => void
  onStartTask: (intent: string) => void
}) => {
  const totalWords = shell.chapterTree.reduce((sum, chapter) => sum + chapter.wordCount, 0)
  const progress = Math.min(totalWords / 200000, 1)
  const spotlightItems = feedState.feed.slice(0, 3)
  const harnessArtifactCount =
    shell.diagnosticReports.length +
    shell.impactAnalyses.length +
    shell.intentPlans.length +
    shell.readerFeedback.length +
    shell.timelineIterations.length
  const latestDiagnosticReport = shell.diagnosticReports[0]
  const latestImpactAnalysis = shell.impactAnalyses[0]
  const latestTimelineIteration = shell.timelineIterations[0]

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--home">
        <div className="surface-hero__main">
          <span className="eyebrow">回到你的作品</span>
          <h1>{shell.project.title}</h1>
          <p>{shell.project.premise}</p>
          <div className="hero-metrics">
            <span>总字数 {formatCount(totalWords)}</span>
            <span>知识资产 {shell.knowledgeSummary.totalDocuments}</span>
            <span>拆书样本 {shell.analysisSamples.length}</span>
            <span>候选设定卡 {shell.canonCandidates.length}</span>
            <span>修订问题 {shell.revisionIssues.length}</span>
            <span>Harness 产物 {harnessArtifactCount}</span>
            <span>导出预设 {shell.exportPresets.length}</span>
          </div>
          <div className="progress-track">
            <div className="progress-track__fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => activeChapter && onSelectChapter(activeChapter.chapterId)}>
              继续写作
            </button>
            <button
              className="ghost-button"
              onClick={() => onStartTask('请帮我恢复当前项目现场，并给出下一步最优先动作。')}
            >
              恢复现场
            </button>
            <button className="ghost-button" onClick={onCreateProjectRequest}>
              新建项目
            </button>
            <button className="ghost-button" onClick={() => onSurfaceChange('canon')}>
              打开候选设定卡
            </button>
            <button className="ghost-button" onClick={() => onSurfaceChange('knowledge')}>
              打开知识工作台
            </button>
          </div>
        </div>
      </section>

      <div className="surface-grid surface-grid--two">
        <article className="surface-card surface-card--focus">
          <div className="surface-card__header">
            <span className="eyebrow">当前主项目</span>
            <span className="status-chip">{activeChapter ? chapterStatusLabel[activeChapter.status] : '等待选择'}</span>
          </div>
          <h2>{activeChapter ? `第 ${activeChapter.order} 章 · ${activeChapter.title}` : '尚未选择章节'}</h2>
          <p>{activeChapter?.summary ?? '请从左侧章节树选择当前工作对象。'}</p>
          <div className="detail-list">
            <div className="detail-list__item">
              <strong>当前场景</strong>
              <span>{shell.sceneList[0]?.title ?? '等待场景'}</span>
            </div>
            <div className="detail-list__item">
              <strong>章节目标</strong>
              <span>{shell.sceneList[0]?.goal ?? '先恢复写作现场'}</span>
            </div>
            <div className="detail-list__item">
              <strong>上次停下</strong>
              <span>{activeChapter ? `${activeChapter.wordCount} 字 · ${activeChapter.volumeLabel ?? '主线项目'}` : '暂无'}</span>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="surface-card__header">
            <span className="eyebrow">最近产物</span>
            <button className="inline-link" onClick={() => onSurfaceChange('revision')}>
              查看全部结果
            </button>
          </div>
          <div className="stacked-notes">
            {spotlightItems.map((item) => (
              <div key={item.itemId} className="stacked-note">
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <section className="surface-grid surface-grid--three">
        <article className="surface-card">
          <span className="eyebrow">小说驾驭引擎</span>
          <h3>{shell.project.lifecycleMode === 'timeline' ? 'Timeline 时间线模式' : 'Sandbox 沙盘模式'}</h3>
          <p>{shell.harnessProfile.constraints[0] ?? 'Harness 负责先诊断、模拟和出方案，不直接覆盖正文。'}</p>
        </article>
        <article className="surface-card">
          <span className="eyebrow">最新体检 / 影响</span>
          <h3>{latestDiagnosticReport ? latestDiagnosticReport.summary : '等待小说体检报告'}</h3>
          <p>
            {latestImpactAnalysis
              ? `最近冲击波：${latestImpactAnalysis.riskLevel} · ${latestImpactAnalysis.affectedRefs.length} 个影响对象`
              : '可从修订工作面发起体检、黄金三章检查或冲击波分析。'}
          </p>
        </article>
        <article className="surface-card">
          <span className="eyebrow">读者与时间线</span>
          <h3>{shell.readerFeedback.length} 组反馈映射</h3>
          <p>
            {latestTimelineIteration
              ? `最近计划：${latestTimelineIteration.strategy}，承载 ${latestTimelineIteration.targetFutureRefs.join(' / ')}`
              : '读者反馈会先作为证据映射，再决定是否进入未来章节补强。'}
          </p>
        </article>
      </section>

      <section className="surface-grid surface-grid--three">
        {shell.homeHighlights.map((item) => (
          <article key={item.title} className="surface-card">
            <span className="eyebrow">项目健康度</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>
    </div>
  )
}

const WritingSurface = ({
  shell,
  chapterDocument,
  renderedChapter,
  selectedScene,
  feedState,
  activityLabel,
  runtimeLabel,
  onSelectChapter,
  onStartTask,
  onApplyProposal,
  onRejectProposal,
  onSaveChapter
}: {
  shell: WorkspaceShellDto
  chapterDocument?: ChapterDocumentDto
  renderedChapter?: ChapterListItemDto
  selectedScene?: WorkspaceShellDto['sceneList'][number]
  feedState: AgentFeedSnapshot
  activityLabel: string
  runtimeLabel: string
  onSelectChapter: (chapterId: string) => void
  onStartTask: (intent: string) => void
  onApplyProposal: (proposalId: string) => void
  onRejectProposal: (proposalId: string) => void
  onSaveChapter: (chapterId: string, content: string) => void
}) => {
  const [draftContent, setDraftContent] = useState(chapterDocument?.content ?? '')
  const [intentDraft, setIntentDraft] = useState('帮我检查这一章是否需要提前补强反转依据。')
  const [isEditorOpen, setEditorOpen] = useState(false)
  const [isPreviewVisible, setPreviewVisible] = useState(true)
  const latestTask = resolveActiveWritingTask(feedState.tasks)
  const taskFeed = resolveTaskFeed(feedState.feed, latestTask)
  const visibleProposals = taskFeed.filter(isReviewFeedItem).slice(0, 4)
  const pendingProposals = taskFeed.filter(isPendingProposalItem)
  const proposalCount = pendingProposals.length
  const runSteps = buildWritingRunSteps(latestTask, proposalCount)

  useEffect(() => {
    setDraftContent(chapterDocument?.content ?? '')
  }, [chapterDocument?.chapterId, chapterDocument?.content])

  if (!chapterDocument) {
    return (
      <section className="surface-card">
        <span className="eyebrow">写作工作面</span>
        <h2>正在准备章节...</h2>
      </section>
    )
  }

  const isDirty = draftContent !== chapterDocument.content
  const isReadOnlyByTimeline = shell.project.lockedChapterRefs.includes(chapterDocument.chapterId)
  const previewChapter = renderedChapter ?? shell.chapterTree.find((chapter) => chapter.chapterId === chapterDocument.chapterId)
  const isPreviewingCurrentChapter = previewChapter?.chapterId === chapterDocument.chapterId
  const previewParagraphs = isPreviewingCurrentChapter
    ? excerptParagraphs(chapterDocument.content)
    : excerptParagraphs(previewChapter?.summary)
  const handleSubmitIntent = (): void => {
    const intent = intentDraft.trim()

    if (!intent) {
      return
    }

    onStartTask(intent)
    setIntentDraft('')
  }
  const handleSave = (): void => {
    if (isReadOnlyByTimeline) {
      return
    }

    onSaveChapter(chapterDocument.chapterId, draftContent)
  }

  return (
    <div className="agent-writing-stage">
      <header className="agent-writing-header">
        <div className="agent-writing-header__title">
          <h1>{latestTask?.title ?? `${chapterDocument.title} 的 Agent 任务`}</h1>
          <span>
            Agent 正在围绕《{chapterDocument.title}》读取章节材料、{selectedScene?.title ?? '故事资产'}、人物线、伏笔线、发布规则和启用能力包
          </span>
        </div>
        <div className="agent-writing-header__actions">
          <button type="button" className="writing-mini-button" onClick={() => onStartTask('请检查当前章会牵动哪些人物线、伏笔线和后文反转。')}>
            牵动范围
          </button>
          <button type="button" className="writing-mini-button" onClick={() => onStartTask('请按目标平台检查这一章发布风险，只给建议，不直接改正文。')}>
            发布避雷
          </button>
          <button type="button" className="writing-mini-button writing-mini-button--primary" onClick={() => onStartTask('请生成一个待确认变更包，包含牵动范围、改动对照和可撤回范围。')}>
            {proposalCount > 0 ? `${proposalCount} 项待确认` : '生成变更包'}
          </button>
        </div>
      </header>

      <section className="agent-writing-feed" aria-label="AI Agent 主线程">
        <div className="agent-writing-feed__inner">
          <div className="agent-writing-run-meta">
            <span>{activityLabel}</span>
          </div>

          <article className="agent-writing-intent-card">
            <header>
              <strong>作者意图</strong>
              <span className="status-chip status-chip--slim">主输入</span>
            </header>
            <p>{latestTask?.summary ?? `帮我看《${chapterDocument.title}》会不会牵动后面反转，不要直接改正文，先给我一个可确认的变更包。`}</p>
          </article>

          <article className="agent-writing-card">
            <header>
              <strong>Lime Agent</strong>
              <span className="status-chip status-chip--slim">{runtimeLabel}</span>
            </header>
            <p>我会先保护当前状态，再读取相关材料。正文、人物线、伏笔线、发布避雷都会进入同一个试改版本，等待你确认后才落地。</p>
            <div className="agent-writing-capsules">
              <span className="memory-chip">{chapterDocument.title}</span>
              <span className="memory-chip">渲染：{previewChapter?.title ?? '当前章'}</span>
              <span className="memory-chip">{selectedScene?.title ?? '故事资产'}</span>
              <span className="memory-chip">人物线</span>
              <span className="memory-chip">伏笔线</span>
              <span className="memory-chip">发布避雷</span>
              <span className="memory-chip">能力包</span>
            </div>
            <div className="agent-writing-plan">
              <div><b>1. 读材料</b><span>当前章、章节材料、人物线、伏笔线。</span></div>
              <div><b>2. 找牵动</b><span>判断本章变化会影响哪些后文和故事资产。</span></div>
              <div><b>3. 出变更包</b><span>只生成待确认建议，不直接覆盖正文。</span></div>
            </div>
          </article>

          <article className="agent-writing-card">
            <header>
              <strong>运行记录</strong>
              <span className="status-chip status-chip--slim status-chip--muted">
                {latestTask ? taskStatusLabel[latestTask.status] : '等待意图'}
              </span>
            </header>
            <div className="agent-writing-run-steps">
              {runSteps.map((step) => (
                <div key={step.title} className={buildRunStepClassName(step.state)}>
                  <i>{step.marker}</i>
                  <div><b>{step.title}</b><span>{step.body}</span></div>
                  <small>{step.label}</small>
                </div>
              ))}
            </div>
            <div className="agent-writing-card__actions">
              <button type="button" className="primary-button" onClick={() => onStartTask('请生成一个变更包，包含正文改动、牵动范围和可撤回范围。')}>
                生成变更包
              </button>
              <button type="button" className="ghost-button" onClick={() => onStartTask('先不改正文，只解释当前章会牵动哪些后文资产。')}>
                只解释牵动
              </button>
            </div>
          </article>

          {isPreviewVisible ? (
            <article className="agent-writing-render-card">
              <header>
                <strong>{previewChapter ? `第 ${previewChapter.order} 章 ${previewChapter.title}` : chapterDocument.title}</strong>
                <div className="agent-writing-card__actions">
                  {isPreviewingCurrentChapter ? (
                    <button type="button" className="ghost-button" onClick={() => setEditorOpen((value) => !value)}>
                      {isEditorOpen ? '收起编辑' : '打开编辑'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => previewChapter && onSelectChapter(previewChapter.chapterId)}
                    >
                      设为当前写作章
                    </button>
                  )}
                  <button type="button" className="ghost-button" onClick={() => setPreviewVisible(false)}>
                    收起
                  </button>
                </div>
              </header>
              {isPreviewingCurrentChapter && isEditorOpen ? (
                <div className="agent-writing-editor-frame">
                  <ChapterEditor content={draftContent} onChange={setDraftContent} onSave={handleSave} />
                  <div className="agent-writing-editor-actions">
                    <span>{isDirty ? '有未保存更改' : '正文已保存'}</span>
                    <button type="button" className="primary-button" onClick={handleSave} disabled={isReadOnlyByTimeline}>
                      {isReadOnlyByTimeline ? '已发布只读' : '保存正文'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="agent-writing-render-body">
                  {(previewParagraphs.length > 0 ? previewParagraphs : [chapterDocument.content]).slice(0, 6).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {!isPreviewingCurrentChapter ? (
                    <p className="agent-writing-render-note">
                      这是章节材料预览，尚未切换当前 Agent 主线程。需要让 Agent 围绕本章工作时，可设为当前写作章。
                    </p>
                  ) : null}
                </div>
              )}
            </article>
          ) : (
            <button type="button" className="agent-writing-open-preview" onClick={() => setPreviewVisible(true)}>
              打开章节渲染 · {previewChapter?.title ?? chapterDocument.title}
            </button>
          )}

          <article className="agent-writing-change-dock">
            <header>
              <strong>变更审阅</strong>
              <span className="status-chip status-chip--slim">{proposalCount > 0 ? `${proposalCount} 项待确认` : '等待变更包'}</span>
            </header>
            {visibleProposals.length > 0 ? (
              visibleProposals.map((item) => (
                <div key={item.itemId} className="agent-writing-review-row">
                  <div>
                    <b>{item.title}</b>
                    <span>{item.body}</span>
                  </div>
                  {item.proposalId ? (
                    <div className="agent-writing-card__actions">
                      <button type="button" className="primary-button" onClick={() => onApplyProposal(item.proposalId as string)}>
                        采纳
                      </button>
                      <button type="button" className="ghost-button" onClick={() => onRejectProposal(item.proposalId as string)}>
                        丢弃
                      </button>
                    </div>
                  ) : (
                    <span className="status-chip status-chip--slim status-chip--muted">{item.kind}</span>
                  )}
                </div>
              ))
            ) : (
              <>
                <div className="agent-writing-review-row">
                  <div><b>《{chapterDocument.title}》牵动范围</b><span>等待 Agent 生成正文、人物线、伏笔线的变更包。</span></div>
                  <button type="button" className="ghost-button" onClick={() => onStartTask('请生成当前章的牵动范围变更包。')}>查看</button>
                </div>
                <div className="agent-writing-review-row">
                  <div><b>发布避雷建议</b><span>平台规则包读取后，会在这里显示可确认建议。</span></div>
                  <button type="button" className="ghost-button" onClick={() => onStartTask('请生成当前章的发布避雷建议。')}>查看</button>
                </div>
              </>
            )}
          </article>
        </div>
      </section>

      <div className="agent-writing-composer-dock">
        <div className="agent-writing-composer">
          <textarea
            value={intentDraft}
            onChange={(event) => setIntentDraft(event.target.value)}
            placeholder="直接告诉 Agent 你想做什么，例如：检查这一章会牵动哪些后文，不要直接改正文。"
          />
          <div className="agent-writing-composer__actions">
            <div className="agent-writing-prompt-row">
              <button type="button" className="writing-chip-button" onClick={() => setIntentDraft('帮我检查这一章会牵动哪些人物线和伏笔线。')}>
                牵动范围
              </button>
              <button type="button" className="writing-chip-button" onClick={() => setIntentDraft('按目标平台检查这一章发布风险，只给建议，不直接改正文。')}>
                发布避雷
              </button>
              <button type="button" className="writing-chip-button" onClick={() => setIntentDraft('把主角目标写得更强，但先生成变更包让我确认。')}>
                人物动机
              </button>
              <button type="button" className="writing-chip-button" onClick={() => setIntentDraft('检查当前伏笔是否接近回收，给我下一章建议。')}>
                伏笔线
              </button>
            </div>
            <button type="button" className="primary-button" onClick={handleSubmitIntent}>
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const HomeStructurePanel = ({
  shell,
  activeChapter,
  onSurfaceChange,
  onCreateProjectRequest,
  onSelectChapter,
  onOpenProject,
  isCreatingProject
}: {
  shell: WorkspaceShellDto
  activeChapter?: ChapterListItemDto
  onSurfaceChange: (surface: NovelSurfaceId) => void
  onCreateProjectRequest: () => void
  onSelectChapter: (chapterId: string) => void
  onOpenProject: () => void
  isCreatingProject: boolean
}) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">作品导航</span>
      <div className="structure-panel__actions">
        <button className="structure-button structure-button--primary" onClick={onCreateProjectRequest} disabled={isCreatingProject}>
          + 新建小说项目
        </button>
        <button className="structure-button" onClick={onOpenProject}>
          打开本地项目
        </button>
      </div>
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">最近继续</span>
      <button className="panel-list-button panel-list-button--active" onClick={() => activeChapter && onSelectChapter(activeChapter.chapterId)}>
        <strong>{shell.project.title}</strong>
        <span>{activeChapter ? `上次停在第 ${activeChapter.order} 章 · ${activeChapter.wordCount} 字` : '回到当前项目'}</span>
      </button>
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">系列</span>
      <div className="panel-note">
        <strong>{shell.chapterTree[0]?.volumeLabel ?? '主线项目'}</strong>
        <span>
          {shell.chapterTree.length} 章 / {shell.canonCandidates.length} 张设定卡 / {shell.knowledgeSummary.totalDocuments} 份知识资产
        </span>
      </div>
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">待处理结果</span>
      <button className="panel-list-button" onClick={() => onSurfaceChange('feature-center')}>
        <strong>{`${featureCenterEntry.label} / ${resolveFeatureToolLabel('analysis')}`}</strong>
        <span>{shell.analysisSamples.length > 0 ? `${shell.analysisSamples.length} 个样本可继续对标` : '先导入爆款样本开始建模'}</span>
      </button>
      <button className="panel-list-button" onClick={() => onSurfaceChange('canon')}>
        <strong>设定代理</strong>
        <span>新增 {shell.canonCandidates.length} 张候选卡</span>
      </button>
      <button className="panel-list-button" onClick={() => onSurfaceChange('knowledge')}>
        <strong>知识工作台</strong>
        <span>当前有 {shell.knowledgeSummary.totalDocuments} 份知识资产可继续提问</span>
      </button>
      <button className="panel-list-button" onClick={() => onSurfaceChange('revision')}>
        <strong>修订代理</strong>
        <span>当前有 {shell.revisionIssues.length} 个问题待处理</span>
      </button>
      <button className="panel-list-button" onClick={() => onSurfaceChange('publish')}>
        <strong>发布代理</strong>
        <span>{shell.exportPresets.filter((preset) => preset.status === 'ready').length} 个预设可直接导出</span>
      </button>
    </div>
  </div>
)

const WritingStructurePanel = ({
  shell,
  chapterId,
  renderedChapterId,
  selectedSceneId,
  onPreviewChapter,
  onSelectScene,
  onStartTask
}: {
  shell: WorkspaceShellDto
  chapterId?: string
  renderedChapterId?: string
  selectedSceneId?: string
  onPreviewChapter: (chapterId: string) => void
  onSelectScene: (sceneId: string) => void
  onStartTask: (intent: string) => void
}) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <div className="side-head">
        <h3>新对话</h3>
        <button className="ghost-button" onClick={() => onStartTask('请新建一个写作意图，并先读取当前小说上下文资产。')}>
          ＋
        </button>
      </div>
      <button className="panel-list-button panel-list-button--active" onClick={() => onStartTask('请检查当前章伏笔会牵动哪里。')}>
        <strong>伏笔会牵动哪里</strong>
        <span>刚刚 · Agent 主线程</span>
      </button>
      <button className="panel-list-button" onClick={() => onStartTask('请按目标平台检查当前章发布风险。')}>
        <strong>当前章发布避雷</strong>
        <span>12 分 · 只给建议</span>
      </button>
      <button className="panel-list-button" onClick={() => onStartTask('请补强人物动机，但先生成变更包。')}>
        <strong>人物动机补强</strong>
        <span>1 小时 · 待确认</span>
      </button>
    </div>

    <div className="structure-panel__section">
      <div className="side-head">
        <h3>章节材料</h3>
        <small>点击渲染</small>
      </div>
      {shell.chapterTree.map((chapter) => (
        <button
          key={chapter.chapterId}
          className={chapter.chapterId === renderedChapterId ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
          onClick={() => onPreviewChapter(chapter.chapterId)}
        >
          <strong>{`第 ${chapter.order} 章 ${chapter.title}`}</strong>
          <span>
            {chapterStatusLabel[chapter.status]} · {formatCount(chapter.wordCount)} 字
            {chapter.chapterId === chapterId ? ' · 当前写作章' : ''}
            {chapter.chapterId === renderedChapterId && chapter.chapterId !== chapterId ? ' · 正在渲染' : ''}
          </span>
        </button>
      ))}
    </div>

    <div className="structure-panel__section">
      <div className="side-head">
        <h3>故事资产</h3>
        <small>Agent 可读取</small>
      </div>
      {shell.sceneList.map((scene) => (
        <button
          key={scene.sceneId}
          className={scene.sceneId === selectedSceneId ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
          onClick={() => onSelectScene(scene.sceneId)}
        >
          <strong>{`${scene.order}. ${scene.title}`}</strong>
          <span>{sceneStatusLabel[scene.status]} · {scene.goal}</span>
        </button>
      ))}
    </div>

    <div className="structure-panel__section">
      <div className="side-head">
        <h3>能力包</h3>
        <small>项目启用</small>
      </div>
      <div className="agent-writing-capsules">
        <span className="memory-chip">人物线同步</span>
        <span className="memory-chip">伏笔线检查</span>
        <span className="memory-chip">发布避雷</span>
        <span className="memory-chip">修订检查</span>
      </div>
    </div>
  </div>
)

const AgentWritingInspector = ({
  shell,
  chapterDocument,
  renderedChapter,
  selectedScene,
  feedState,
  runtimeLabel,
  activePane,
  onPaneChange,
  onCollapse,
  onStartTask,
  onApplyProposal,
  onRejectProposal
}: {
  shell: WorkspaceShellDto
  chapterDocument?: ChapterDocumentDto
  renderedChapter?: ChapterListItemDto
  selectedScene?: WorkspaceShellDto['sceneList'][number]
  feedState: AgentFeedSnapshot
  runtimeLabel: string
  activePane: WritingInspectorPane
  onPaneChange: (pane: WritingInspectorPane) => void
  onCollapse: () => void
  onStartTask: (intent: string) => void
  onApplyProposal: (proposalId: string) => void
  onRejectProposal: (proposalId: string) => void
}) => {
  const latestTask = resolveActiveWritingTask(feedState.tasks)
  const taskFeed = resolveTaskFeed(feedState.feed, latestTask)
  const pendingItems = taskFeed.filter(isPendingProposalItem)
  const latestRecord =
    shell.revisionRecords.find((record) => record.chapterId === chapterDocument?.chapterId) ?? shell.revisionRecords[0]
  const publishingFinding = shell.diagnosticReports
    .flatMap((report) => report.findings)
    .find(
      (finding) =>
        (finding.area === 'publishing' || finding.area === 'reader-risk') &&
        (!chapterDocument || finding.targetRefs.includes(chapterDocument.chapterId))
    )
  const latestPublishFeedback = shell.latestExportComparison?.addedFeedback[0] ?? shell.recentExports[0]?.platformFeedback[0]
  const publishRiskLabel = publishingFinding ? `${publishingFinding.severity} 风险` : '待检查'

  return (
    <aside className="agent-writing-inspector">
      <nav className="agent-writing-tabs" aria-label="右侧面板">
        {writingInspectorPaneDefinitions.map((item) => (
          <button
            key={item.id}
            className={activePane === item.id ? 'is-active' : ''}
            onClick={() => onPaneChange(item.id)}
            title={item.description}
            type="button"
          >
            {item.label}
          </button>
        ))}
        <button
          className="agent-writing-tabs__collapse"
          onClick={onCollapse}
          type="button"
          aria-label="折叠写作检查栏"
          title="折叠写作检查栏"
        >
          <span className="agent-writing-tabs__collapse-icon">
            <CollapseSidebarIcon />
          </span>
        </button>
      </nav>

      <div className="agent-writing-inspector__body">
        {activePane === 'state' ? (
          <>
            <section className="agent-writing-panel">
              <h3>环境信息</h3>
              <div className="agent-writing-context-row"><span>◎</span><b>变更</b><small>{pendingItems.length} 待确认</small></div>
              <div className="agent-writing-context-row"><span>▣</span><b>本地</b><small>{shell.project.lifecycleMode}</small></div>
              <div className="agent-writing-context-row"><span>◇</span><b>当前章</b><small>{chapterDocument?.title ?? '加载中'}</small></div>
              <div className="agent-writing-context-row"><span>□</span><b>渲染</b><small>{renderedChapter?.title ?? chapterDocument?.title ?? '当前章'}</small></div>
              <div className="agent-writing-context-row"><span>✦</span><b>故事资产</b><small>{selectedScene?.title ?? '未选择'}</small></div>
              <div className="agent-writing-context-row"><span>☰</span><b>Lime App Server</b><small>{runtimeLabel}</small></div>
            </section>

            <section className="agent-writing-panel">
              <h3>当前章态势 <span className="status-chip status-chip--slim">可继续写</span></h3>
              <p>{chapterDocument?.objective ?? shell.project.premise}</p>
              <div className="agent-writing-capsules">
                <span className="memory-chip">{selectedScene ? sceneStatusLabel[selectedScene.status] : '故事资产待选'}</span>
                <span className="memory-chip">反转依据待补强</span>
              </div>
            </section>

            {selectedScene ? (
              <section className="agent-writing-panel">
                <h3>选中故事资产</h3>
                <div className="agent-writing-line-item">
                  <header><strong>{selectedScene.title}</strong><small>{sceneStatusLabel[selectedScene.status]}</small></header>
                  <p>{selectedScene.goal}</p>
                </div>
              </section>
            ) : null}

            <section className="agent-writing-panel">
              <h3>人物线</h3>
              {shell.canonCandidates.slice(0, 2).map((card) => (
                <div key={card.cardId} className="agent-writing-line-item">
                  <header><strong>{card.name}</strong><small>{card.visibility}</small></header>
                  <p>{card.summary}</p>
                </div>
              ))}
            </section>

            <section className="agent-writing-panel">
              <h3>伏笔线</h3>
              <div className="agent-writing-progress-steps">
                <span className="is-active">埋下</span>
                <span className="is-active">加深</span>
                <span className="is-active">接近回收</span>
                <span>回收</span>
              </div>
              <p>建议先让 Agent 读取后续章纲，再决定是否生成后文补强变更包。</p>
            </section>
          </>
        ) : null}

        {activePane === 'changes' ? (
          <section className="agent-writing-panel">
            <h3>变更包 <span className="status-chip status-chip--slim">{pendingItems.length > 0 ? '待确认' : '未生成'}</span></h3>
            <p>同步前保护点会保存正文、故事状态、平台规则和能力包。所有改动需要确认后才会写回。</p>
            <div className="agent-writing-change-summary">
              {pendingItems.length > 0 ? (
                pendingItems.map((item) => (
                  <div key={item.itemId} className="agent-writing-change-row">
                    <span>✓</span>
                    <div><b>{item.title}</b><small>{item.body}</small></div>
                    {item.proposalId ? (
                      <div className="agent-writing-card__actions">
                        <button type="button" className="primary-button" onClick={() => onApplyProposal(item.proposalId as string)}>采纳</button>
                        <button type="button" className="ghost-button" onClick={() => onRejectProposal(item.proposalId as string)}>丢弃</button>
                      </div>
                    ) : (
                      <small>{item.kind}</small>
                    )}
                  </div>
                ))
              ) : (
                <div className="agent-writing-change-row">
                  <span>!</span>
                  <div><b>等待 Agent 生成变更包</b><small>点击下方按钮先读上下文，再生成可确认建议。</small></div>
                  <button type="button" className="primary-button" onClick={() => onStartTask('请生成一个待确认变更包。')}>生成</button>
                </div>
              )}
            </div>
            {latestRecord ? (
              <div className="diff-card">
                <div>
                  <span>原文</span>
                  <p>{latestRecord.beforePreview}</p>
                </div>
                <div>
                  <span>提议</span>
                  <p>{latestRecord.afterPreview}</p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activePane === 'risk' ? (
          <section className="agent-writing-panel">
            <h3>发布避雷 <span className="status-chip status-chip--slim status-chip--muted">{publishRiskLabel}</span></h3>
            <p>目标平台规则会作为能力包读取。当前不会直接改正文，只生成建议或变更包。</p>
            <div className="agent-writing-line-item">
              <header><strong>{publishingFinding?.diagnosis ?? '等待平台检查'}</strong><small>{publishingFinding?.area ?? '未生成'}</small></header>
              <p>
                {publishingFinding?.recommendation ??
                  latestPublishFeedback ??
                  '可以让 Agent 按番茄、起点或自定义口径检查敏感表达、节奏和发布风险。'}
              </p>
              <div className="agent-writing-capsules">
                <span className="memory-chip">平台规则包</span>
                <span className="memory-chip">发布避雷</span>
              </div>
            </div>
            <div className="agent-writing-card__actions">
              <button type="button" className="primary-button" onClick={() => onStartTask('请按目标平台给当前章做发布避雷检查，并生成待确认建议。')}>
                按建议检查
              </button>
              <button type="button" className="ghost-button" onClick={() => onStartTask('记录这次发布风险，但不要修改正文。')}>
                忽略并记录
              </button>
            </div>
          </section>
        ) : null}

        {activePane === 'clock' ? (
          <section className="agent-writing-panel">
            <h3>故事时光机</h3>
            <p>最近一次 AI 更新可以完整撤回，也可以只撤回人物线、伏笔线或发布风险。真实保护点由 Lime App Server 写入。</p>
            <div className="agent-writing-line-item">
              <header><strong>同步前保护点</strong><small>{chapterDocument?.lastEditedAt ?? '当前'}</small></header>
              <p>包含正文、设定、人物线、伏笔线、平台规则和启用能力包。</p>
            </div>
            <div className="agent-writing-line-item">
              <header><strong>可撤回范围</strong><small>3 类</small></header>
              <div className="agent-writing-capsules">
                <span className="memory-chip">人物线</span>
                <span className="memory-chip">伏笔线</span>
                <span className="memory-chip">发布风险</span>
              </div>
            </div>
            <div className="agent-writing-card__actions">
              <button type="button" className="ghost-button" onClick={() => onStartTask('请撤回最近一次 AI 更新，并说明会影响哪些故事资产。')}>
                撤回这次更新
              </button>
              <button type="button" className="primary-button" onClick={() => onStartTask('请说明当前章节最近一次同步前保护点包含哪些内容，不要修改正文。')}>
                说明保护点
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  )
}

export const NovelWorkbench = ({
  shell,
  chapterDocument,
  activeChapterId: currentChapterId,
  activeSurface,
  activeFeatureTool,
  sidebarMode,
  feedState,
  activityLabel,
  isCreatingProject,
  isOpeningProject,
  isImportingAnalysisSample,
  isImportingKnowledgeDocument,
  isApplyingAnalysisStrategy,
  isCreatingExportPackage,
  isGeneratingKnowledgeAnswer,
  agentSettingsState,
  agentSettingsError,
  isAgentSettingsLoading,
  isSavingAgentSettings,
  agentSettingsTestResult,
  agentSettingsTestError,
  isTestingAgentSettings,
  onTestAgentSettings,
  onSurfaceChange,
  onFeatureToolChange,
  onCreateProject,
  onOpenProject,
  onSidebarModeChange,
  onSelectChapter,
  onInspectRevisionIssueChapter,
  onStartTask,
  onApplyProposal,
  onRejectProposal,
  onSaveChapter,
  onImportAnalysisSample,
  onApplyProjectStrategyProposal,
  onCommitCanonCard,
  onUpdateRevisionIssue,
  onUndoRevisionRecord,
  onCreateExportPackage,
  onCreateKnowledgeAnswer,
  onImportKnowledgeDocument,
  onSaveAgentSettings
}: NovelWorkbenchProps) => {
  const activeChapterId = currentChapterId ?? chapterDocument?.chapterId ?? shell.project.currentChapterId
  const activeChapter =
    shell.chapterTree.find((chapter) => chapter.chapterId === activeChapterId) ?? shell.chapterTree[0]

  const [selectedSceneId, setSelectedSceneId] = useState(shell.sceneList[0]?.sceneId)
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false)
  const [isCreateProjectModalOpen, setCreateProjectModalOpen] = useState(false)
  const [isFocusMode, setFocusMode] = useState(false)
  const [isStructurePanelCollapsed, setStructurePanelCollapsed] = useState(false)
  const [isAgentSidebarCollapsed, setAgentSidebarCollapsed] = useState(false)
  const [isWritingInspectorCollapsed, setWritingInspectorCollapsed] = useState(false)
  const [writingInspectorPane, setWritingInspectorPane] = useState<WritingInspectorPane>('state')
  const [createProjectForm, setCreateProjectForm] = useState<CreateProjectFormState>(buildDefaultCreateProjectForm)
  const isAnalysisToolActive = activeSurface === 'feature-center' && activeFeatureTool === 'analysis'
  const analysis = useAnalysisWorkbenchState(shell)
  const canon = useCanonWorkbenchState(shell)
  const knowledge = useKnowledgeWorkbenchState(shell)
  const revision = useRevisionWorkbenchState(shell, feedState.feed)
  const publish = usePublishWorkbenchState(shell, feedState.feed)
  const workspaceSearch = useWorkspaceSearch(shell.workspacePath)
  const agentRuntimeMode = agentSettingsState?.mode ?? 'legacy'
  const agentRuntimeLabel = agentSettingsState ? runtimeProviderLabel[agentSettingsState.resolvedProvider] : '本地规则模式'
  const [renderedChapterId, setRenderedChapterId] = useState(activeChapterId ?? shell.chapterTree[0]?.chapterId)
  const renderedChapter =
    shell.chapterTree.find((chapter) => chapter.chapterId === renderedChapterId) ??
    shell.chapterTree.find((chapter) => chapter.chapterId === activeChapterId) ??
    shell.chapterTree[0]
  const selectedScene = shell.sceneList.find((scene) => scene.sceneId === selectedSceneId) ?? shell.sceneList[0]

  useEffect(() => {
    if (!shell.sceneList.some((scene) => scene.sceneId === selectedSceneId)) {
      setSelectedSceneId(shell.sceneList[0]?.sceneId)
    }
  }, [selectedSceneId, shell.sceneList])

  useEffect(() => {
    setRenderedChapterId(activeChapterId ?? shell.chapterTree[0]?.chapterId)
  }, [activeChapterId, shell.workspacePath])

  useEffect(() => {
    if (!renderedChapterId || !shell.chapterTree.some((chapter) => chapter.chapterId === renderedChapterId)) {
      setRenderedChapterId(activeChapterId ?? shell.chapterTree[0]?.chapterId)
    }
  }, [activeChapterId, renderedChapterId, shell.chapterTree])

  useEffect(() => {
    if (!isCreatingProject) {
      setCreateProjectModalOpen(false)
      setCreateProjectForm(buildDefaultCreateProjectForm())
    }
  }, [isCreatingProject, shell.workspacePath])

  useEffect(() => {
    if (activeSurface !== 'writing' && isFocusMode) {
      setFocusMode(false)
    }
  }, [activeSurface, isFocusMode])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !workspaceSearch.isOpen && isFocusMode) {
        setFocusMode(false)
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [isFocusMode, workspaceSearch.isOpen])

  const chapterStatusSummary = (() => {
    if (isAnalysisToolActive) {
      return `拆书 · ${shell.analysisSamples.length} 个样本`
    }

    if (activeSurface === 'feature-center') {
      return resolveFeatureToolLabel(activeFeatureTool)
    }

    if (activeSurface === 'knowledge') {
      return knowledge.selectedDocumentMetadata
        ? `${knowledge.selectedDocumentMetadata.title} · ${knowledgeBucketLabel[knowledge.selectedDocumentMetadata.bucket]}`
        : `知识工作台 · ${shell.knowledgeSummary.totalDocuments} 份文档`
    }

    if (activeChapter) {
      return `第 ${activeChapter.order} 章 · ${activeChapter.title}`
    }

    return '未选择章节'
  })()
  const statusBarContextLabel =
    activeSurface === 'feature-center' ? '当前功能' : activeSurface === 'knowledge' ? '当前知识页' : '当前章节'
  const visibleQuickActions: QuickActionDto[] =
    isAnalysisToolActive && analysis.selectedSample
      ? [
          {
            id: `analysis-quick-hook-${analysis.selectedSample.sampleId}`,
            label: '拆开篇钩子',
            prompt: `请拆一下样本《${analysis.selectedSample.title}》的开篇钩子和章节承诺。`
          },
          {
            id: `analysis-quick-strategy-${analysis.selectedSample.sampleId}`,
            label: '生成立项启发',
            prompt: `请基于样本《${analysis.selectedSample.title}》为《${shell.project.title}》生成一版立项启发。`
          }
        ]
      : activeSurface === 'knowledge'
        ? [
            {
              id: 'knowledge-quick-gap',
              label: '检查知识缺口',
              prompt: '请基于当前知识工作面，指出最值得补充的事实缺口与冲突页。'
            },
            {
              id: 'knowledge-quick-query',
              label: '继续知识问答',
              prompt: '请围绕当前项目已有知识资产，继续整理最重要的信息差与未决问题。'
            }
          ]
      : shell.quickActions
  const shellClass = [
    'novel-shell',
    activeSurface === 'writing' ? 'novel-shell--writing' : '',
    isFocusMode ? 'novel-shell--focus' : ''
  ]
    .filter(Boolean)
    .join(' ')
  const gridClass = [
    'workspace-grid',
    activeSurface === 'writing' ? 'workspace-grid--writing' : '',
    !isFocusMode && isStructurePanelCollapsed ? 'workspace-grid--structure-collapsed' : '',
    !isFocusMode && activeSurface !== 'writing' && isAgentSidebarCollapsed ? 'workspace-grid--agent-collapsed' : '',
    !isFocusMode && activeSurface === 'writing' && isWritingInspectorCollapsed ? 'workspace-grid--writing-inspector-collapsed' : '',
    isFocusMode ? 'workspace-grid--focus' : ''
  ]
    .filter(Boolean)
    .join(' ')

  const ensurePublishSurface = (): void => {
    if (activeSurface !== 'publish') {
      onSurfaceChange('publish')
    }
  }

  const handleApplyPublishSynopsisDraft = (value: string): void => {
    ensurePublishSurface()
    publish.onApplySynopsisDraft(value)
  }

  const handleApplyPublishNotesDraft = (value: string): void => {
    ensurePublishSurface()
    publish.onApplyNotesDraft(value)
  }

  const handleOpenPublishConfirm = (): void => {
    ensurePublishSurface()
    publish.onOpenConfirm()
  }

  const handleSelectRevisionIssue = (issueId: string, inspectChapter = true): void => {
    revision.onSelectIssue(issueId)

    if (!inspectChapter) {
      return
    }

    const issue = shell.revisionIssues.find((item) => item.issueId === issueId)

    if (issue) {
      onInspectRevisionIssueChapter(issue.chapterId)
    }
  }

  const handleSearchSelect = (item: WorkspaceSearchItemDto): void => {
    workspaceSearch.close()

    if (item.surface === 'home') {
      onSurfaceChange('home')
      return
    }

    if (item.surface === 'writing') {
      if (item.chapterId) {
        onSelectChapter(item.chapterId)
      } else {
        onSurfaceChange('writing')
      }

      if (item.kind === 'scene' && item.entityId) {
        setSelectedSceneId(item.entityId)
      }
      return
    }

    if (item.surface === 'feature-center') {
      if (item.featureTool) {
        onFeatureToolChange(item.featureTool)
      } else {
        onSurfaceChange('feature-center')
      }

      if (item.featureTool === 'analysis' && item.entityId) {
        analysis.onSelectSample(item.entityId)
      }

      return
    }

    if (item.surface === 'analysis') {
      onFeatureToolChange('analysis')
      if (item.entityId) {
        analysis.onSelectSample(item.entityId)
      }
      return
    }

    if (item.surface === 'canon') {
      onSurfaceChange('canon')
      if (item.entityId) {
        canon.onSelectCard(item.entityId)
      }
      return
    }

    if (item.surface === 'knowledge') {
      onSurfaceChange('knowledge')
      if (item.entityId) {
        knowledge.onSelectDocument(item.entityId)
      }
      return
    }

    if (item.surface === 'revision') {
      if (item.entityId) {
        handleSelectRevisionIssue(item.entityId, Boolean(item.chapterId))
      }

      if (item.chapterId && !item.entityId) {
        onInspectRevisionIssueChapter(item.chapterId)
      } else if (!item.chapterId) {
        onSurfaceChange('revision')
      }
      return
    }

    onSurfaceChange('publish')
    if (item.entityId) {
      publish.onSelectPreset(item.entityId)
    }
  }

  return (
    <div className={shellClass}>
      <header className={isFocusMode ? 'topbar topbar--focus' : 'topbar'}>
        <button
          type="button"
          className="brand-lockup"
          onClick={() => setSettingsModalOpen(true)}
          aria-label="打开工作台设置"
          aria-haspopup="dialog"
          aria-expanded={isSettingsModalOpen}
          title="打开工作台设置"
        >
          <img className="brand-mark" src={limeLogoUrl} alt="Lime Novel 标志" />
          <span className="brand-lockup__tooltip" role="tooltip">
            <span className="eyebrow">账户与设置</span>
            <strong>{limeNovelBrand.name}</strong>
            <span>点击打开工作台设置。后续这里会接入登录头像与账号入口。</span>
          </span>
        </button>

        <div className="topbar__tools">
          <button
            type="button"
            className="command-trigger"
            onClick={workspaceSearch.open}
            aria-haspopup="dialog"
            aria-expanded={workspaceSearch.isOpen}
            title="搜索当前项目"
          >
            <span className="command-trigger__label">搜索章节 / 知识 / 设定 / 修订</span>
            <span className="command-trigger__hint">⌘K</span>
          </button>

          {activeSurface === 'writing' ? (
            <button
              type="button"
              className={isFocusMode ? 'ghost-button topbar__toggle topbar__toggle--active' : 'ghost-button topbar__toggle'}
              onClick={() => setFocusMode((value) => !value)}
            >
              {isFocusMode ? '退出专注' : '专注写作'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="workspace-stage">
        <div className={gridClass}>
          <nav className="nav-rail">
            <div className="nav-rail__group">
              {shell.navigation.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-surface={item.id}
                  className={item.id === activeSurface ? 'nav-button nav-button--active' : 'nav-button'}
                  onClick={() => onSurfaceChange(item.id)}
                  aria-label={`${item.label}，${item.description}`}
                  title={`${item.label} · ${item.description}`}
                >
                  <span className="nav-button__glyph" aria-hidden="true">
                    <SurfaceIcon surface={item.id} />
                  </span>
                  <span className="nav-button__tooltip" role="tooltip">
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="nav-rail__footer">
              <button
                type="button"
                data-surface={featureCenterEntry.id}
                className={activeSurface === 'feature-center' ? 'nav-button nav-button--active' : 'nav-button'}
                onClick={() => onSurfaceChange('feature-center')}
                aria-label={`${featureCenterEntry.label}，${featureCenterEntry.description}`}
                title={`${featureCenterEntry.label} · ${featureCenterEntry.description}`}
              >
                <span className="nav-button__glyph" aria-hidden="true">
                  <SurfaceIcon surface={featureCenterEntry.id} />
                </span>
                <span className="nav-button__tooltip" role="tooltip">
                  <strong>{featureCenterEntry.label}</strong>
                  <span>{featureCenterEntry.description}</span>
                </span>
              </button>
            </div>
          </nav>

          {!isFocusMode ? (
            isStructurePanelCollapsed ? (
              <StructurePanelRail
                className={activeSurface === 'writing' ? 'structure-panel-rail--writing' : undefined}
                surface={activeSurface}
                onExpand={() => setStructurePanelCollapsed(false)}
              />
            ) : (
              <aside className={activeSurface === 'writing' ? 'structure-panel structure-panel--writing' : 'structure-panel'}>
                <div className="structure-panel__toolbar">
                  <button
                    type="button"
                    className="ghost-button structure-panel__collapse"
                    onClick={() => setStructurePanelCollapsed(true)}
                    aria-label="折叠左侧导航"
                    title="折叠左侧导航"
                  >
                    <span className="structure-panel__collapse-icon" aria-hidden="true">
                      <CollapseStructureIcon />
                    </span>
                  </button>
                </div>
                {activeSurface === 'home' ? (
                  <HomeStructurePanel
                    shell={shell}
                    activeChapter={activeChapter}
                    onSurfaceChange={onSurfaceChange}
                    onCreateProjectRequest={() => setCreateProjectModalOpen(true)}
                    onSelectChapter={onSelectChapter}
                    onOpenProject={onOpenProject}
                    isCreatingProject={isCreatingProject}
                  />
                ) : null}
                {activeSurface === 'writing' ? (
                  <WritingStructurePanel
                    shell={shell}
                    chapterId={activeChapterId}
                    renderedChapterId={renderedChapter?.chapterId}
                    selectedSceneId={selectedSceneId}
                    onPreviewChapter={setRenderedChapterId}
                    onSelectScene={setSelectedSceneId}
                    onStartTask={onStartTask}
                  />
                ) : null}
                {activeSurface === 'knowledge' ? (
                  <KnowledgeStructurePanel
                    shell={shell}
                    selectedBucket={knowledge.selectedBucket}
                    selectedDocumentPath={knowledge.selectedDocumentPath}
                    visibleDocuments={knowledge.visibleDocuments}
                    onBucketChange={knowledge.onBucketChange}
                    onSelectDocument={knowledge.onSelectDocument}
                  />
                ) : null}
                {activeSurface === 'feature-center' && !activeFeatureTool ? (
                  <FeatureCenterStructurePanel
                    shell={shell}
                    activeFeatureTool={activeFeatureTool}
                    onFeatureToolChange={onFeatureToolChange}
                  />
                ) : null}
                {isAnalysisToolActive ? (
                  <AnalysisStructurePanel
                    overview={shell.analysisOverview}
                    samples={shell.analysisSamples}
                    selectedSampleId={analysis.selectedSampleId}
                    onSelectSample={analysis.onSelectSample}
                    onCreateSampleRequest={onImportAnalysisSample}
                    isImporting={isImportingAnalysisSample}
                  />
                ) : null}
                {activeSurface === 'canon' ? (
                  <CanonStructurePanel
                    shell={shell}
                    selectedCategory={canon.selectedCategory}
                    onCategoryChange={canon.onCategoryChange}
                    onStartTask={onStartTask}
                  />
                ) : null}
                {activeSurface === 'revision' ? (
                  <RevisionStructurePanel
                    issues={shell.revisionIssues}
                    selectedIssueId={revision.selectedIssueId}
                    onSelectIssue={handleSelectRevisionIssue}
                  />
                ) : null}
                {activeSurface === 'publish' ? (
                  <PublishStructurePanel
                    shell={shell}
                    selectedPresetId={publish.selectedPresetId}
                    onSelectPreset={publish.onSelectPreset}
                  />
                ) : null}
              </aside>
            )
          ) : null}

          <main className={activeSurface === 'writing' ? 'main-surface main-surface--writing' : 'main-surface'}>
            {activeSurface === 'home' ? (
              <HomeSurface
                shell={shell}
                activeChapter={activeChapter}
                feedState={feedState}
                onSurfaceChange={onSurfaceChange}
                onCreateProjectRequest={() => setCreateProjectModalOpen(true)}
                onSelectChapter={onSelectChapter}
                onStartTask={onStartTask}
              />
            ) : null}
            {activeSurface === 'writing' ? (
              <WritingSurface
                shell={shell}
                chapterDocument={chapterDocument}
                renderedChapter={renderedChapter}
                selectedScene={selectedScene}
                feedState={feedState}
                activityLabel={activityLabel}
                runtimeLabel={agentRuntimeLabel}
                onSelectChapter={onSelectChapter}
                onStartTask={onStartTask}
                onApplyProposal={onApplyProposal}
                onRejectProposal={onRejectProposal}
                onSaveChapter={onSaveChapter}
              />
            ) : null}
            {activeSurface === 'knowledge' ? (
              <KnowledgeSurface
                shell={shell}
                visibleDocuments={knowledge.visibleDocuments}
                selectedBucket={knowledge.selectedBucket}
                onBucketChange={knowledge.onBucketChange}
                selectedDocumentPath={knowledge.selectedDocumentPath}
                selectedDocumentMetadata={knowledge.selectedDocumentMetadata}
                selectedDocument={knowledge.selectedDocument}
                isDocumentLoading={knowledge.isKnowledgeDocumentLoading}
                documentError={knowledge.knowledgeDocumentError}
                onSelectDocument={knowledge.onSelectDocument}
                onStartTask={onStartTask}
                onCreateKnowledgeAnswer={onCreateKnowledgeAnswer}
                onImportKnowledgeDocument={onImportKnowledgeDocument}
                isGeneratingAnswer={isGeneratingKnowledgeAnswer}
                isImportingDocument={isImportingKnowledgeDocument}
              />
            ) : null}
            {activeSurface === 'feature-center' && !activeFeatureTool ? (
              <FeatureCenterHomeSurface shell={shell} onFeatureToolChange={onFeatureToolChange} />
            ) : null}
            {isAnalysisToolActive ? (
              <AnalysisSurface
                shell={shell}
                overview={shell.analysisOverview}
                sample={analysis.selectedSample}
                isApplyingStrategy={isApplyingAnalysisStrategy}
                onCreateSampleRequest={onImportAnalysisSample}
                onApplyProjectStrategyProposal={(sampleId) => onApplyProjectStrategyProposal({ sampleId })}
                onStartTask={onStartTask}
              />
            ) : null}
            {activeSurface === 'canon' ? (
              <CanonSurface
                shell={shell}
                canon={canon}
                onStartTask={onStartTask}
                onCommitCanonCard={onCommitCanonCard}
              />
            ) : null}
            {activeSurface === 'revision' ? (
              <RevisionSurface
                issue={revision.selectedIssue}
                revisionRecords={revision.visibleRevisionRecords}
                proposal={revision.selectedProposal}
                chapterDocument={chapterDocument}
                onStartTask={onStartTask}
                onApplyProposal={onApplyProposal}
                onRejectProposal={onRejectProposal}
                onUpdateIssue={onUpdateRevisionIssue}
                onUndoRevisionRecord={onUndoRevisionRecord}
              />
            ) : null}
            {activeSurface === 'publish' ? (
              <PublishSurface
                shell={shell}
                publish={publish}
                isExporting={isCreatingExportPackage}
                onStartTask={onStartTask}
                onCreateExportPackage={onCreateExportPackage}
              />
            ) : null}
          </main>

          {!isFocusMode && activeSurface === 'writing' ? (
            isWritingInspectorCollapsed ? (
              <WritingInspectorRail
                activePane={writingInspectorPane}
                onPaneChange={setWritingInspectorPane}
                onExpand={() => setWritingInspectorCollapsed(false)}
              />
            ) : (
              <AgentWritingInspector
                shell={shell}
                chapterDocument={chapterDocument}
                renderedChapter={renderedChapter}
                selectedScene={selectedScene}
                feedState={feedState}
                runtimeLabel={agentRuntimeLabel}
                activePane={writingInspectorPane}
                onPaneChange={setWritingInspectorPane}
                onCollapse={() => setWritingInspectorCollapsed(true)}
                onStartTask={onStartTask}
                onApplyProposal={onApplyProposal}
                onRejectProposal={onRejectProposal}
              />
            )
          ) : null}

          {!isFocusMode && activeSurface !== 'writing' ? (
            isAgentSidebarCollapsed ? (
              <AgentSidebarRail
                mode={sidebarMode}
                onModeChange={onSidebarModeChange}
                onExpand={() => setAgentSidebarCollapsed(false)}
              />
            ) : (
              <AgentSidebar
                mode={sidebarMode}
                onModeChange={onSidebarModeChange}
                header={feedState.header}
                tasks={feedState.tasks}
                feed={feedState.feed}
                diagnosticsByTaskId={feedState.diagnosticsByTaskId}
                quickActions={visibleQuickActions}
                runtimeMode={agentRuntimeMode}
                runtimeLabel={agentRuntimeLabel}
                onStartTask={onStartTask}
                onOpenSettings={() => setSettingsModalOpen(true)}
                onApplyProposal={onApplyProposal}
                onRejectProposal={onRejectProposal}
                onApplyPublishSynopsisDraft={handleApplyPublishSynopsisDraft}
                onApplyPublishNotesDraft={handleApplyPublishNotesDraft}
                onOpenPublishConfirm={handleOpenPublishConfirm}
                onCollapse={() => setAgentSidebarCollapsed(true)}
              />
            )
          ) : null}
        </div>
      </div>

      <footer className={isFocusMode ? 'status-bar status-bar--hidden' : 'status-bar'}>
        <div className="status-bar__item">
          <span className="status-bar__label">{statusBarContextLabel}</span>
          <strong>{chapterStatusSummary}</strong>
        </div>
        <div className="status-bar__item status-bar__item--accent">
          <span className="status-bar__label">工作台状态</span>
          <strong>{activityLabel}</strong>
        </div>
      </footer>

      {isCreateProjectModalOpen ? (
        <CreateProjectModal
          form={createProjectForm}
          isSubmitting={isCreatingProject}
          onChange={setCreateProjectForm}
          onClose={() => {
            setCreateProjectModalOpen(false)
            setCreateProjectForm(buildDefaultCreateProjectForm())
          }}
          onSubmit={() => {
            if (!createProjectForm.title.trim()) {
              return
            }

            onCreateProject({
              title: createProjectForm.title.trim(),
              genre: createProjectForm.genre.trim(),
              premise: createProjectForm.premise.trim(),
              template: createProjectForm.template
            })
          }}
        />
      ) : null}

      {isSettingsModalOpen ? (
        <SettingsModal
          shell={shell}
          activityLabel={activityLabel}
          agentSettingsState={agentSettingsState}
          agentSettingsError={agentSettingsError}
          isLoadingSettings={isAgentSettingsLoading}
          isSavingSettings={isSavingAgentSettings}
          agentSettingsTestResult={agentSettingsTestResult}
          agentSettingsTestError={agentSettingsTestError}
          isTestingAgentSettings={isTestingAgentSettings}
          onSaveAgentSettings={onSaveAgentSettings}
          onTestAgentSettings={onTestAgentSettings}
          onClose={() => setSettingsModalOpen(false)}
          onOpenProject={onOpenProject}
          onGoPublish={() => onSurfaceChange('publish')}
        />
      ) : null}

      {workspaceSearch.isOpen ? (
        <WorkspaceSearchModal
          query={workspaceSearch.query}
          results={workspaceSearch.results}
          isSearching={workspaceSearch.isSearching}
          error={workspaceSearch.error}
          onQueryChange={workspaceSearch.setQuery}
          onClose={workspaceSearch.close}
          onSelect={handleSearchSelect}
          resolveSurfaceLabel={resolveWorkspaceSearchSurfaceLabel}
        />
      ) : null}
    </div>
  )
}
