import type { AnalysisOverviewDto, AnalysisSampleDto, WorkspaceShellDto } from '@lime-novel/application'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'
import { formatDateTime } from '../workbench/workbench-format'
import { analysisScoreLabel } from './analysis-model'

type AnalysisSurfaceProps = {
  shell: WorkspaceShellDto
  overview: AnalysisOverviewDto
  sample?: AnalysisSampleDto
  isApplyingStrategy: boolean
  onCreateSampleRequest: () => void
  onApplyProjectStrategyProposal: (sampleId: string) => void
  onStartTask: (intent: string, surface?: NovelSurfaceId) => void
}

export const AnalysisSurface = ({
  shell,
  overview,
  sample,
  isApplyingStrategy,
  onCreateSampleRequest,
  onApplyProjectStrategyProposal,
  onStartTask
}: AnalysisSurfaceProps) => (
  <div className="surface-stack">
    <section className="surface-hero surface-hero--analysis">
      <div className="surface-hero__main">
        <span className="eyebrow">写前拆书建模</span>
        <h1>爆款样本、读者信号与项目启发</h1>
        <p>先把爆款样本拆成钩子、人物、节奏和评论信号，再决定哪些结论值得回写到当前项目。</p>
        <div className="hero-actions">
          <button className="primary-button" onClick={onCreateSampleRequest}>
            导入 TXT / Markdown
          </button>
          {sample ? (
            <button
              className="ghost-button"
              onClick={() =>
                onStartTask(
                  `请基于样本《${sample.title}》为《${shell.project.title}》生成一版立项启发，聚焦卖点、人物吸引点和开篇钩子。`,
                  'analysis'
                )
              }
            >
              让拆书代理补一版启发
            </button>
          ) : null}
        </div>
      </div>

      <div className="hero-metrics analysis-hero-metrics">
        {Object.entries(overview.averageScores).map(([key, value]) => (
          <div key={key} className="hero-metric">
            <span>{analysisScoreLabel[key as keyof AnalysisOverviewDto['averageScores']]}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>

    {sample ? (
      <>
        <div className="surface-grid surface-grid--two-large">
          <article className="surface-card surface-card--focus">
            <div className="surface-card__header">
              <div>
                <span className="eyebrow">样本概览</span>
                <h2>{sample.title}</h2>
              </div>
              <span className="status-pill status-pill--muted">{sample.sourceLabel}</span>
            </div>
            <div className="detail-list">
              <div className="detail-list__item">
                <strong>作者 / 来源</strong>
                <span>{sample.author} · {formatDateTime(sample.importedAt)}</span>
              </div>
              <div className="detail-list__item">
                <strong>题材标签</strong>
                <span>{sample.tags.join(' / ') || '未补标签'}</span>
              </div>
              <div className="detail-list__item">
                <strong>一句话样本</strong>
                <span>{sample.synopsis}</span>
              </div>
            </div>
            <div className="analysis-sample-excerpt">
              {sample.excerpt.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>

          <article className="surface-card">
            <div className="surface-card__header">
              <div>
                <span className="eyebrow">本项目启发</span>
                <h2>先借鉴什么，不照搬什么</h2>
              </div>
            </div>
            <div className="analysis-signal-list">
              {sample.inspirationSignals.map((signal) => (
                <div key={signal} className="analysis-signal-list__item">
                  <strong>启发</strong>
                  <span>{signal}</span>
                </div>
              ))}
            </div>
            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => onApplyProjectStrategyProposal(sample.sampleId)}
                disabled={isApplyingStrategy}
              >
                {isApplyingStrategy ? '正在回写...' : '回写到项目'}
              </button>
              <button
                className="ghost-button"
                onClick={() =>
                  onStartTask(`请比较《${sample.title}》与《${shell.project.title}》在卖点与节奏上的差距。`, 'analysis')
                }
              >
                生成对标建议
              </button>
            </div>
          </article>
        </div>

        <section className="surface-grid surface-grid--three">
          <article className="surface-card">
            <span className="eyebrow">爆点拆解</span>
            <h3>钩子与题材承诺</h3>
            <p>{sample.hookSummary}</p>
            <div className="analysis-tag-row">
              {sample.tags.map((tag) => (
                <span key={tag} className="memory-chip">
                  {tag}
                </span>
              ))}
            </div>
          </article>

          <article className="surface-card">
            <span className="eyebrow">人物吸引力</span>
            <h3>记忆点与关系张力</h3>
            <p>{sample.characterSummary}</p>
            <div className="detail-list detail-list--compact">
              <div className="detail-list__item">
                <strong>人物热度</strong>
                <span>{sample.scores.characterHeat} / 10</span>
              </div>
              <div className="detail-list__item">
                <strong>反馈热度</strong>
                <span>{sample.scores.feedbackResonance} / 10</span>
              </div>
            </div>
          </article>

          <article className="surface-card">
            <span className="eyebrow">节奏结构</span>
            <h3>冲突、回合与尾钩</h3>
            <p>{sample.pacingSummary}</p>
            <div className="detail-list detail-list--compact">
              <div className="detail-list__item">
                <strong>钩子分</strong>
                <span>{sample.scores.hookStrength} / 10</span>
              </div>
              <div className="detail-list__item">
                <strong>节奏分</strong>
                <span>{sample.scores.pacingMomentum} / 10</span>
              </div>
            </div>
          </article>
        </section>

        <div className="surface-grid surface-grid--two">
          <article className="surface-card">
            <div className="surface-card__header">
              <div>
                <span className="eyebrow">读者反馈</span>
                <h3>评论高频买点</h3>
              </div>
              <span className="status-pill status-pill--muted">{sample.comments.length} 条评论</span>
            </div>
            <div className="analysis-signal-list">
              {sample.readerSignals.map((signal) => (
                <div key={signal} className="analysis-signal-list__item">
                  <strong>买点</strong>
                  <span>{signal}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="surface-card">
            <div className="surface-card__header">
              <div>
                <span className="eyebrow">风险提醒</span>
                <h3>哪些地方不能照搬</h3>
              </div>
            </div>
            <div className="analysis-signal-list">
              {sample.riskSignals.map((signal) => (
                <div key={signal} className="analysis-signal-list__item analysis-signal-list__item--warning">
                  <strong>风险</strong>
                  <span>{signal}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </>
    ) : (
      <article className="surface-card surface-card--empty">
        <div className="empty-state">
          <strong>还没有拆书样本</strong>
          <span>先导入一个 `.txt` 或 `.md` 样本文件，工作台会自动从文件名和正文里建立拆书结果。</span>
          <button className="primary-button" onClick={onCreateSampleRequest}>
            立即导入文件
          </button>
        </div>
      </article>
    )}
  </div>
)
