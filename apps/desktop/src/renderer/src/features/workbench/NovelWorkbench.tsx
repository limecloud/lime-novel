import { useEffect, useState } from 'react'
import type {
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentTaskDto,
  CanonCandidateDto,
  ChapterDocumentDto,
  ChapterListItemDto,
  CreateProjectInputDto,
  ExportPresetDto,
  RevisionIssueDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'
import { ChapterEditor } from '../editor/ChapterEditor'
import { AgentSidebar } from '../agent-feed/AgentSidebar'

type AgentFeedSnapshot = {
  header: AgentHeaderDto
  tasks: AgentTaskDto[]
  feed: AgentFeedItemDto[]
}

type NovelWorkbenchProps = {
  shell: WorkspaceShellDto
  chapterDocument?: ChapterDocumentDto
  activeChapterId?: string | null
  activeSurface: NovelSurfaceId
  sidebarMode: 'suggestions' | 'dialogue'
  feedState: AgentFeedSnapshot
  activityLabel: string
  isCreatingProject: boolean
  isOpeningProject: boolean
  onSurfaceChange: (surface: NovelSurfaceId) => void
  onCreateProject: (input: CreateProjectInputDto) => void
  onOpenProject: () => void
  onSidebarModeChange: (mode: 'suggestions' | 'dialogue') => void
  onSelectChapter: (chapterId: string) => void
  onInspectRevisionIssueChapter: (chapterId: string) => void
  onStartTask: (intent: string) => void
  onApplyProposal: (proposalId: string) => void
  onSaveChapter: (chapterId: string, content: string) => void
  onCommitCanonCard: (cardId: string, visibility: 'candidate' | 'confirmed' | 'archived') => void
  onUpdateRevisionIssue: (issueId: string, status: 'open' | 'deferred' | 'resolved') => void
  onCreateExportPackage: (presetId: string, synopsis: string, splitChapters: number) => void
}

type CreateProjectTemplateId = CreateProjectInputDto['template']

type CreateProjectFormState = {
  title: string
  genre: string
  premise: string
  template: CreateProjectTemplateId
}

type CanonView = 'cards' | 'graph' | 'timeline'
type CanonCategoryId = 'all' | 'character' | 'location' | 'rule' | 'timeline'

const navGlyph: Record<NovelSurfaceId, string> = {
  home: '首',
  writing: '写',
  canon: '设',
  revision: '修',
  publish: '发'
}

const projectStatusLabel: Record<string, string> = {
  planning: '规划中',
  drafting: '写作中',
  revising: '修订中',
  publishing: '发布准备'
}

const surfaceTitleLabel: Record<NovelSurfaceId, string> = {
  home: '首页',
  writing: '写作',
  canon: '设定',
  revision: '修订',
  publish: '发布'
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

const issueSeverityLabel: Record<RevisionIssueDto['severity'], string> = {
  low: '低优先',
  medium: '中优先',
  high: '高优先'
}

const issueSeverityTone: Record<RevisionIssueDto['severity'], string> = {
  low: 'low',
  medium: 'medium',
  high: 'high'
}

const exportStatusLabel: Record<ExportPresetDto['status'], string> = {
  ready: '可导出',
  draft: '待补齐元数据'
}

const canonCategoryDefinitions: Array<{
  id: CanonCategoryId
  label: string
  match: (card: CanonCandidateDto) => boolean
}> = [
  {
    id: 'all',
    label: '全部卡片',
    match: () => true
  },
  {
    id: 'character',
    label: '人物卡',
    match: (card) => card.kind === 'character'
  },
  {
    id: 'location',
    label: '地点与场景',
    match: (card) => card.kind === 'location'
  },
  {
    id: 'rule',
    label: '规则与道具',
    match: (card) => card.kind === 'rule' || card.kind === 'item'
  },
  {
    id: 'timeline',
    label: '时间线节点',
    match: (card) => card.kind === 'timeline-event'
  }
]

const formatCount = (value: number): string => new Intl.NumberFormat('zh-CN').format(value)

const extractParagraphs = (content?: string): string[] =>
  (content ?? '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => Boolean(block) && !block.startsWith('# '))

const excerptParagraphs = (content?: string): string[] => {
  const paragraphs = extractParagraphs(content)
  return paragraphs.length > 0 ? paragraphs.slice(0, 4) : ['正文尚未写入，先从当前章节目标继续推进。']
}

const buildIssueEvidence = (issue: RevisionIssueDto): string[] => {
  if (issue.title.includes('视角')) {
    return [
      '第 5 章：林清远第一次听见钟声时会出现耳鸣和短暂停顿。',
      '第 8 章：她在高处会先摸口袋里的旧硬币稳定情绪。',
      '因此当前段落至少应补一层身体反应或压抑反应。'
    ]
  }

  if (issue.title.includes('节奏')) {
    return [
      '第 12 章前两段已经完成环境铺垫，再往后应更快落到动作。',
      '相邻章节的悬念推进更依赖“选择发生”而不是继续解释。',
      '建议压缩环境句，并把动作落点提前到门锁和旧铜味。'
    ]
  }

  return [
    '当前问题已命中跨章事实冲突，需要先锁定章节顺序和时间标记。',
    '建议先以最小修订消除冲突，再决定是否扩大改动范围。',
    '所有修订都应保留证据片段，避免后续再次回滚。'
  ]
}

const buildRevisionPlans = (issue: RevisionIssueDto): string[] => {
  if (issue.title.includes('视角')) {
    return [
      '方案 A：补耳鸣与握拳动作，改动最小、人物气质最稳。',
      '方案 B：补一小段旧钟声回忆，解释更强但节奏更慢。'
    ]
  }

  if (issue.title.includes('节奏')) {
    return [
      '方案 A：压缩环境句并提前门锁动作，优先保悬念推进。',
      '方案 B：把心理描写拆进后两段，让节奏更平缓。'
    ]
  }

  return [
    '方案 A：只修正冲突事实，确保改动范围局限在当前章。',
    '方案 B：顺带调整相邻章节表述，换取更完整的一致性。'
  ]
}

const buildCanonTimeline = (
  chapters: ChapterListItemDto[],
  selectedCard?: CanonCandidateDto
): Array<{ title: string; detail: string }> =>
  chapters.map((chapter) => ({
    title: `第 ${chapter.order} 章 · ${chapter.title}`,
    detail: selectedCard
      ? `${selectedCard.name} 与本章建立关联，可回看 ${chapter.summary}`
      : chapter.summary
  }))

const buildPublishChecklist = (preset: ExportPresetDto, shell: WorkspaceShellDto): string[] => [
  `当前预设：${preset.title} · ${preset.format.toUpperCase()}`,
  `卷册范围：${shell.chapterTree[0]?.order ?? 1} - ${shell.chapterTree.at(-1)?.order ?? 1} 章`,
  `项目状态：${projectStatusLabel[shell.project.status] ?? shell.project.status}`,
  `待确认：简介长度、封面文案、文件覆盖策略`
]

const summarizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)

  if (segments.length <= 4) {
    return normalized
  }

  return `.../${segments.slice(-4).join('/')}`
}

const formatDateTime = (value: string): string => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', { hour12: false })
}

const buildDefaultCreateProjectForm = (): CreateProjectFormState => ({
  title: '',
  genre: '悬疑 / 都市奇幻',
  premise: '',
  template: 'blank'
})

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

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--home">
        <div className="surface-hero__main">
          <span className="eyebrow">回到你的作品</span>
          <h1>{shell.project.title}</h1>
          <p>{shell.project.premise}</p>
          <div className="hero-metrics">
            <span>总字数 {formatCount(totalWords)}</span>
            <span>候选设定卡 {shell.canonCandidates.length}</span>
            <span>修订问题 {shell.revisionIssues.length}</span>
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
  selectedSceneId,
  onSelectScene,
  onStartTask,
  onSaveChapter
}: {
  shell: WorkspaceShellDto
  chapterDocument?: ChapterDocumentDto
  selectedSceneId?: string
  onSelectScene: (sceneId: string) => void
  onStartTask: (intent: string) => void
  onSaveChapter: (chapterId: string, content: string) => void
}) => {
  const [draftContent, setDraftContent] = useState(chapterDocument?.content ?? '')
  const paragraphs = excerptParagraphs(chapterDocument?.content)
  const selectedScene = shell.sceneList.find((scene) => scene.sceneId === selectedSceneId) ?? shell.sceneList[0]

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

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--writing">
        <div className="surface-hero__meta-bar">
          <span>视角：林清远</span>
          <span>场景：{selectedScene?.title ?? '当前场景'}</span>
          <span>目标：{chapterDocument.objective}</span>
        </div>
        <div className="surface-hero__main">
          <span className="eyebrow">正文主舞台</span>
          <h1>{chapterDocument.title}</h1>
          <p>正文始终占主舞台；右栏负责对话协作、证据回溯和提议应用。</p>
          <div className="hero-metrics">
            <span>{chapterDocument.lastEditedAt}</span>
            <span>{formatCount(chapterDocument.wordCount)} 字</span>
            <span>{shell.sceneList.length} 个场景</span>
            <span>{isDirty ? '有未保存更改' : '已同步到本地项目'}</span>
          </div>
        </div>
      </section>

      <section className="action-ribbon">
        <button className="primary-button" onClick={() => onSaveChapter(chapterDocument.chapterId, draftContent)}>
          保存正文
        </button>
        <button className="primary-button" onClick={() => onStartTask('请基于当前章节目标继续写下一段。')}>
          续写下一段
        </button>
        <button className="ghost-button" onClick={() => onStartTask('请把当前开头改得更克制、更有压迫感。')}>
          改写当前开头
        </button>
        <button className="ghost-button" onClick={() => onStartTask('请检查本章是否有视角越界，并给出证据。')}>
          检查视角
        </button>
        <button className="ghost-button" onClick={() => onStartTask('请把当前段落可提炼的物件与规则沉淀成设定卡。')}>
          沉淀设定
        </button>
      </section>

      <section className="selection-panel">
        <div>
          <span className="eyebrow">当前选区</span>
          <h3>{selectedScene?.title ?? '楼梯口的迟疑'}</h3>
          <p>{selectedScene?.goal ?? '可续写、改写、补强悬念、沉淀为线索节点。'}</p>
        </div>
        <div className="selection-panel__actions">
          {shell.sceneList.map((scene) => (
            <button
              key={scene.sceneId}
              className={scene.sceneId === selectedScene?.sceneId ? 'pill-button pill-button--active' : 'pill-button'}
              onClick={() => onSelectScene(scene.sceneId)}
            >
              {scene.title}
            </button>
          ))}
        </div>
      </section>

      <section className="editor-surface">
        <ChapterEditor content={draftContent} onChange={setDraftContent} />
      </section>

      <div className="surface-grid surface-grid--two">
        <article className="surface-card">
          <div className="surface-card__header">
            <span className="eyebrow">当前段落脉搏</span>
            <span className="status-chip">正文选区</span>
          </div>
          <div className="serif-snippets">
            {paragraphs.slice(0, 2).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="surface-card__header">
            <span className="eyebrow">章节记忆</span>
            <span className="status-chip status-chip--muted">本轮引用</span>
          </div>
          <div className="detail-list">
            <div className="detail-list__item">
              <strong>场景目标</strong>
              <span>{selectedScene?.goal ?? chapterDocument.objective}</span>
            </div>
            <div className="detail-list__item">
              <strong>人物风险</strong>
              <span>钟声与高处会触发明显压抑反应，不应写得过于平静。</span>
            </div>
            <div className="detail-list__item">
              <strong>待回收伏笔</strong>
              <span>旧铜味、钟楼钥匙、父亲失踪的沉默结构。</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}

const CanonSurface = ({
  shell,
  canonView,
  onCanonViewChange,
  selectedCategory,
  onCategoryChange,
  selectedCardId,
  onSelectCard,
  onStartTask,
  onCommitCanonCard
}: {
  shell: WorkspaceShellDto
  canonView: CanonView
  onCanonViewChange: (view: CanonView) => void
  selectedCategory: CanonCategoryId
  onCategoryChange: (category: CanonCategoryId) => void
  selectedCardId?: string
  onSelectCard: (cardId: string) => void
  onStartTask: (intent: string) => void
  onCommitCanonCard: (cardId: string, visibility: 'candidate' | 'confirmed' | 'archived') => void
}) => {
  const visibleCards = shell.canonCandidates.filter((card) =>
    canonCategoryDefinitions.find((item) => item.id === selectedCategory)?.match(card) ?? true
  )
  const selectedCard =
    visibleCards.find((card) => card.cardId === selectedCardId) ??
    shell.canonCandidates.find((card) => card.cardId === selectedCardId) ??
    visibleCards[0]

  const timeline = buildCanonTimeline(shell.chapterTree, selectedCard)

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
            className={canonView === 'cards' ? 'pill-button pill-button--active' : 'pill-button'}
            onClick={() => onCanonViewChange('cards')}
          >
            列表
          </button>
          <button
            className={canonView === 'graph' ? 'pill-button pill-button--active' : 'pill-button'}
            onClick={() => onCanonViewChange('graph')}
          >
            关系图
          </button>
          <button
            className={canonView === 'timeline' ? 'pill-button pill-button--active' : 'pill-button'}
            onClick={() => onCanonViewChange('timeline')}
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
              className={category.id === selectedCategory ? 'filter-chip filter-chip--active' : 'filter-chip'}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.label}
              <span>{count}</span>
            </button>
          )
        })}
      </section>

      {canonView === 'cards' ? (
        <div className="surface-grid surface-grid--three">
          {visibleCards.length > 0 ? (
            visibleCards.map((card) => (
              <button
                key={card.cardId}
                className={card.cardId === selectedCard?.cardId ? 'surface-card surface-card--selectable is-active' : 'surface-card surface-card--selectable'}
                onClick={() => onSelectCard(card.cardId)}
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
            <span className="eyebrow">{canonView === 'timeline' ? '时间线' : '关系与引用'}</span>
            <button className="inline-link" onClick={() => onStartTask('请继续追踪当前设定卡的引用范围与冲突边界。')}>
              继续追问
            </button>
          </div>

          {canonView === 'timeline' ? (
            <div className="timeline-board">
              {timeline.map((item) => (
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

const RevisionSurface = ({
  issue,
  chapterDocument,
  onStartTask,
  onApplyProposal,
  onUpdateIssue
}: {
  issue?: RevisionIssueDto
  chapterDocument?: ChapterDocumentDto
  onStartTask: (intent: string) => void
  onApplyProposal: (proposalId: string) => void
  onUpdateIssue: (issueId: string, status: 'open' | 'deferred' | 'resolved') => void
}) => {
  const paragraphs = excerptParagraphs(chapterDocument?.content)
  const evidence = issue ? buildIssueEvidence(issue) : []
  const plans = issue ? buildRevisionPlans(issue) : []

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--revision">
        <div className="surface-hero__meta-bar">
          <span>问题定位：{issue ? `第 ${issue.chapterId.replace('chapter-', '')} 章` : '等待选择问题'}</span>
          <span>类型：人物 / 节奏 / POV / 语言</span>
          <span>来源：自动诊断 + 证据回溯</span>
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
          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => {
                if (!issue) {
                  onStartTask('请针对当前问题生成最小修订方案。')
                  return
                }

                if (issue.chapterId === 'chapter-12' && issue.status !== 'resolved') {
                  onApplyProposal('proposal-rewrite-opening')
                  return
                }

                onUpdateIssue(issue.issueId, 'resolved')
              }}
            >
              {issue?.status === 'resolved' ? '已解决' : '应用方案 A'}
            </button>
            <button
              className="ghost-button"
              onClick={() => onStartTask(`请针对“${issue?.title ?? '当前问题'}”再来一版更克制的方案。`)}
            >
              再来一版
            </button>
            <button
              className="ghost-button"
              onClick={() => issue && onUpdateIssue(issue.issueId, issue.status === 'deferred' ? 'open' : 'deferred')}
            >
              {issue?.status === 'deferred' ? '重新打开' : '稍后处理'}
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}

const PublishSurface = ({
  shell,
  preset,
  synopsis,
  onSynopsisChange,
  exportSplit,
  onExportSplitChange,
  onSelectPreset,
  onStartTask,
  onCreateExportPackage
}: {
  shell: WorkspaceShellDto
  preset?: ExportPresetDto
  synopsis: string
  onSynopsisChange: (value: string) => void
  exportSplit: string
  onExportSplitChange: (value: string) => void
  onSelectPreset: (presetId: string) => void
  onStartTask: (intent: string) => void
  onCreateExportPackage: (presetId: string, synopsis: string, splitChapters: number) => void
}) => {
  const checklist = preset ? buildPublishChecklist(preset, shell) : []
  const presetTitleById = new Map(shell.exportPresets.map((item) => [item.presetId, item.title]))

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--publish">
        <div className="surface-hero__main">
          <span className="eyebrow">结果工作面</span>
          <h1>导出预览与发布准备</h1>
          <p>发布仍属于小说主流程，因为简介、章节范围、元数据和版本都依赖项目记忆。</p>
        </div>
        <div className="hero-actions">
          {shell.exportPresets.map((item) => (
            <button
              key={item.presetId}
              className={item.presetId === preset?.presetId ? 'pill-button pill-button--active' : 'pill-button'}
              onClick={() => onSelectPreset(item.presetId)}
            >
              {item.title}
            </button>
          ))}
        </div>
      </section>

      <div className="surface-grid surface-grid--two-large">
        <article className="surface-card surface-card--preview">
          <div className="surface-card__header">
            <span className="eyebrow">导出预览</span>
            <span className="status-chip">{preset ? exportStatusLabel[preset.status] : '等待预设'}</span>
          </div>
          <div className="preview-sheet">
            <div className="preview-sheet__header">
              <strong>{shell.project.title}</strong>
              <span>{preset ? `${preset.title} · ${preset.format.toUpperCase()}` : '尚未选择预设'}</span>
            </div>
            <h2>{shell.chapterTree[1]?.title ? `第 ${shell.chapterTree[1].order} 章《${shell.chapterTree[1].title}》` : '导出预览'}</h2>
            <p>{synopsis}</p>
            <div className="detail-list">
              <div className="detail-list__item">
                <strong>导出范围</strong>
                <span>第 {shell.chapterTree[0]?.order ?? 1} 章 - 第 {shell.chapterTree.at(-1)?.order ?? 1} 章</span>
              </div>
              <div className="detail-list__item">
                <strong>平台拆分</strong>
                <span>{exportSplit} 个平台章节</span>
              </div>
              <div className="detail-list__item">
                <strong>版本快照</strong>
                <span>{new Date().toLocaleString('zh-CN', { hour12: false })}</span>
              </div>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="surface-card__header">
            <span className="eyebrow">发布参数</span>
            <button className="inline-link" onClick={() => onStartTask('请比较最近两次发布差异，并指出最需要确认的变化。')}>
              比较差异
            </button>
          </div>
          <label className="field-stack">
            <span>平台简介</span>
            <textarea value={synopsis} onChange={(event) => onSynopsisChange(event.target.value)} />
          </label>
          <label className="field-stack">
            <span>平台拆分章节数</span>
            <input value={exportSplit} onChange={(event) => onExportSplitChange(event.target.value)} />
          </label>
          <div className="stacked-notes">
            {checklist.map((item) => (
              <div key={item} className="stacked-note">
                <p>{item}</p>
              </div>
            ))}
          </div>
          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() =>
                preset &&
                onCreateExportPackage(preset.presetId, synopsis, Number.parseInt(exportSplit, 10) || 3)
              }
            >
              生成导出包
            </button>
            <button className="ghost-button" onClick={() => onStartTask('请帮我生成一版平台简介，并保留主线悬念。')}>
              生成平台简介
            </button>
            <button
              className="ghost-button"
              onClick={() =>
                preset &&
                onCreateExportPackage(preset.presetId, synopsis, Number.parseInt(exportSplit, 10) || 3)
              }
            >
              导出当前版本
            </button>
          </div>
        </article>
      </div>

      <article className="surface-card">
        <div className="surface-card__header">
          <span className="eyebrow">最近导出</span>
          <span className="status-chip status-chip--muted">{shell.recentExports.length} 次输出</span>
        </div>
        {shell.recentExports.length > 0 ? (
          <div className="export-history-list">
            {shell.recentExports.map((item) => (
              <div key={item.exportId} className="export-history-item">
                <div className="export-history-item__header">
                  <strong>{presetTitleById.get(item.presetId) ?? item.presetId}</strong>
                  <span>{formatDateTime(item.generatedAt)}</span>
                </div>
                <p title={item.outputDir}>导出目录：{summarizePath(item.outputDir)}</p>
                <p title={item.manifestPath}>清单文件：{summarizePath(item.manifestPath)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>还没有导出记录</strong>
            <span>生成第一版导出包后，这里会回流最近产物，便于继续比较版本差异。</span>
          </div>
        )}
      </article>
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
        <span>{shell.chapterTree.length} 章 / {shell.canonCandidates.length} 张设定卡 / 持续共享角色状态</span>
      </div>
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">待处理结果</span>
      <button className="panel-list-button" onClick={() => onSurfaceChange('canon')}>
        <strong>设定代理</strong>
        <span>新增 {shell.canonCandidates.length} 张候选卡</span>
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
  selectedSceneId,
  onSelectChapter,
  onSelectScene,
  onStartTask
}: {
  shell: WorkspaceShellDto
  chapterId?: string
  selectedSceneId?: string
  onSelectChapter: (chapterId: string) => void
  onSelectScene: (sceneId: string) => void
  onStartTask: (intent: string) => void
}) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">章节结构</span>
      <button className="structure-button structure-button--primary" onClick={() => onStartTask('请按当前卷册节奏，给我生成下一章提纲。')}>
        + 新建章节
      </button>
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">{shell.chapterTree[0]?.volumeLabel ?? '当前卷册'}</span>
      {shell.chapterTree.map((chapter) => (
        <button
          key={chapter.chapterId}
          className={chapter.chapterId === chapterId ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
          onClick={() => onSelectChapter(chapter.chapterId)}
        >
          <strong>{`第 ${chapter.order} 章 ${chapter.title}`}</strong>
          <span>{chapterStatusLabel[chapter.status]} · {formatCount(chapter.wordCount)} 字</span>
        </button>
      ))}
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">本章状态</span>
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
  </div>
)

const CanonStructurePanel = ({
  shell,
  selectedCategory,
  onCategoryChange,
  onStartTask
}: {
  shell: WorkspaceShellDto
  selectedCategory: CanonCategoryId
  onCategoryChange: (category: CanonCategoryId) => void
  onStartTask: (intent: string) => void
}) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">设定分类</span>
      <button
        className="structure-button structure-button--primary"
        onClick={() => onStartTask('请按当前项目世界观，为我创建一张新的设定卡草案。')}
      >
        + 新建卡片
      </button>
    </div>

    <div className="structure-panel__section">
      {canonCategoryDefinitions.slice(1).map((category) => {
        const count = shell.canonCandidates.filter((card) => category.match(card)).length
        return (
          <button
            key={category.id}
            className={category.id === selectedCategory ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
            onClick={() => onCategoryChange(category.id)}
          >
            <strong>{category.label}</strong>
            <span>{count} 张卡片</span>
          </button>
        )
      })}
    </div>
  </div>
)

const RevisionStructurePanel = ({
  issues,
  selectedIssueId,
  onSelectIssue,
  onInspectIssueChapter
}: {
  issues: RevisionIssueDto[]
  selectedIssueId?: string
  onSelectIssue: (issueId: string) => void
  onInspectIssueChapter: (chapterId: string) => void
}) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">问题队列</span>
      {issues.map((issue) => (
        <button
          key={issue.issueId}
          className={issue.issueId === selectedIssueId ? 'panel-list-button panel-list-button--active panel-list-button--issue' : 'panel-list-button panel-list-button--issue'}
          onClick={() => {
            onSelectIssue(issue.issueId)
            onInspectIssueChapter(issue.chapterId)
          }}
        >
          <strong>{issueSeverityLabel[issue.severity]} · {issue.title}</strong>
          <span>
            {issue.summary}
            {issue.status === 'deferred' ? ' · 已稍后处理' : ''}
          </span>
        </button>
      ))}
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">筛选</span>
      <div className="panel-note">
        <strong>范围</strong>
        <span>当前章 / 当前卷 / 全书</span>
      </div>
      <div className="panel-note">
        <strong>类型</strong>
        <span>人物 / 节奏 / POV / 语言</span>
      </div>
      <div className="panel-note">
        <strong>来源</strong>
        <span>自动诊断 / 手动标记 / 反馈导入</span>
      </div>
    </div>
  </div>
)

const PublishStructurePanel = ({
  shell,
  selectedPresetId,
  onSelectPreset
}: {
  shell: WorkspaceShellDto
  selectedPresetId?: string
  onSelectPreset: (presetId: string) => void
}) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">发布结构</span>
      {shell.exportPresets.map((preset) => (
        <button
          key={preset.presetId}
          className={preset.presetId === selectedPresetId ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
          onClick={() => onSelectPreset(preset.presetId)}
        >
          <strong>{preset.title}</strong>
          <span>{preset.summary}</span>
        </button>
      ))}
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">本次范围</span>
      <div className="panel-note">
        <strong>{shell.chapterTree[0]?.volumeLabel ?? '当前卷册'}</strong>
        <span>第 {shell.chapterTree[0]?.order ?? 1} 章 - 第 {shell.chapterTree.at(-1)?.order ?? 1} 章</span>
      </div>
      <div className="panel-note">
        <strong>版本</strong>
        <span>{new Date().toLocaleString('zh-CN', { hour12: false })}</span>
      </div>
    </div>
  </div>
)

export const NovelWorkbench = ({
  shell,
  chapterDocument,
  activeChapterId: currentChapterId,
  activeSurface,
  sidebarMode,
  feedState,
  activityLabel,
  isCreatingProject,
  isOpeningProject,
  onSurfaceChange,
  onCreateProject,
  onOpenProject,
  onSidebarModeChange,
  onSelectChapter,
  onInspectRevisionIssueChapter,
  onStartTask,
  onApplyProposal,
  onSaveChapter,
  onCommitCanonCard,
  onUpdateRevisionIssue,
  onCreateExportPackage
}: NovelWorkbenchProps) => {
  const activeChapterId = currentChapterId ?? chapterDocument?.chapterId ?? shell.project.currentChapterId
  const activeChapter =
    shell.chapterTree.find((chapter) => chapter.chapterId === activeChapterId) ?? shell.chapterTree[0]

  const [selectedSceneId, setSelectedSceneId] = useState(shell.sceneList[0]?.sceneId)
  const [canonView, setCanonView] = useState<CanonView>('cards')
  const [selectedCanonCategory, setSelectedCanonCategory] = useState<CanonCategoryId>('all')
  const [selectedCanonCardId, setSelectedCanonCardId] = useState(shell.canonCandidates[0]?.cardId)
  const [selectedIssueId, setSelectedIssueId] = useState(shell.revisionIssues[0]?.issueId)
  const [selectedPresetId, setSelectedPresetId] = useState(shell.exportPresets[0]?.presetId)
  const [isCreateProjectModalOpen, setCreateProjectModalOpen] = useState(false)
  const [createProjectForm, setCreateProjectForm] = useState<CreateProjectFormState>(buildDefaultCreateProjectForm)
  const [publishSynopsis, setPublishSynopsis] = useState(
    `《${shell.project.title}》聚焦林清远在钟楼与旧雨季之间追索父亲失踪真相的过程，保留悬疑与都市奇幻的双重张力。`
  )
  const [exportSplit, setExportSplit] = useState('3')

  useEffect(() => {
    if (!shell.sceneList.some((scene) => scene.sceneId === selectedSceneId)) {
      setSelectedSceneId(shell.sceneList[0]?.sceneId)
    }
  }, [selectedSceneId, shell.sceneList])

  useEffect(() => {
    if (!shell.canonCandidates.some((card) => card.cardId === selectedCanonCardId)) {
      setSelectedCanonCardId(shell.canonCandidates[0]?.cardId)
    }
  }, [selectedCanonCardId, shell.canonCandidates])

  useEffect(() => {
    if (!shell.revisionIssues.some((issue) => issue.issueId === selectedIssueId)) {
      setSelectedIssueId(shell.revisionIssues[0]?.issueId)
    }
  }, [selectedIssueId, shell.revisionIssues])

  useEffect(() => {
    if (!shell.exportPresets.some((preset) => preset.presetId === selectedPresetId)) {
      setSelectedPresetId(shell.exportPresets[0]?.presetId)
    }
  }, [selectedPresetId, shell.exportPresets])

  useEffect(() => {
    setPublishSynopsis(
      `《${shell.project.title}》聚焦林清远在钟楼与旧雨季之间追索父亲失踪真相的过程，保留悬疑与都市奇幻的双重张力。`
    )
  }, [shell.project.title, shell.workspacePath])

  useEffect(() => {
    if (!isCreatingProject) {
      setCreateProjectModalOpen(false)
      setCreateProjectForm(buildDefaultCreateProjectForm())
    }
  }, [isCreatingProject, shell.workspacePath])

  const selectedIssue =
    shell.revisionIssues.find((issue) => issue.issueId === selectedIssueId) ?? shell.revisionIssues[0]
  const selectedPreset =
    shell.exportPresets.find((preset) => preset.presetId === selectedPresetId) ?? shell.exportPresets[0]
  const activeSurfaceLabel = surfaceTitleLabel[activeSurface]
  const chapterStatusSummary = activeChapter
    ? `第 ${activeChapter.order} 章 · ${activeChapter.title}`
    : '未选择章节'

  return (
    <div className="novel-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img className="brand-mark" src="/logo-lime-192.png" alt="Lime Novel 标志" />
          <div className="brand-lockup__copy">
            <span className="eyebrow">Lime Novel</span>
            <h1>{shell.project.title}</h1>
            <p>{shell.project.subtitle}</p>
          </div>
        </div>
        <div className="topbar__status">
          <span className="status-pill">{projectStatusLabel[shell.project.status] ?? shell.project.status}</span>
          <span className="status-pill status-pill--muted">{shell.project.genre}</span>
          <span className="status-pill status-pill--path" title={shell.workspacePath}>
            {summarizePath(shell.workspacePath)}
          </span>
          <button className="ghost-button" onClick={onOpenProject} disabled={isOpeningProject}>
            {isOpeningProject ? '正在打开...' : '打开项目'}
          </button>
          <button className="ghost-button" onClick={() => onSurfaceChange('publish')}>
            导出
          </button>
        </div>
      </header>

      <div className="workspace-grid">
        <nav className="nav-rail">
          {shell.navigation.map((item) => (
            <button
              key={item.id}
              className={item.id === activeSurface ? 'nav-button nav-button--active' : 'nav-button'}
              onClick={() => onSurfaceChange(item.id)}
            >
              <span className="nav-button__glyph">{navGlyph[item.id]}</span>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>

        <aside className="structure-panel">
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
              selectedSceneId={selectedSceneId}
              onSelectChapter={onSelectChapter}
              onSelectScene={setSelectedSceneId}
              onStartTask={onStartTask}
            />
          ) : null}
          {activeSurface === 'canon' ? (
            <CanonStructurePanel
              shell={shell}
              selectedCategory={selectedCanonCategory}
              onCategoryChange={setSelectedCanonCategory}
              onStartTask={onStartTask}
            />
          ) : null}
          {activeSurface === 'revision' ? (
            <RevisionStructurePanel
              issues={shell.revisionIssues}
              selectedIssueId={selectedIssue?.issueId}
              onSelectIssue={setSelectedIssueId}
              onInspectIssueChapter={onInspectRevisionIssueChapter}
            />
          ) : null}
          {activeSurface === 'publish' ? (
            <PublishStructurePanel
              shell={shell}
              selectedPresetId={selectedPreset?.presetId}
              onSelectPreset={setSelectedPresetId}
            />
          ) : null}
        </aside>

        <main className="main-surface">
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
              selectedSceneId={selectedSceneId}
              onSelectScene={setSelectedSceneId}
              onStartTask={onStartTask}
              onSaveChapter={onSaveChapter}
            />
          ) : null}
          {activeSurface === 'canon' ? (
            <CanonSurface
              shell={shell}
              canonView={canonView}
              onCanonViewChange={setCanonView}
              selectedCategory={selectedCanonCategory}
              onCategoryChange={setSelectedCanonCategory}
              selectedCardId={selectedCanonCardId}
              onSelectCard={setSelectedCanonCardId}
              onStartTask={onStartTask}
              onCommitCanonCard={onCommitCanonCard}
            />
          ) : null}
          {activeSurface === 'revision' ? (
            <RevisionSurface
              issue={selectedIssue}
              chapterDocument={chapterDocument}
              onStartTask={onStartTask}
              onApplyProposal={onApplyProposal}
              onUpdateIssue={onUpdateRevisionIssue}
            />
          ) : null}
          {activeSurface === 'publish' ? (
            <PublishSurface
              shell={shell}
              preset={selectedPreset}
              synopsis={publishSynopsis}
              onSynopsisChange={setPublishSynopsis}
              exportSplit={exportSplit}
              onExportSplitChange={setExportSplit}
              onSelectPreset={setSelectedPresetId}
              onStartTask={onStartTask}
              onCreateExportPackage={onCreateExportPackage}
            />
          ) : null}
        </main>

        <AgentSidebar
          mode={sidebarMode}
          onModeChange={onSidebarModeChange}
          header={feedState.header}
          tasks={feedState.tasks}
          feed={feedState.feed}
          quickActions={shell.quickActions}
          onStartTask={onStartTask}
          onApplyProposal={onApplyProposal}
        />
      </div>

      <footer className="status-bar">
        <div className="status-bar__item status-bar__item--wide">
          <span className="eyebrow">项目目录</span>
          <strong title={shell.workspacePath}>{summarizePath(shell.workspacePath)}</strong>
        </div>
        <div className="status-bar__item">
          <span className="eyebrow">当前工作面</span>
          <strong>{activeSurfaceLabel}</strong>
        </div>
        <div className="status-bar__item">
          <span className="eyebrow">当前章节</span>
          <strong>{chapterStatusSummary}</strong>
        </div>
        <div className="status-bar__item">
          <span className="eyebrow">最近导出</span>
          <strong>{shell.recentExports.length} 次</strong>
        </div>
        <div className="status-bar__item status-bar__item--accent">
          <span className="eyebrow">工作台状态</span>
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
    </div>
  )
}
