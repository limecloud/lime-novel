import type {
  AgentFeedItemDto,
  ChapterDocumentDto,
  RevisionIssueDto,
  RevisionRecordDto
} from '@lime-novel/application'
import { excerptParagraphs, formatDateTime, summarizePath } from '../workbench/workbench-format'
import {
  buildIssueEvidence,
  buildRevisionPlans,
  issueSeverityLabel,
  issueSeverityTone
} from './revision-model'

type RevisionSurfaceProps = {
  issue?: RevisionIssueDto
  revisionRecords: RevisionRecordDto[]
  proposal?: AgentFeedItemDto
  chapterDocument?: ChapterDocumentDto
  onStartTask: (intent: string) => void
  onApplyProposal: (proposalId: string) => void
  onRejectProposal: (proposalId: string) => void
  onUpdateIssue: (issueId: string, status: 'open' | 'deferred' | 'resolved') => void
  onUndoRevisionRecord: (recordId: string) => void
}

export const RevisionSurface = ({
  issue,
  revisionRecords,
  proposal,
  chapterDocument,
  onStartTask,
  onApplyProposal,
  onRejectProposal,
  onUpdateIssue,
  onUndoRevisionRecord
}: RevisionSurfaceProps) => {
  const paragraphs = excerptParagraphs(chapterDocument?.content)
  const evidence = issue ? buildIssueEvidence(issue) : []
  const plans = issue ? buildRevisionPlans(issue) : []
  const pendingProposal = proposal?.approvalStatus === 'pending' ? proposal : undefined

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--revision">
        <div className="surface-hero__meta-bar">
          <span>问题定位：{issue ? `第 ${issue.chapterId.replace('chapter-', '')} 章` : '等待选择问题'}</span>
          <span>类型：人物 / 节奏 / POV / 语言</span>
          <span>来源：自动诊断 + 证据回溯</span>
          <span>记录：{revisionRecords.length} 条</span>
        </div>
        <div className="surface-hero__main">
          <span className="eyebrow">问题处理流</span>
          <h1>{issue?.title ?? '选择一个修订问题'}</h1>
          <p>{issue?.summary ?? '每个问题都必须能定位、应用、延后、忽略，并保留证据来源。'}</p>
        </div>
      </section>

      <div className="surface-grid surface-grid--two">
        <article className="surface-card surface-card--excerpt">
          <div className="surface-card__header">
            <span className="eyebrow">问题命中片段</span>
            {issue ? (
              <span className={`severity-badge severity-badge--${issueSeverityTone[issue.severity]}`}>
                {issueSeverityLabel[issue.severity]}
              </span>
            ) : null}
          </div>
          <div className="serif-snippets">
            {paragraphs.slice(0, 2).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="callout callout--issue">
            {issue?.summary ?? '选择左侧问题队列中的一项后，这里会定位原文并高亮影响范围。'}
          </div>
          <div className="serif-snippets">
            {paragraphs.slice(2, 4).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="surface-card__header">
            <span className="eyebrow">证据与方案</span>
            <button className="inline-link" onClick={() => onStartTask(`请解释为什么“${issue?.title ?? '当前问题'}”应优先处理。`)}>
              查看推理链
            </button>
          </div>
          <div className="stacked-notes">
            {evidence.map((item) => (
              <div key={item} className="stacked-note">
                <p>{item}</p>
              </div>
            ))}
          </div>
          <div className="plan-list">
            {plans.map((plan) => (
              <div key={plan} className="plan-list__item">
                <strong>{plan}</strong>
              </div>
            ))}
          </div>
          {pendingProposal ? (
            <div className="stacked-note">
              <strong>{pendingProposal.title}</strong>
              <p>{pendingProposal.body}</p>
            </div>
          ) : (
            <div className="callout callout--issue">
              当前还没有可直接应用的修订方案。你可以先生成一版最小修订，再决定是否接受。
            </div>
          )}
          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => {
                if (pendingProposal?.proposalId) {
                  onApplyProposal(pendingProposal.proposalId)
                  return
                }

                if (!issue) {
                  onStartTask('请针对当前问题生成最小修订方案。')
                  return
                }

                onStartTask(`请针对“${issue.title}”生成最小修订方案，并保留证据。`)
              }}
            >
              {pendingProposal ? '应用方案 A' : '生成方案 A'}
            </button>
            <button
              className="ghost-button"
              onClick={() => onStartTask(`请针对“${issue?.title ?? '当前问题'}”再来一版更克制的方案。`)}
            >
              再来一版
            </button>
            {pendingProposal?.proposalId ? (
              <button
                className="ghost-button"
                onClick={() => pendingProposal.proposalId && onRejectProposal(pendingProposal.proposalId)}
              >
                拒绝当前提议
              </button>
            ) : null}
            <button
              className="ghost-button"
              onClick={() => issue && onUpdateIssue(issue.issueId, issue.status === 'deferred' ? 'open' : 'deferred')}
            >
              {issue?.status === 'deferred' ? '重新打开' : '稍后处理'}
            </button>
          </div>
        </article>
      </div>

      <article className="surface-card">
        <div className="surface-card__header">
          <div>
            <span className="eyebrow">修订记录</span>
            <h3>最近应用与撤销</h3>
          </div>
          <span className="status-chip">{revisionRecords.length} 条记录</span>
        </div>

        {revisionRecords.length > 0 ? (
          <div className="revision-record-list">
            {revisionRecords.map((record) => (
              <div key={record.recordId} className="revision-record-item">
                <div className="revision-record-item__header">
                  <div>
                    <strong>{record.title}</strong>
                    <span>
                      {record.chapterTitle} · {formatDateTime(record.createdAt)}
                    </span>
                  </div>
                  <div className="revision-record-item__actions">
                    <span className={record.status === 'undone' ? 'status-chip status-chip--muted' : 'status-chip'}>
                      {record.status === 'undone' ? '已撤销' : '已应用'}
                    </span>
                    <button
                      className="ghost-button"
                      disabled={!record.canUndo}
                      onClick={() => onUndoRevisionRecord(record.recordId)}
                    >
                      撤销这次修订
                    </button>
                  </div>
                </div>

                <p>{record.summary}</p>

                <div className="revision-record-item__diff">
                  <div className="revision-record-item__panel">
                    <span>应用前</span>
                    <p>{record.beforePreview}</p>
                  </div>
                  <div className="revision-record-item__panel">
                    <span>应用后</span>
                    <p>{record.afterPreview}</p>
                  </div>
                </div>

                <div className="revision-record-item__footer">
                  <span>{summarizePath(record.snapshotPath)}</span>
                  {record.status === 'undone' && record.undoneAt ? (
                    <span>撤销于 {formatDateTime(record.undoneAt)}</span>
                  ) : record.canUndo ? (
                    <span>当前正文仍与这次应用保持一致，可直接撤销。</span>
                  ) : (
                    <span>当前正文已经继续编辑，需先手动比较差异后再撤销。</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>还没有修订记录</strong>
            <span>当你接受修订代理的方案后，这里会保留可追溯、可撤销的项目级记录。</span>
          </div>
        )}
      </article>
    </div>
  )
}
