import { useEffect, useState } from 'react'
import type {
  AnalysisOverviewDto,
  AnalysisSampleDto,
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentTaskDiagnosticsDto,
  AgentTaskDto,
  ApplyProjectStrategyProposalInputDto,
  CanonCandidateDto,
  ChapterDocumentDto,
  ChapterListItemDto,
  CreateExportPackageInputDto,
  CreateProjectInputDto,
  GenerateKnowledgeAnswerInputDto,
  GenerateKnowledgeAnswerResultDto,
  QuickActionDto,
  RevisionIssueDto,
  RevisionRecordDto,
  WorkspaceSearchItemDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { FeatureToolId, NovelSurfaceId } from '@lime-novel/domain-novel'
import { ChapterEditor } from '../editor/ChapterEditor'
import { AgentSidebar } from '../agent-feed/AgentSidebar'
import type { AgentSidebarMode } from '../agent-feed/AgentSidebar'
import { desktopApi } from '../../lib/desktop-api'
import limeLogoUrl from '../../assets/logo-lime.png'
import { limeNovelBrand } from '../../app/branding'
import { KnowledgeStructurePanel } from '../knowledge/KnowledgeStructurePanel'
import { KnowledgeSurface } from '../knowledge/KnowledgeSurface'
import { knowledgeBucketLabel } from '../knowledge/knowledge-model'
import { useKnowledgeWorkbenchState } from '../knowledge/useKnowledgeWorkbenchState'
import { PublishStructurePanel } from '../publish/PublishStructurePanel'
import { PublishSurface } from '../publish/PublishSurface'
import { usePublishWorkbenchState } from '../publish/usePublishWorkbenchState'
import { WorkspaceSearchModal } from '../workspace-search/WorkspaceSearchModal'
import { useWorkspaceSearch } from '../workspace-search/useWorkspaceSearch'
import { formatCount, formatDateTime, summarizePath } from './workbench-format'

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
  isApplyingAnalysisStrategy: boolean
  isCreatingExportPackage: boolean
  isGeneratingKnowledgeAnswer: boolean
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

const surfaceLabel: Record<NovelSurfaceId, string> = {
  home: '首页',
  writing: '写作',
  knowledge: '知识',
  'feature-center': '功能中心',
  analysis: '拆书',
  canon: '设定',
  revision: '修订',
  publish: '发布'
}

const featureToolLabel: Record<FeatureToolId, string> = {
  analysis: '拆书'
}

const featureCenterEntry = {
  id: 'feature-center' as const,
  label: '功能中心',
  description: '插件式创作能力与辅助工具'
}

const resolveWorkspaceSearchSurfaceLabel = (item: WorkspaceSearchItemDto): string => {
  if (item.surface === 'feature-center' && item.featureTool) {
    return `${surfaceLabel[item.surface]} / ${featureToolLabel[item.featureTool]}`
  }

  return surfaceLabel[item.surface]
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

const buildDefaultCreateProjectForm = (): CreateProjectFormState => ({
  title: '',
  genre: '悬疑 / 都市奇幻',
  premise: '',
  template: 'blank'
})

const analysisScoreLabel: Record<keyof AnalysisOverviewDto['averageScores'], string> = {
  hookStrength: '钩子',
  characterHeat: '人物',
  pacingMomentum: '节奏',
  feedbackResonance: '反馈'
}

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
  onClose,
  onOpenProject,
  onGoPublish
}: {
  shell: WorkspaceShellDto
  activityLabel: string
  onClose: () => void
  onOpenProject: () => void
  onGoPublish: () => void
}) => (
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
            <p>这里会承接后续登录头像与账户入口。当前先集中放项目、工作区和常用动作。</p>
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
              <span>本地创作模式，后续这里会切换为登录用户头像与账户信息。</span>
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
            <span>知识资产 {shell.knowledgeSummary.totalDocuments}</span>
            <span>拆书样本 {shell.analysisSamples.length}</span>
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
  const [isStageMetaExpanded, setIsStageMetaExpanded] = useState(false)
  const [isCanvasHeaderExpanded, setIsCanvasHeaderExpanded] = useState(false)
  const [isSelectionTrayExpanded, setIsSelectionTrayExpanded] = useState(false)
  const [isInsightDockExpanded, setIsInsightDockExpanded] = useState(false)
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
  const selectedSceneGoal = selectedScene?.goal ?? chapterDocument.objective
  const handleSave = (): void => {
    onSaveChapter(chapterDocument.chapterId, draftContent)
  }

  return (
    <div className="writing-stage">
      <section className="writing-stage__meta">
        <div className="writing-stage__meta-strip">
          <div className="writing-stage__title">
            <span className="eyebrow">正文主舞台</span>
            <h1>{chapterDocument.title}</h1>
          </div>
          <div className="writing-stage__meta-actions">
            <div className="writing-stage__stats">
              <span>视角：林清远</span>
              <span>场景：{selectedScene?.title ?? '当前场景'}</span>
              <span>{chapterDocument.lastEditedAt}</span>
              <span>{formatCount(chapterDocument.wordCount)} 字</span>
              <span>{isDirty ? '有未保存更改' : '已同步到本地项目'}</span>
            </div>
            <button
              type="button"
              className="writing-mini-button"
              aria-expanded={isStageMetaExpanded}
              onClick={() => setIsStageMetaExpanded((value) => !value)}
            >
              {isStageMetaExpanded ? '收起章节信息' : '章节信息'}
            </button>
          </div>
        </div>
        {isStageMetaExpanded ? (
          <div className="writing-stage__meta-panel">
            <div className="detail-list detail-list--compact">
              <div className="detail-list__item">
                <strong>章节目标</strong>
                <span>{chapterDocument.objective}</span>
              </div>
              <div className="detail-list__item">
                <strong>当前场景</strong>
                <span>{selectedScene?.title ?? '正文全章'}</span>
              </div>
              <div className="detail-list__item">
                <strong>当前聚焦</strong>
                <span>{selectedSceneGoal}</span>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="writing-canvas">
        <div className="writing-canvas__header">
          <div className="writing-canvas__status-strip">
            <span className="status-chip status-chip--muted status-chip--slim">
              当前选区 · {selectedScene?.title ?? '正文全章'}
            </span>
            <span className="writing-canvas__summary-text">{selectedSceneGoal}</span>
          </div>
          <div className="writing-canvas__header-actions">
            <button type="button" className="writing-mini-button writing-mini-button--primary" onClick={handleSave}>
              保存
            </button>
            <button
              type="button"
              className="writing-mini-button"
              onClick={() => onStartTask('请基于当前章节目标继续写下一段。')}
            >
              续写
            </button>
            <button
              type="button"
              className="writing-mini-button"
              aria-expanded={isCanvasHeaderExpanded}
              onClick={() => setIsCanvasHeaderExpanded((value) => !value)}
            >
              {isCanvasHeaderExpanded ? '收起工作条' : '展开工作条'}
            </button>
          </div>
        </div>
        {isCanvasHeaderExpanded ? (
          <div className="writing-canvas__header-panel">
            <div className="writing-canvas__status">
              <span className="status-chip status-chip--muted status-chip--slim">视角：林清远</span>
              <span className="status-chip status-chip--slim">{shell.sceneList.length} 个场景</span>
              <span className="status-chip status-chip--muted status-chip--slim">
                {isDirty ? '有未保存更改' : '正文已保存'}
              </span>
            </div>
            <div className="detail-list detail-list--compact">
              <div className="detail-list__item">
                <strong>章节目标</strong>
                <span>{chapterDocument.objective}</span>
              </div>
              <div className="detail-list__item">
                <strong>最后编辑</strong>
                <span>{chapterDocument.lastEditedAt}</span>
              </div>
              <div className="detail-list__item">
                <strong>当前字数</strong>
                <span>{formatCount(chapterDocument.wordCount)} 字</span>
              </div>
            </div>
          </div>
        ) : null}

        <ChapterEditor content={draftContent} onChange={setDraftContent} onSave={handleSave} />

        <div className="writing-canvas__footer">
          <button
            type="button"
            className="writing-canvas__footer-toggle"
            aria-expanded={isSelectionTrayExpanded}
            onClick={() => setIsSelectionTrayExpanded((value) => !value)}
          >
            <div className="writing-canvas__footer-brief">
              <span className="eyebrow">选区与操作</span>
              <strong>{selectedScene?.title ?? '正文全章'}</strong>
              <span>{selectedSceneGoal}</span>
            </div>
            <span className="writing-canvas__footer-hint">{isSelectionTrayExpanded ? '收起' : '展开'}</span>
          </button>
          {isSelectionTrayExpanded ? (
            <div className="writing-canvas__footer-panel">
              <div className="writing-canvas__selection">
                <span className="eyebrow">当前选区</span>
                <strong>{selectedScene?.title ?? '楼梯口的迟疑'}</strong>
                <p>{selectedSceneGoal}</p>
              </div>
              <div className="writing-canvas__scene-switcher">
                {shell.sceneList.map((scene) => (
                  <button
                    key={scene.sceneId}
                    type="button"
                    className={
                      scene.sceneId === selectedScene?.sceneId
                        ? 'writing-chip-button writing-chip-button--active'
                        : 'writing-chip-button'
                    }
                    onClick={() => onSelectScene(scene.sceneId)}
                  >
                    {scene.title}
                  </button>
                ))}
              </div>
              <div className="writing-canvas__secondary-actions">
                <button
                  type="button"
                  className="writing-chip-button"
                  onClick={() => onStartTask('请把当前开头改得更克制、更有压迫感。')}
                >
                  改写当前开头
                </button>
                <button
                  type="button"
                  className="writing-chip-button"
                  onClick={() => onStartTask('请检查本章是否有视角越界，并给出证据。')}
                >
                  检查视角
                </button>
                <button
                  type="button"
                  className="writing-chip-button"
                  onClick={() => onStartTask('请把当前段落可提炼的物件与规则沉淀成设定卡。')}
                >
                  沉淀设定
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="writing-dock">
        <button
          type="button"
          className="writing-dock__toggle"
          aria-expanded={isInsightDockExpanded}
          onClick={() => setIsInsightDockExpanded((value) => !value)}
        >
          <div className="writing-dock__brief">
            <span className="eyebrow">记忆抽屉</span>
            <strong>段落脉搏与章节记忆</strong>
            <span>{selectedSceneGoal}</span>
          </div>
          <span className="writing-canvas__footer-hint">{isInsightDockExpanded ? '收起' : '展开'}</span>
        </button>
        {isInsightDockExpanded ? (
          <div className="surface-grid surface-grid--two">
            <article className="surface-card surface-card--compact">
              <div className="surface-card__header">
                <span className="eyebrow">当前段落脉搏</span>
                <span className="status-chip status-chip--slim">正文选区</span>
              </div>
              <div className="serif-snippets">
                {paragraphs.slice(0, 2).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>

            <article className="surface-card surface-card--compact">
              <div className="surface-card__header">
                <span className="eyebrow">章节记忆</span>
                <span className="status-chip status-chip--muted status-chip--slim">本轮引用</span>
              </div>
              <div className="detail-list">
                <div className="detail-list__item">
                  <strong>场景目标</strong>
                  <span>{selectedSceneGoal}</span>
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
        ) : null}
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
  revisionRecords,
  proposal,
  chapterDocument,
  onStartTask,
  onApplyProposal,
  onRejectProposal,
  onUpdateIssue,
  onUndoRevisionRecord
}: {
  issue?: RevisionIssueDto
  revisionRecords: RevisionRecordDto[]
  proposal?: AgentFeedItemDto
  chapterDocument?: ChapterDocumentDto
  onStartTask: (intent: string) => void
  onApplyProposal: (proposalId: string) => void
  onRejectProposal: (proposalId: string) => void
  onUpdateIssue: (issueId: string, status: 'open' | 'deferred' | 'resolved') => void
  onUndoRevisionRecord: (recordId: string) => void
}) => {
  const paragraphs = excerptParagraphs(chapterDocument?.content)
  const evidence = issue ? buildIssueEvidence(issue) : []
  const plans = issue ? buildRevisionPlans(issue) : []
  const pendingProposal = proposal?.approvalStatus === 'pending' ? proposal : undefined
  const visibleRevisionRecords = [...revisionRecords].sort((left, right) => {
    const score = (item: RevisionRecordDto): number => {
      if (item.linkedIssueId && item.linkedIssueId === issue?.issueId) {
        return 0
      }

      if (item.chapterId === issue?.chapterId) {
        return 1
      }

      return 2
    }

    return score(left) - score(right)
  })

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

        {visibleRevisionRecords.length > 0 ? (
          <div className="revision-record-list">
            {visibleRevisionRecords.map((record) => (
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
        <strong>功能中心 / 拆书</strong>
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

const FeatureCenterStructurePanel = ({
  shell,
  activeFeatureTool,
  onFeatureToolChange
}: {
  shell: WorkspaceShellDto
  activeFeatureTool?: FeatureToolId
  onFeatureToolChange: (tool?: FeatureToolId) => void
}) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">功能列表</span>
      <button
        className={activeFeatureTool === 'analysis' ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
        onClick={() => onFeatureToolChange('analysis')}
      >
        <strong>拆书</strong>
        <span>{shell.analysisSamples.length > 0 ? `${shell.analysisSamples.length} 个样本已导入` : '导入 TXT / Markdown 自动开始拆解'}</span>
      </button>
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">接入方式</span>
      <div className="panel-note">
        <strong>文件直接导入</strong>
        <span>不需要手填标题、作者和评论，导入后会从文件名和正文自动推断样本信息。</span>
      </div>
      <div className="panel-note">
        <strong>支持格式</strong>
        <span>`.txt`、`.md`、`.markdown`</span>
      </div>
    </div>
  </div>
)

const AnalysisStructurePanel = ({
  overview,
  samples,
  selectedSampleId,
  onSelectSample,
  onCreateSampleRequest,
  isImporting
}: {
  overview: AnalysisOverviewDto
  samples: AnalysisSampleDto[]
  selectedSampleId?: string
  onSelectSample: (sampleId: string) => void
  onCreateSampleRequest: () => void
  isImporting: boolean
}) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">拆书样本</span>
      <button className="structure-button structure-button--primary" onClick={onCreateSampleRequest} disabled={isImporting}>
        + 导入 TXT / Markdown
      </button>
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">样本列表</span>
      {samples.length > 0 ? (
        samples.map((sample) => (
          <button
            key={sample.sampleId}
            className={sample.sampleId === selectedSampleId ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
            onClick={() => onSelectSample(sample.sampleId)}
          >
            <strong>{sample.title}</strong>
            <span>{sample.tags.slice(0, 2).join(' / ') || sample.sourceLabel} · {sample.comments.length} 条评论</span>
          </button>
        ))
      ) : (
        <div className="panel-note">
          <strong>还没有拆书样本</strong>
          <span>先导入一个 `.txt` 或 `.md` 文件，工作台才会开始建立参考模型。</span>
        </div>
      )}
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">聚合趋势</span>
      <div className="panel-note">
        <strong>{overview.sampleCount} 个样本</strong>
        <span>{overview.dominantTags.join(' / ') || '等待首个题材标签'}</span>
      </div>
      <div className="panel-note">
        <strong>当前启发</strong>
        <span>{overview.projectAngles[0] ?? '导入后会自动生成立项启发。'}</span>
      </div>
    </div>
  </div>
)

const FeatureCenterHomeSurface = ({
  shell,
  onFeatureToolChange
}: {
  shell: WorkspaceShellDto
  onFeatureToolChange: (tool?: FeatureToolId) => void
}) => (
  <div className="surface-stack">
    <section className="surface-hero surface-hero--feature-center">
      <div className="surface-hero__main">
        <span className="eyebrow">功能中心</span>
        <h1>把辅助能力集中收进一个独立入口</h1>
        <p>这里专门放插件式工具，不和首页、写作、设定、修订、发布混在一起。当前第一个功能就是拆书。</p>
        <div className="hero-metrics">
          <span>已启用功能 1 个</span>
          <span>拆书样本 {shell.analysisSamples.length}</span>
          <span>支持导入 TXT / Markdown</span>
        </div>
      </div>
    </section>

    <div className="surface-grid surface-grid--two">
      <button className="surface-card surface-card--selectable feature-tool-card" onClick={() => onFeatureToolChange('analysis')}>
        <div className="feature-tool-card__meta">
          <span className="eyebrow">第一个功能</span>
          <strong>拆书</strong>
        </div>
        <p>导入 `.txt`、`.md` 或 `.markdown` 文件，自动拆钩子、人物吸引力、节奏和风险信号，不需要手填一堆字段。</p>
        <div className="detail-list detail-list--compact">
          <div className="detail-list__item">
            <strong>当前状态</strong>
            <span>{shell.analysisSamples.length > 0 ? `${shell.analysisSamples.length} 个样本可继续对标` : '等待首个样本文件'}</span>
          </div>
          <div className="detail-list__item">
            <strong>默认流程</strong>
            <span>{'导入文件 -> 自动建模 -> 选择性回写项目'}</span>
          </div>
        </div>
      </button>

      <article className="surface-card">
        <span className="eyebrow">当前接入方式</span>
        <h2>直接导入文本文件</h2>
        <div className="detail-list">
          <div className="detail-list__item">
            <strong>支持格式</strong>
            <span>`.txt`、`.md`、`.markdown`</span>
          </div>
          <div className="detail-list__item">
            <strong>自动推断</strong>
            <span>标题、摘要和题材信号会从文件名与正文内容里自动生成。</span>
          </div>
          <div className="detail-list__item">
            <strong>回写策略</strong>
            <span>只把值得保留的结论回写到首页高亮、快捷动作和候选设定卡。</span>
          </div>
        </div>
      </article>
    </div>
  </div>
)

const AnalysisSurface = ({
  shell,
  overview,
  sample,
  isApplyingStrategy,
  onCreateSampleRequest,
  onApplyProjectStrategyProposal,
  onStartTask
}: {
  shell: WorkspaceShellDto
  overview: AnalysisOverviewDto
  sample?: AnalysisSampleDto
  isApplyingStrategy: boolean
  onCreateSampleRequest: () => void
  onApplyProjectStrategyProposal: (sampleId: string) => void
  onStartTask: (intent: string, surface?: NovelSurfaceId) => void
}) => (
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
  isApplyingAnalysisStrategy,
  isCreatingExportPackage,
  isGeneratingKnowledgeAnswer,
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
  onCreateKnowledgeAnswer
}: NovelWorkbenchProps) => {
  const activeChapterId = currentChapterId ?? chapterDocument?.chapterId ?? shell.project.currentChapterId
  const activeChapter =
    shell.chapterTree.find((chapter) => chapter.chapterId === activeChapterId) ?? shell.chapterTree[0]

  const [selectedSceneId, setSelectedSceneId] = useState(shell.sceneList[0]?.sceneId)
  const [selectedAnalysisSampleId, setSelectedAnalysisSampleId] = useState(shell.analysisSamples[0]?.sampleId)
  const [canonView, setCanonView] = useState<CanonView>('cards')
  const [selectedCanonCategory, setSelectedCanonCategory] = useState<CanonCategoryId>('all')
  const [selectedCanonCardId, setSelectedCanonCardId] = useState(shell.canonCandidates[0]?.cardId)
  const [selectedIssueId, setSelectedIssueId] = useState(shell.revisionIssues[0]?.issueId)
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false)
  const [isCreateProjectModalOpen, setCreateProjectModalOpen] = useState(false)
  const [isFocusMode, setFocusMode] = useState(false)
  const [createProjectForm, setCreateProjectForm] = useState<CreateProjectFormState>(buildDefaultCreateProjectForm)
  const isAnalysisToolActive = activeSurface === 'feature-center' && activeFeatureTool === 'analysis'
  const knowledge = useKnowledgeWorkbenchState(shell)
  const publish = usePublishWorkbenchState(shell, feedState.feed)
  const workspaceSearch = useWorkspaceSearch(shell.workspacePath)

  useEffect(() => {
    if (!shell.sceneList.some((scene) => scene.sceneId === selectedSceneId)) {
      setSelectedSceneId(shell.sceneList[0]?.sceneId)
    }
  }, [selectedSceneId, shell.sceneList])

  useEffect(() => {
    if (!shell.analysisSamples.some((sample) => sample.sampleId === selectedAnalysisSampleId)) {
      setSelectedAnalysisSampleId(shell.analysisSamples[0]?.sampleId)
    }
  }, [selectedAnalysisSampleId, shell.analysisSamples])

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

  const selectedIssue =
    shell.revisionIssues.find((issue) => issue.issueId === selectedIssueId) ?? shell.revisionIssues[0]
  const selectedAnalysisSample =
    shell.analysisSamples.find((sample) => sample.sampleId === selectedAnalysisSampleId) ?? shell.analysisSamples[0]
  const selectedRevisionProposal =
    feedState.feed.find(
      (item) =>
        item.kind === 'proposal' &&
        Boolean(item.proposalId) &&
        item.linkedIssueId === selectedIssue?.issueId &&
        item.approvalStatus === 'pending'
    ) ??
    feedState.feed.find(
      (item) =>
        item.kind === 'proposal' &&
        Boolean(item.proposalId) &&
        item.approvalStatus === 'pending'
    )
  const chapterStatusSummary = (() => {
    if (isAnalysisToolActive) {
      return `拆书 · ${shell.analysisSamples.length} 个样本`
    }

    if (activeSurface === 'feature-center') {
      return activeFeatureTool ? featureToolLabel[activeFeatureTool] : '功能中心'
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
    isAnalysisToolActive && selectedAnalysisSample
      ? [
          {
            id: `analysis-quick-hook-${selectedAnalysisSample.sampleId}`,
            label: '拆开篇钩子',
            prompt: `请拆一下样本《${selectedAnalysisSample.title}》的开篇钩子和章节承诺。`
          },
          {
            id: `analysis-quick-strategy-${selectedAnalysisSample.sampleId}`,
            label: '生成立项启发',
            prompt: `请基于样本《${selectedAnalysisSample.title}》为《${shell.project.title}》生成一版立项启发。`
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
        setSelectedAnalysisSampleId(item.entityId)
      }

      return
    }

    if (item.surface === 'analysis') {
      onFeatureToolChange('analysis')
      if (item.entityId) {
        setSelectedAnalysisSampleId(item.entityId)
      }
      return
    }

    if (item.surface === 'canon') {
      onSurfaceChange('canon')
      if (item.entityId) {
        setSelectedCanonCardId(item.entityId)
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
        setSelectedIssueId(item.entityId)
      }

      if (item.chapterId) {
        onInspectRevisionIssueChapter(item.chapterId)
      } else {
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
          <aside className={activeSurface === 'writing' ? 'structure-panel structure-panel--writing' : 'structure-panel'}>
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
              selectedSampleId={selectedAnalysisSample?.sampleId}
              onSelectSample={setSelectedAnalysisSampleId}
              onCreateSampleRequest={onImportAnalysisSample}
              isImporting={isImportingAnalysisSample}
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
              selectedPresetId={publish.selectedPresetId}
              onSelectPreset={publish.onSelectPreset}
            />
          ) : null}
          </aside>
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
              selectedSceneId={selectedSceneId}
              onSelectScene={setSelectedSceneId}
              onStartTask={onStartTask}
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
              isGeneratingAnswer={isGeneratingKnowledgeAnswer}
            />
          ) : null}
          {activeSurface === 'feature-center' && !activeFeatureTool ? (
            <FeatureCenterHomeSurface shell={shell} onFeatureToolChange={onFeatureToolChange} />
          ) : null}
          {isAnalysisToolActive ? (
            <AnalysisSurface
              shell={shell}
              overview={shell.analysisOverview}
              sample={selectedAnalysisSample}
              isApplyingStrategy={isApplyingAnalysisStrategy}
              onCreateSampleRequest={onImportAnalysisSample}
              onApplyProjectStrategyProposal={(sampleId) => onApplyProjectStrategyProposal({ sampleId })}
              onStartTask={onStartTask}
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
              revisionRecords={shell.revisionRecords}
              proposal={selectedRevisionProposal}
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

        {!isFocusMode ? (
          <AgentSidebar
            className={activeSurface === 'writing' ? 'agent-sidebar--writing' : undefined}
            mode={sidebarMode}
            onModeChange={onSidebarModeChange}
            header={feedState.header}
            tasks={feedState.tasks}
            feed={feedState.feed}
            diagnosticsByTaskId={feedState.diagnosticsByTaskId}
            quickActions={visibleQuickActions}
            onStartTask={onStartTask}
            onApplyProposal={onApplyProposal}
            onRejectProposal={onRejectProposal}
            onApplyPublishSynopsisDraft={handleApplyPublishSynopsisDraft}
            onApplyPublishNotesDraft={handleApplyPublishNotesDraft}
            onOpenPublishConfirm={handleOpenPublishConfirm}
          />
        ) : null}
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
