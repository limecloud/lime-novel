import type { WorkspaceSearchItemDto } from '@lime-novel/application'

const searchItemKindLabel: Record<WorkspaceSearchItemDto['kind'], string> = {
  project: '项目',
  chapter: '章节',
  scene: '场景',
  'analysis-sample': '拆书样本',
  'canon-card': '设定卡',
  'revision-issue': '修订问题',
  'export-preset': '导出预设',
  'knowledge-document': '知识页',
  'knowledge-output': '知识产物'
}

type WorkspaceSearchModalProps = {
  query: string
  results: WorkspaceSearchItemDto[]
  isSearching: boolean
  error?: string | null
  onQueryChange: (value: string) => void
  onClose: () => void
  onSelect: (item: WorkspaceSearchItemDto) => void
  resolveSurfaceLabel: (item: WorkspaceSearchItemDto) => string
}

export const WorkspaceSearchModal = ({
  query,
  results,
  isSearching,
  error,
  onQueryChange,
  onClose,
  onSelect,
  resolveSurfaceLabel
}: WorkspaceSearchModalProps) => (
  <div className="modal-overlay" role="presentation" onClick={onClose}>
    <div
      className="modal-card workspace-search-modal"
      role="dialog"
      aria-modal="true"
      aria-label="搜索当前小说项目"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="workspace-search-modal__header">
        <div>
          <span className="eyebrow">项目搜索</span>
          <h2>搜索章节、知识页、样本与修订</h2>
          <p>直接搜索当前工作区里的正文、知识页、查询产物、拆书样本、候选设定卡、修订问题和发布预设。</p>
        </div>
        <button type="button" className="ghost-button" onClick={onClose}>
          关闭
        </button>
      </div>

      <label className="field-stack workspace-search-modal__field">
        <span>搜索关键词</span>
        <input
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="例如：钟楼钥匙、林清远知道什么、第一章、发布简介"
        />
      </label>

      <div className="workspace-search-modal__content">
        {isSearching ? (
          <div className="empty-state">
            <strong>正在搜索当前项目...</strong>
            <span>章节正文、拆书样本、设定卡和修订问题正在本地检索。</span>
          </div>
        ) : error ? (
          <div className="empty-state">
            <strong>搜索暂时失败</strong>
            <span>{error}</span>
          </div>
        ) : query.trim().length === 0 ? (
          <div className="surface-grid surface-grid--two workspace-search-modal__tips">
            <article className="surface-card">
              <span className="eyebrow">快速入口</span>
              <h3>从当前工作区直接跳转</h3>
              <p>可以按章节标题、样本名、设定名、修订问题或导出预设快速回到对应工作面。</p>
            </article>
            <article className="surface-card">
              <span className="eyebrow">搜索范围</span>
              <h3>正文、知识页、设定、修订、发布</h3>
              <p>搜索会命中章节正文、知识页、查询产物、拆书样本、候选设定卡、修订问题和发布预设。</p>
            </article>
          </div>
        ) : results.length > 0 ? (
          <div className="workspace-search-results">
            {results.map((item) => (
              <button
                key={item.itemId}
                type="button"
                className="workspace-search-result"
                onClick={() => onSelect(item)}
              >
                <div className="workspace-search-result__meta">
                  <span className="workspace-search-result__kind">{searchItemKindLabel[item.kind]}</span>
                  <span className="workspace-search-result__surface">{resolveSurfaceLabel(item)}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.snippet}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>没有找到相关结果</strong>
            <span>可以换个角色名、章节标题、问题关键词或设定词再试一次。</span>
          </div>
        )}
      </div>
    </div>
  </div>
)
