import { useState } from 'react'
import type { AgentFeedItemDto, AgentTaskDto, QuickActionDto } from '@lime-novel/application'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'

type AgentSidebarProps = {
  mode: 'suggestions' | 'dialogue'
  onModeChange: (mode: 'suggestions' | 'dialogue') => void
  header: {
    currentAgent: string
    activeSubAgent?: string
    memorySources: string[]
    riskLevel: 'low' | 'medium' | 'high'
    surface: NovelSurfaceId
  }
  tasks: AgentTaskDto[]
  feed: AgentFeedItemDto[]
  quickActions: QuickActionDto[]
  onStartTask: (intent: string) => void
  onApplyProposal: (proposalId: string) => void
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
  canon: '设定',
  revision: '修订',
  publish: '发布'
}

const FeedCard = ({
  item,
  onStartTask,
  onApplyProposal
}: {
  item: AgentFeedItemDto
  onStartTask: (intent: string) => void
  onApplyProposal: (proposalId: string) => void
}) => (
  <article className={`feed-card feed-card--${item.kind}`}>
    <div className="feed-card__meta">
      <span className="feed-card__kind">{feedKindLabel[item.kind]}</span>
      {item.severity ? <span className={`feed-card__severity feed-card__severity--${item.severity}`}>{severityLabel[item.severity]}</span> : null}
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
            <button key={action.id} className="ghost-button" onClick={() => onStartTask(action.prompt)}>
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
  mode,
  onModeChange,
  header,
  tasks,
  feed,
  quickActions,
  onStartTask,
  onApplyProposal
}: AgentSidebarProps) => {
  const [draft, setDraft] = useState('')

  const suggestionItems = [
    ...feed.filter((item) => item.kind === 'proposal' || item.kind === 'issue' || item.kind === 'evidence'),
    ...feed.filter((item) => item.kind === 'status'),
    ...feed.filter((item) => item.kind === 'approval')
  ].slice(0, 6)

  const handleSubmit = (): void => {
    if (!draft.trim()) {
      return
    }

    onStartTask(draft.trim())
    setDraft('')
  }

  return (
    <aside className="agent-sidebar">
      <section className="agent-sidebar__header">
        <div>
          <span className="eyebrow">当前主代理</span>
          <h2>{header.currentAgent}</h2>
          <p>{header.activeSubAgent ? `活跃子代理：${header.activeSubAgent}` : `当前工作面：${surfaceLabel[header.surface]}`}</p>
        </div>
        <div className={`risk-pill risk-pill--${header.riskLevel}`}>{severityLabel[header.riskLevel]}</div>
      </section>

      <section className="agent-sidebar__memory">
        {header.memorySources.map((source) => (
          <span key={source} className="memory-chip">
            {source}
          </span>
        ))}
      </section>

      <section className="agent-sidebar__tasks">
        <div className="agent-sidebar__section-heading">
          <span className="eyebrow">后台任务</span>
        </div>
        {tasks.slice(0, 3).map((task) => (
          <div key={task.taskId} className="task-row">
            <div>
              <strong>{task.title}</strong>
              <p>{task.summary}</p>
            </div>
            <span className={`task-status task-status--${task.status}`}>{statusLabel[task.status]}</span>
          </div>
        ))}
      </section>

      <div className="agent-sidebar__tabs">
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
        {(mode === 'suggestions' ? suggestionItems : feed).map((item) => (
          <FeedCard key={item.itemId} item={item} onStartTask={onStartTask} onApplyProposal={onApplyProposal} />
        ))}
      </section>

      {mode === 'suggestions' ? (
        <section className="agent-sidebar__footer">
          <div className="agent-sidebar__section-heading">
            <span className="eyebrow">建议动作</span>
          </div>
          <div className="quick-actions">
            {quickActions.map((action) => (
              <button key={action.id} className="quick-action" onClick={() => onStartTask(action.prompt)}>
                /{action.label}
              </button>
            ))}
          </div>
          <button className="ghost-button" onClick={() => onModeChange('dialogue')}>
            切到对话继续追问
          </button>
        </section>
      ) : (
        <section className="agent-sidebar__composer">
          <div className="quick-actions quick-actions--dialogue">
            {quickActions.map((action) => (
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
      )}
    </aside>
  )
}
