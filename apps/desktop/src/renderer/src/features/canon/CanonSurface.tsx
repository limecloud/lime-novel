import type { WorkspaceShellDto } from '@lime-novel/application'
import type { CanonWorkbenchState } from './useCanonWorkbenchState'
import { canonCategoryDefinitions } from './canon-model'

type CanonSurfaceProps = {
  shell: WorkspaceShellDto
  canon: CanonWorkbenchState
  onStartTask: (intent: string) => void
  onCommitCanonCard: (cardId: string, visibility: 'candidate' | 'confirmed' | 'archived') => void
}

export const CanonSurface = ({ shell, canon, onStartTask, onCommitCanonCard }: CanonSurfaceProps) => {
  const selectedCard = canon.selectedCard

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--canon">
        <div className="surface-hero__main">
          <span className="eyebrow">项目长期记忆</span>
          <h1>角色、规则与时间线</h1>
          <p>设定工作面不是后台管理页，而是小说项目长期一致性的前台。</p>
        </div>
        <div className="segmented-switch">
          <button
            className={canon.canonView === 'cards' ? 'pill-button pill-button--active' : 'pill-button'}
            onClick={() => canon.onCanonViewChange('cards')}
          >
            列表
          </button>
          <button
            className={canon.canonView === 'graph' ? 'pill-button pill-button--active' : 'pill-button'}
            onClick={() => canon.onCanonViewChange('graph')}
          >
            关系图
          </button>
          <button
            className={canon.canonView === 'timeline' ? 'pill-button pill-button--active' : 'pill-button'}
            onClick={() => canon.onCanonViewChange('timeline')}
          >
            时间线
          </button>
        </div>
      </section>

      <section className="filter-bar">
        {canonCategoryDefinitions.map((category) => {
          const count = shell.canonCandidates.filter((card) => category.match(card)).length

          return (
            <button
              key={category.id}
              className={category.id === canon.selectedCategory ? 'filter-chip filter-chip--active' : 'filter-chip'}
              onClick={() => canon.onCategoryChange(category.id)}
            >
              {category.label}
              <span>{count}</span>
            </button>
          )
        })}
      </section>

      {canon.canonView === 'cards' ? (
        <div className="surface-grid surface-grid--three">
          {canon.visibleCards.length > 0 ? (
            canon.visibleCards.map((card) => (
              <button
                key={card.cardId}
                className={card.cardId === selectedCard?.cardId ? 'surface-card surface-card--selectable is-active' : 'surface-card surface-card--selectable'}
                onClick={() => canon.onSelectCard(card.cardId)}
              >
                <span className="eyebrow">{card.kind}</span>
                <h3>{card.name}</h3>
                <p>{card.summary}</p>
                <div className="supporting-note">{card.evidence}</div>
              </button>
            ))
          ) : (
            <article className="surface-card surface-card--empty">
              <span className="eyebrow">当前分类为空</span>
              <h3>还没有沉淀到这类设定</h3>
              <p>可以先从正文继续抽卡，或让设定代理为这个分类起一版草案。</p>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => onStartTask('请从当前章节里提取地点、规则或时间线设定。')}>
                  继续抽卡
                </button>
              </div>
            </article>
          )}
        </div>
      ) : null}

      <div className="surface-grid surface-grid--two">
        <article className="surface-card surface-card--graph">
          <div className="surface-card__header">
            <span className="eyebrow">{canon.canonView === 'timeline' ? '时间线' : '关系与引用'}</span>
            <button className="inline-link" onClick={() => onStartTask('请继续追踪当前设定卡的引用范围与冲突边界。')}>
              继续追问
            </button>
          </div>

          {canon.canonView === 'timeline' ? (
            <div className="timeline-board">
              {canon.timeline.map((item) => (
                <div key={item.title} className="timeline-item">
                  <div className="timeline-item__dot" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relationship-board">
              <div className="relationship-node relationship-node--primary">
                <strong>{selectedCard?.name ?? '当前卡片'}</strong>
                <span>{selectedCard?.summary ?? '等待选择一张设定卡。'}</span>
              </div>
              <div className="relationship-node relationship-node--secondary">
                <strong>{shell.canonCandidates[0]?.name ?? '角色卡'}</strong>
                <span>最近引用：第 12 章</span>
              </div>
              <div className="relationship-node relationship-node--accent">
                <strong>{shell.chapterTree[1]?.title ?? '当前章节'}</strong>
                <span>承接主线推进</span>
              </div>
            </div>
          )}
        </article>

        <article className="surface-card">
          <div className="surface-card__header">
            <span className="eyebrow">当前卡片详情</span>
            <span className={`status-chip ${selectedCard?.visibility === 'confirmed' ? '' : 'status-chip--muted'}`}>
              {selectedCard?.visibility === 'confirmed' ? '已确认' : '候选中'}
            </span>
          </div>
          <h2>{selectedCard?.name ?? '尚未选择设定卡'}</h2>
          <p>{selectedCard?.summary ?? '请选择左侧的一张设定卡查看引用范围与持续影响。'}</p>
          <div className="detail-list">
            <div className="detail-list__item">
              <strong>命中证据</strong>
              <span>{selectedCard?.evidence ?? '等待证据'}</span>
            </div>
            <div className="detail-list__item">
              <strong>建议动作</strong>
              <span>写入候选卡、升级为高频可见、标记连续性风险。</span>
            </div>
            <div className="detail-list__item">
              <strong>影响范围</strong>
              <span>第二卷主线、章节推进、角色状态同步。</span>
            </div>
          </div>
          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => selectedCard && onCommitCanonCard(selectedCard.cardId, 'confirmed')}
            >
              写回正式设定
            </button>
            <button
              className="ghost-button"
              onClick={() => selectedCard && onCommitCanonCard(selectedCard.cardId, 'archived')}
            >
              归档此卡
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}
