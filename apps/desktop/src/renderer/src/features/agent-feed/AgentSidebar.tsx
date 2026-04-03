import { useState } from 'react'
import type {
  AgentFeedItemDto,
  AgentTaskDiagnosticsDto,
  AgentTaskDto,
  QuickActionDto
} from '@lime-novel/application'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'

export type AgentSidebarMode = 'agent' | 'suggestions' | 'dialogue'

type AgentSidebarProps = {
  className?: string
  mode: AgentSidebarMode
  onModeChange: (mode: AgentSidebarMode) => void
  header: {
    currentAgent: string
    activeSubAgent?: string
    memorySources: string[]
    riskLevel: 'low' | 'medium' | 'high'
    surface: NovelSurfaceId
  }
  tasks: AgentTaskDto[]
  feed: AgentFeedItemDto[]
  diagnosticsByTaskId: Record<string, AgentTaskDiagnosticsDto>
  quickActions: QuickActionDto[]
  onStartTask: (intent: string, surface?: NovelSurfaceId) => void
  onApplyProposal: (proposalId: string) => void
  onRejectProposal: (proposalId: string) => void
  onApplyPublishSynopsisDraft: (value: string) => void
  onApplyPublishNotesDraft: (value: string) => void
  onOpenPublishConfirm: () => void
}

const statusLabel: Record<AgentTaskDto['status'], string> = {
  queued: '排队中',
  running: '进行中',
  waiting_approval: '等待确认',
  completed: '已完成',
  failed: '失败'
}

const severityLabel: Record<'low' | 'medium' | 'high', string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险'
}

const feedKindLabel: Record<AgentFeedItemDto['kind'], string> = {
  status: '说明消息',
  evidence: '证据消息',
  proposal: '提议消息',
  issue: '问题消息',
  approval: '审批消息'
}

const surfaceLabel: Record<NovelSurfaceId, string> = {
  home: '首页',
  writing: '写作',
  knowledge: '知识库',
  'feature-center': '功能中心',
  analysis: '拆书',
  canon: '设定',
  revision: '修订',
  publish: '发布'
}

const approvalStatusLabel: Record<NonNullable<AgentFeedItemDto['approvalStatus']>, string> = {
  pending: '待确认',
  accepted: '已接受',
  rejected: '已拒绝'
}

const toolEventStatusLabel: Record<
  NonNullable<AgentTaskDiagnosticsDto['toolEvents']>[number]['status'],
  string
> = {
  requested: '已请求',
  rejected: '被拒绝',
  started: '执行中',
  completed: '已完成',
  failed: '失败'
}

const parseCreatedAt = (value: string): number => {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const formatDiagnosticsTime = (value: string): string => {
  const timestamp = Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return '刚刚更新'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

const formatTokenCount = (value: number): string => new Intl.NumberFormat('zh-CN').format(value)

const dedupeTasks = (tasks: AgentTaskDto[]): AgentTaskDto[] => {
  const seen = new Set<string>()

  return tasks.filter((task) => {
    const key = `${task.surface}:${task.title}:${task.summary}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

const dedupeFeed = (items: AgentFeedItemDto[]): AgentFeedItemDto[] => {
  const seen = new Set<string>()

  return items.filter((item) => {
    const key = `${item.kind}:${item.title}:${item.body}:${item.supportingLabel ?? ''}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

const FeedCard = ({
  item,
  onStartTask,
  onApplyProposal,
  onRejectProposal,
  onApplyPublishSynopsisDraft,
  onApplyPublishNotesDraft,
  onOpenPublishConfirm
}: {
  item: AgentFeedItemDto
  onStartTask: (intent: string, surface?: NovelSurfaceId) => void
  onApplyProposal: (proposalId: string) => void
  onRejectProposal: (proposalId: string) => void
  onApplyPublishSynopsisDraft: (value: string) => void
  onApplyPublishNotesDraft: (value: string) => void
  onOpenPublishConfirm: () => void
}) => (
  <article className={`feed-card feed-card--${item.kind}`}>
    <div className="feed-card__meta">
      <span className="feed-card__kind">{feedKindLabel[item.kind]}</span>
      <div className="feed-card__meta-pills">
        {item.severity ? <span className={`feed-card__severity feed-card__severity--${item.severity}`}>{severityLabel[item.severity]}</span> : null}
        {item.approvalStatus ? (
          <span className={`feed-card__approval feed-card__approval--${item.approvalStatus}`}>
            {approvalStatusLabel[item.approvalStatus]}
          </span>
        ) : null}
      </div>
    </div>
    <h4>{item.title}</h4>
    <p>{item.body}</p>
    {item.supportingLabel ? <div className="feed-card__supporting">{item.supportingLabel}</div> : null}
    {item.diffPreview ? (
      <div className="diff-card">
        <div>
          <span>原文</span>
          <p>{item.diffPreview.before}</p>
        </div>
        <div>
          <span>提议</span>
          <p>{item.diffPreview.after}</p>
        </div>
      </div>
    ) : null}
    {item.actions?.length ? (
      <div className="feed-card__actions">
        {item.actions.map((action) =>
          action.kind === 'prompt' ? (
            <button key={action.id} className="ghost-button" onClick={() => onStartTask(action.prompt, action.surface)}>
              {action.label}
            </button>
          ) : action.kind === 'reject-proposal' ? (
            <button key={action.id} className="ghost-button" onClick={() => onRejectProposal(action.proposalId)}>
              {action.label}
            </button>
          ) : action.kind === 'apply-publish-synopsis' ? (
            <button key={action.id} className="primary-button" onClick={() => onApplyPublishSynopsisDraft(action.value)}>
              {action.label}
            </button>
          ) : action.kind === 'apply-publish-notes' ? (
            <button key={action.id} className="primary-button" onClick={() => onApplyPublishNotesDraft(action.value)}>
              {action.label}
            </button>
          ) : action.kind === 'open-publish-confirm' ? (
            <button key={action.id} className="primary-button" onClick={onOpenPublishConfirm}>
              {action.label}
            </button>
          ) : (
            <button
              key={action.id}
              className="primary-button"
              onClick={() => onApplyProposal(action.proposalId)}
            >
              {action.label}
            </button>
          )
        )}
      </div>
    ) : null}
  </article>
)

export const AgentSidebar = ({
  className,
  mode,
  onModeChange,
  header,
  tasks,
  feed,
  diagnosticsByTaskId,
  quickActions,
  onStartTask,
  onApplyProposal,
  onRejectProposal,
  onApplyPublishSynopsisDraft,
  onApplyPublishNotesDraft,
  onOpenPublishConfirm
}: AgentSidebarProps) => {
  const [draft, setDraft] = useState('')

  const visibleTasks = dedupeTasks(tasks).slice(0, 2)
  const suggestionItems = dedupeFeed([
    ...feed.filter((item) => item.kind === 'proposal' || item.kind === 'issue' || item.kind === 'evidence'),
    ...feed.filter((item) => item.kind === 'status'),
    ...feed.filter((item) => item.kind === 'approval')
  ]).slice(0, 4)
  const dialogueItems = [...feed].sort((left, right) => parseCreatedAt(left.createdAt) - parseCreatedAt(right.createdAt))
  const visibleQuickActions = quickActions.slice(0, 2)
  const diagnosticsTask =
    visibleTasks.find((task) => diagnosticsByTaskId[task.taskId] != null) ??
    tasks.find((task) => diagnosticsByTaskId[task.taskId] != null)
  const diagnostics = diagnosticsTask ? diagnosticsByTaskId[diagnosticsTask.taskId] : undefined
  const recentToolEvents = diagnostics ? [...diagnostics.toolEvents].slice(-6).reverse() : []
  const completedToolCount = diagnostics?.toolEvents.filter((event) => event.status === 'completed').length ?? 0
  const failedToolCount = diagnostics?.toolEvents.filter((event) => event.status === 'failed').length ?? 0
  const totalTokenCount = diagnostics
    ? diagnostics.stats.usage.inputTokens + diagnostics.stats.usage.outputTokens
    : 0

  const handleSubmit = (): void => {
    if (!draft.trim()) {
      return
    }

    onStartTask(draft.trim())
    setDraft('')
  }

  return (
    <aside className={className ? `agent-sidebar ${className}` : 'agent-sidebar'}>
      <div className="agent-sidebar__tabs">
        <button
          className={mode === 'agent' ? 'tab-button tab-button--active' : 'tab-button'}
          onClick={() => onModeChange('agent')}
        >
          代理
        </button>
        <button
          className={mode === 'suggestions' ? 'tab-button tab-button--active' : 'tab-button'}
          onClick={() => onModeChange('suggestions')}
        >
          建议
        </button>
        <button
          className={mode === 'dialogue' ? 'tab-button tab-button--active' : 'tab-button'}
          onClick={() => onModeChange('dialogue')}
        >
          对话
        </button>
      </div>

      <section className="agent-sidebar__content">
        {mode === 'agent' ? (
          <div className="agent-overview">
            <article className="agent-summary-card">
              <div className="agent-summary-card__meta">
                <span className="eyebrow">当前主代理</span>
                <div className={`risk-pill risk-pill--${header.riskLevel}`}>{severityLabel[header.riskLevel]}</div>
              </div>
              <h3>{header.currentAgent}</h3>
              <p>{header.activeSubAgent ? `活跃子代理：${header.activeSubAgent}` : `当前工作面：${surfaceLabel[header.surface]}`}</p>
              <div className="agent-summary-card__chips">
                {header.memorySources.map((source) => (
                  <span key={source} className="memory-chip">
                    {source}
                  </span>
                ))}
              </div>
            </article>

            <div className="agent-sidebar__section-heading">
              <span className="eyebrow">后台任务</span>
            </div>
            {visibleTasks.length > 0 ? (
              visibleTasks.map((task) => (
                <div key={task.taskId} className="task-row">
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.summary}</p>
                  </div>
                  <span className={`task-status task-status--${task.status}`}>{statusLabel[task.status]}</span>
                </div>
              ))
            ) : (
              <div className="agent-empty-state">
                <strong>当前没有挂起中的后台任务</strong>
                <p>代理会在这里回报新的设定抽取、修订检查和发布预检进度。</p>
              </div>
            )}

            <div className="agent-sidebar__section-heading">
              <span className="eyebrow">运行轨迹</span>
            </div>
            {diagnostics && diagnosticsTask ? (
              <article className="agent-runtime-card">
                <div className="agent-runtime-card__meta">
                  <div>
                    <strong>{diagnosticsTask.title}</strong>
                    <p>{diagnostics.failure ? '本轮运行出现失败收口。' : '本轮运行已记录消息与工具轨迹。'}</p>
                  </div>
                  <span className="agent-runtime-card__time">{formatDiagnosticsTime(diagnostics.updatedAt)}</span>
                </div>
                <div className="agent-summary-card__chips">
                  <span className="memory-chip">回合 {diagnostics.stats.turnCount}</span>
                  <span className="memory-chip">消息 {diagnostics.trace.length}</span>
                  <span className="memory-chip">工具 {diagnostics.toolEvents.length}</span>
                  <span className="memory-chip">完成 {completedToolCount}</span>
                  <span className="memory-chip">Token {formatTokenCount(totalTokenCount)}</span>
                  {diagnostics.stats.stopReason ? <span className="memory-chip">停止 {diagnostics.stats.stopReason}</span> : null}
                  {failedToolCount > 0 ? <span className="memory-chip">失败 {failedToolCount}</span> : null}
                </div>
                {diagnostics.failure ? (
                  <div className="agent-runtime-card__failure">
                    <strong>{diagnostics.failure.subtype}</strong>
                    <p>{diagnostics.failure.detail}</p>
                  </div>
                ) : null}
                {recentToolEvents.length > 0 ? (
                  <div className="agent-tool-events">
                    {recentToolEvents.map((event) => (
                      <div key={`${event.toolCallId}:${event.status}:${event.turnIndex}`} className="agent-tool-event">
                        <div className="agent-tool-event__copy">
                          <strong>{event.toolName}</strong>
                          <p>
                            第 {event.turnIndex} 轮
                            {event.progressLabel ? ` · ${event.progressLabel}` : ''}
                          </p>
                          {event.error ? <p className="agent-tool-event__error">{event.error}</p> : null}
                        </div>
                        <span className={`task-status agent-tool-event__status task-status--${event.status === 'completed' ? 'completed' : event.status === 'failed' || event.status === 'rejected' ? 'failed' : event.status === 'started' ? 'running' : 'queued'}`}>
                          {toolEventStatusLabel[event.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="agent-empty-state">
                    <strong>当前还没有可显示的工具事件</strong>
                    <p>下一次工具执行后，这里会展示请求、开始、完成和失败轨迹。</p>
                  </div>
                )}
              </article>
            ) : (
              <div className="agent-empty-state">
                <strong>当前没有运行轨迹</strong>
                <p>只有新 runtime 路径的任务才会在这里显示工具调用轨迹。</p>
              </div>
            )}
          </div>
        ) : (
          (mode === 'suggestions' ? suggestionItems : dialogueItems).map((item) => (
            <FeedCard
              key={item.itemId}
              item={item}
              onStartTask={onStartTask}
              onApplyProposal={onApplyProposal}
              onRejectProposal={onRejectProposal}
              onApplyPublishSynopsisDraft={onApplyPublishSynopsisDraft}
              onApplyPublishNotesDraft={onApplyPublishNotesDraft}
              onOpenPublishConfirm={onOpenPublishConfirm}
            />
          ))
        )}
      </section>

      {mode === 'suggestions' ? (
        <section className="agent-sidebar__footer">
          <div className="agent-sidebar__section-heading">
            <span className="eyebrow">快捷动作</span>
          </div>
          <div className="quick-actions">
            {visibleQuickActions.map((action) => (
              <button key={action.id} className="quick-action" onClick={() => onStartTask(action.prompt)}>
                /{action.label}
              </button>
            ))}
          </div>
        </section>
      ) : mode === 'dialogue' ? (
        <section className="agent-sidebar__composer">
          <div className="quick-actions quick-actions--dialogue">
            {visibleQuickActions.map((action) => (
              <button key={action.id} className="quick-action" onClick={() => onStartTask(action.prompt)}>
                /{action.label}
              </button>
            ))}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="例如：补一版更克制的身体反应，并限制在 120 字内。"
          />
          <button className="primary-button" onClick={handleSubmit}>
            提交给当前代理
          </button>
        </section>
      ) : null}
    </aside>
  )
}
