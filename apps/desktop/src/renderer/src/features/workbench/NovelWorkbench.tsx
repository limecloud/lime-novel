import { useEffect, useRef, useState } from 'react'
import type {
  AnalysisOverviewDto,
  AnalysisSampleDto,
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentTaskDto,
  ApplyProjectStrategyProposalInputDto,
  CanonCandidateDto,
  ChapterDocumentDto,
  ChapterListItemDto,
  CreateExportPackageInputDto,
  CreateProjectInputDto,
  ExportComparisonDto,
  ExportPresetDto,
  QuickActionDto,
  RevisionIssueDto,
  RevisionRecordDto,
  WorkspaceSearchItemDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'
import { ChapterEditor } from '../editor/ChapterEditor'
import { AgentSidebar } from '../agent-feed/AgentSidebar'
import type { AgentSidebarMode } from '../agent-feed/AgentSidebar'
import { desktopApi } from '../../lib/desktop-api'
import limeLogoUrl from '../../assets/logo-lime.png'
import { limeNovelBrand } from '../../app/branding'

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
  sidebarMode: AgentSidebarMode
  feedState: AgentFeedSnapshot
  activityLabel: string
  isCreatingProject: boolean
  isOpeningProject: boolean
  isImportingAnalysisSample: boolean
  isApplyingAnalysisStrategy: boolean
  isCreatingExportPackage: boolean
  onSurfaceChange: (surface: NovelSurfaceId) => void
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

const exportStatusLabel: Record<ExportPresetDto['status'], string> = {
  ready: '可导出',
  draft: '待补齐元数据'
}

const riskLevelLabel: Record<ExportComparisonDto['riskLevel'], string> = {
  low: '低风险',
  medium: '需复核',
  high: '高风险'
}

const surfaceLabel: Record<NovelSurfaceId, string> = {
  home: '首页',
  writing: '写作',
  analysis: '拆书',
  canon: '设定',
  revision: '修订',
  publish: '发布'
}

const searchItemKindLabel: Record<WorkspaceSearchItemDto['kind'], string> = {
  project: '项目',
  chapter: '章节',
  scene: '场景',
  'analysis-sample': '拆书样本',
  'canon-card': '设定卡',
  'revision-issue': '修订问题',
  'export-preset': '导出预设'
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

const suggestNextPublishVersion = (shell: WorkspaceShellDto): string => {
  if (!shell.recentExports[0] && !shell.project.lastPublishedAt) {
    return shell.project.releaseVersion
  }

  const previousVersion = shell.recentExports[0]?.versionTag ?? shell.project.releaseVersion
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(previousVersion)

  if (!match) {
    return previousVersion === 'v0.1.0' ? 'v0.1.1' : `${previousVersion}-next`
  }

  const major = Number.parseInt(match[1], 10)
  const minor = Number.parseInt(match[2], 10)
  const patch = Number.parseInt(match[3], 10)
  return `v${major}.${minor}.${patch + 1}`
}

const buildPublishChecklist = (preset: ExportPresetDto, shell: WorkspaceShellDto): string[] => [
  `当前预设：${preset.title} · ${preset.format.toUpperCase()}`,
  `卷册范围：${shell.chapterTree[0]?.order ?? 1} - ${shell.chapterTree.at(-1)?.order ?? 1} 章`,
  `当前项目版本：${shell.project.releaseVersion}${shell.project.lastPublishedAt ? ` · 上次导出 ${formatDateTime(shell.project.lastPublishedAt)}` : ' · 尚未正式导出'}`,
  '导出策略：始终生成新的版本快照，不覆盖已有导出目录。'
]

const buildPublishComparisonNotes = (
  shell: WorkspaceShellDto,
  input: { versionTag: string; synopsis: string; splitChapters: number; notes: string }
): string[] => {
  const latestExport = shell.recentExports[0]
  const previousVersion = latestExport?.versionTag ?? shell.project.releaseVersion
  const notes: string[] = []

  if (latestExport) {
    notes.push(`将从 ${latestExport.versionTag} 继续导出，本次目标版本为 ${input.versionTag}。`)
    notes.push(
      latestExport.splitChapters === input.splitChapters
        ? `平台拆章保持 ${input.splitChapters} 组，不改变上一次节奏切分。`
        : `平台拆章将从 ${latestExport.splitChapters} 调整为 ${input.splitChapters}，需再次确认连载节奏。`
    )
    notes.push(
      latestExport.synopsis.trim() === input.synopsis.trim()
        ? '平台简介与上一版保持一致，适合只发布正文修订。'
        : '平台简介已发生变化，建议在确认前快速核对悬念钩子是否仍然成立。'
    )
    if (latestExport.platformFeedback[0]) {
      notes.push(`上一版主要反馈：${latestExport.platformFeedback[0]}`)
    }
  } else {
    notes.push(`当前会创建首个正式导出版本 ${input.versionTag}。`)
    notes.push('这是第一次输出，建议先确认简介、拆章和发布备注，再执行导出。')
  }

  if (input.notes.trim()) {
    notes.push(`发布备注将写入 release-notes：${input.notes.trim()}`)
  } else {
    notes.push(`若不填写备注，会自动写入“${previousVersion} 后的当前导出快照”说明。`)
  }

  return notes
}

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

const formatSignedDelta = (value: number, unit = ''): string => {
  if (value === 0) {
    return `0${unit}`
  }

  return `${value > 0 ? '+' : ''}${value}${unit}`
}

const isPublishSynopsisDraftItem = (item: AgentFeedItemDto): boolean =>
  item.kind === 'evidence' &&
  item.title === '平台简介草案已生成' &&
  item.supportingLabel === '发布参数 / 可直接回填简介'

const isPublishNotesDraftItem = (item: AgentFeedItemDto): boolean =>
  item.kind === 'evidence' &&
  item.title === '发布备注草案已生成' &&
  item.supportingLabel === '发布参数 / 可直接回填备注'

const isPublishConfirmSuggestionItem = (item: AgentFeedItemDto): boolean =>
  item.kind === 'status' && item.title === '最终确认建议已生成'

const buildExpectedPublishAssets = (preset?: ExportPresetDto): Array<{ label: string; detail: string }> => {
  const manuscriptFile = preset?.format === 'markdown' ? 'manuscript.md' : 'prepack.md'

  return [
    {
      label: manuscriptFile,
      detail: '正文主包，按当前预设聚合章节内容。'
    },
    {
      label: 'synopsis.md',
      detail: '平台简介，随版本一起归档。'
    },
    {
      label: 'release-notes.md',
      detail: '发布备注，记录这一版的确认重点。'
    },
    {
      label: 'platform-feedback.md',
      detail: '平台反馈与预检提示，便于下次复盘。'
    },
    {
      label: 'manifest.json',
      detail: '版本、预设、资产路径与反馈清单。'
    }
  ]
}

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

const WorkspaceSearchModal = ({
  query,
  results,
  isSearching,
  error,
  onQueryChange,
  onClose,
  onSelect
}: {
  query: string
  results: WorkspaceSearchItemDto[]
  isSearching: boolean
  error?: string | null
  onQueryChange: (value: string) => void
  onClose: () => void
  onSelect: (item: WorkspaceSearchItemDto) => void
}) => (
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
          <h2>搜索章节、样本、设定与修订</h2>
          <p>直接搜索当前工作区里的正文、拆书样本、候选设定卡、修订问题和发布预设。</p>
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
          placeholder="例如：钟楼钥匙、视角、第一章、发布简介"
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
              <h3>正文、设定、修订、发布</h3>
              <p>搜索会命中章节正文、场景目标、拆书样本、候选设定卡、修订问题和发布预设。</p>
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
                  <span className="workspace-search-result__surface">{surfaceLabel[item.surface]}</span>
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

const PublishSurface = ({
  shell,
  preset,
  synopsis,
  synopsisDraft,
  notesDraft,
  confirmSuggestion,
  versionTag,
  notes,
  isExporting,
  isConfirmOpen,
  onSynopsisChange,
  onApplySynopsisDraft,
  onApplyNotesDraft,
  onVersionTagChange,
  onNotesChange,
  exportSplit,
  onExportSplitChange,
  onSelectPreset,
  onStartTask,
  onConfirmOpenChange,
  onCreateExportPackage
}: {
  shell: WorkspaceShellDto
  preset?: ExportPresetDto
  synopsis: string
  synopsisDraft?: AgentFeedItemDto
  notesDraft?: AgentFeedItemDto
  confirmSuggestion?: AgentFeedItemDto
  versionTag: string
  notes: string
  isExporting: boolean
  isConfirmOpen: boolean
  onSynopsisChange: (value: string) => void
  onApplySynopsisDraft: (value: string) => void
  onApplyNotesDraft: (value: string) => void
  onVersionTagChange: (value: string) => void
  onNotesChange: (value: string) => void
  exportSplit: string
  onExportSplitChange: (value: string) => void
  onSelectPreset: (presetId: string) => void
  onStartTask: (intent: string) => void
  onConfirmOpenChange: (open: boolean) => void
  onCreateExportPackage: (input: CreateExportPackageInputDto) => void
}) => {
  const checklist = preset ? buildPublishChecklist(preset, shell) : []
  const presetTitleById = new Map(shell.exportPresets.map((item) => [item.presetId, item.title]))
  const splitValue = Number.parseInt(exportSplit, 10) || 3
  const latestExport = shell.recentExports[0]
  const latestExportComparison = shell.latestExportComparison
  const expectedAssets = buildExpectedPublishAssets(preset)
  const comparisonNotes = buildPublishComparisonNotes(shell, {
    versionTag: versionTag.trim() || suggestNextPublishVersion(shell),
    synopsis,
    splitChapters: splitValue,
    notes
  })
  const canConfirmExport = Boolean(preset && synopsis.trim() && versionTag.trim())
  const isSynopsisDraftApplied = synopsisDraft?.body.trim() === synopsis.trim()
  const isNotesDraftApplied = notesDraft?.body.trim() === notes.trim()

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--publish">
        <div className="surface-hero__meta-bar">
          <span>当前版本：{shell.project.releaseVersion}</span>
          <span>建议版本：{suggestNextPublishVersion(shell)}</span>
          <span>{latestExport ? `最近导出：${latestExport.versionTag}` : '最近导出：暂无'}</span>
        </div>
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
                <strong>目标版本</strong>
                <span>{versionTag.trim() || suggestNextPublishVersion(shell)}</span>
              </div>
              <div className="detail-list__item">
                <strong>平台拆分</strong>
                <span>{splitValue} 个平台章节</span>
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
            <button
              className="inline-link"
              onClick={() => onStartTask('请解释最近两次发布差异，并指出最需要确认的变化。')}
            >
              让代理解读差异
            </button>
          </div>
          {synopsisDraft ? (
            <div className="stacked-note publish-draft-note">
              <strong>发布代理最新简介草案</strong>
              <p>{synopsisDraft.body}</p>
              <div className="hero-actions publish-draft-note__actions">
                <button
                  className="primary-button"
                  disabled={isSynopsisDraftApplied}
                  onClick={() => onApplySynopsisDraft(synopsisDraft.body)}
                >
                  {isSynopsisDraftApplied ? '已采用这版简介' : '采用这版简介'}
                </button>
                <button
                  className="ghost-button"
                  onClick={() => onStartTask('请再生成一版更像长篇小说连载文案的平台简介。')}
                >
                  再生成一版
                </button>
              </div>
            </div>
          ) : null}
          {notesDraft ? (
            <div className="stacked-note publish-draft-note">
              <strong>发布代理最新备注草案</strong>
              <p>{notesDraft.body}</p>
              <div className="hero-actions publish-draft-note__actions">
                <button
                  className="primary-button"
                  disabled={isNotesDraftApplied}
                  onClick={() => onApplyNotesDraft(notesDraft.body)}
                >
                  {isNotesDraftApplied ? '已采用这版备注' : '采用这版备注'}
                </button>
                <button
                  className="ghost-button"
                  onClick={() => onStartTask('请再生成一版更适合 release-notes 的发布备注，突出这一版的确认重点。')}
                >
                  再生成一版
                </button>
              </div>
            </div>
          ) : null}
          {confirmSuggestion ? (
            <div className="stacked-note publish-confirm-note">
              <strong>发布代理最终确认建议</strong>
              <p>{confirmSuggestion.body}</p>
              <div className="hero-actions publish-draft-note__actions">
                <button className="primary-button" onClick={() => onConfirmOpenChange(true)}>
                  直接打开确认单
                </button>
                <button className="ghost-button" onClick={() => onStartTask('请继续细化当前发布确认单，按风险高低列出复核顺序。')}>
                  细化确认顺序
                </button>
              </div>
            </div>
          ) : null}
          <label className="field-stack">
            <span>平台简介</span>
            <textarea value={synopsis} onChange={(event) => onSynopsisChange(event.target.value)} />
          </label>
          <label className="field-stack">
            <span>目标版本号</span>
            <input
              value={versionTag}
              onChange={(event) => onVersionTagChange(event.target.value)}
              placeholder={suggestNextPublishVersion(shell)}
            />
          </label>
          <label className="field-stack">
            <span>平台拆分章节数</span>
            <input value={exportSplit} onChange={(event) => onExportSplitChange(event.target.value)} />
          </label>
          <label className="field-stack">
            <span>发布备注</span>
            <textarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="写给未来自己的这版说明，会一起写入 release-notes。"
            />
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
              disabled={!canConfirmExport}
              onClick={() => onConfirmOpenChange(!isConfirmOpen)}
            >
              {isConfirmOpen ? '收起确认单' : '生成确认单'}
            </button>
            <button className="ghost-button" onClick={() => onStartTask('请帮我生成一版平台简介，并保留主线悬念。')}>
              生成平台简介
            </button>
            <button
              className="ghost-button"
              onClick={() => onStartTask('请生成一版发布备注，说明这次导出的确认重点与主线推进。')}
            >
              生成发布备注
            </button>
            <button
              className="ghost-button"
              onClick={() => onStartTask('请比较最新版本与当前发布草案的差异，并指出还需要确认的风险。')}
            >
              让发布代理做最终复核
            </button>
          </div>
        </article>
      </div>

      <article className="surface-card">
        <div className="surface-card__header">
          <div>
            <span className="eyebrow">资产检查</span>
            <h3>平台化资产与最近真实产物</h3>
          </div>
          <span className="status-chip status-chip--muted">
            {latestExport ? `${latestExport.fileCount} 个最近产物` : `${expectedAssets.length} 个待生成产物`}
          </span>
        </div>
        <div className="publish-assets">
          <div className="publish-assets__panel">
            <strong>本次确认后将生成</strong>
            <div className="publish-assets__list">
              {expectedAssets.map((asset) => (
                <div key={asset.label} className="publish-asset-item">
                  <div>
                    <strong>{asset.label}</strong>
                    <p>{asset.detail}</p>
                  </div>
                  <span>待生成</span>
                </div>
              ))}
            </div>
          </div>
          <div className="publish-assets__panel">
            <strong>最近一次真实导出资产</strong>
            {latestExport ? (
              <div className="publish-assets__list">
                {latestExport.files.map((filePath) => (
                  <div key={filePath} className="publish-asset-item">
                    <div>
                      <strong>{filePath.split(/[\\/]/).at(-1) ?? filePath}</strong>
                      <p title={filePath}>{summarizePath(filePath)}</p>
                    </div>
                    <span>已生成</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>还没有真实导出资产</strong>
                <span>完成首个导出后，这里会列出 manifest 里记录的实际产物清单。</span>
              </div>
            )}
          </div>
        </div>
      </article>

      <article className="surface-card">
        <div className="surface-card__header">
          <div>
            <span className="eyebrow">版本比较</span>
            <h3>最近两次真实导出差异</h3>
          </div>
          <span
            className={`severity-badge severity-badge--${
              latestExportComparison ? latestExportComparison.riskLevel : 'low'
            }`}
          >
            {latestExportComparison ? riskLevelLabel[latestExportComparison.riskLevel] : '暂无历史'}
          </span>
        </div>

        {latestExportComparison ? (
          <div className="publish-comparison">
            <div className="publish-comparison__summary">
              <strong>
                {latestExportComparison.previousVersionTag} {'->'} {latestExportComparison.currentVersionTag}
              </strong>
              <span>
                {formatDateTime(latestExportComparison.previousGeneratedAt)} {'->'}{' '}
                {formatDateTime(latestExportComparison.currentGeneratedAt)}
              </span>
              <p>{latestExportComparison.summary}</p>
            </div>

            <div className="publish-comparison__metrics">
              <div className="publish-comparison__metric">
                <span>简介变化</span>
                <strong>{formatSignedDelta(latestExportComparison.synopsisDelta, ' 字')}</strong>
              </div>
              <div className="publish-comparison__metric">
                <span>拆章变化</span>
                <strong>{formatSignedDelta(latestExportComparison.splitChaptersDelta, ' 组')}</strong>
              </div>
              <div className="publish-comparison__metric">
                <span>资产变化</span>
                <strong>{formatSignedDelta(latestExportComparison.fileCountDelta, ' 个')}</strong>
              </div>
            </div>

            <div className="publish-comparison__grid">
              <div className="stacked-notes">
                <div className="stacked-note">
                  <strong>变更项</strong>
                  <p>
                    {latestExportComparison.changedFields.length > 0
                      ? latestExportComparison.changedFields.join('、')
                      : '这两版的发布参数保持一致。'}
                  </p>
                </div>
                {latestExportComparison.addedFeedback.map((item) => (
                  <div key={item} className="stacked-note">
                    <strong>新增反馈</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>

              <div className="stacked-notes">
                {latestExportComparison.removedFeedback.length > 0 ? (
                  latestExportComparison.removedFeedback.map((item) => (
                    <div key={item} className="stacked-note">
                      <strong>已消除反馈</strong>
                      <p>{item}</p>
                    </div>
                  ))
                ) : (
                  <div className="stacked-note">
                    <strong>已消除反馈</strong>
                    <p>最近两次导出之间没有移除的反馈项，说明当前风险仍需继续关注。</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>还不足以比较版本</strong>
            <span>至少需要两次真实导出后，这里才会自动生成参数差异与反馈变化。</span>
          </div>
        )}
      </article>

      {isConfirmOpen ? (
        <article className="surface-card">
          <div className="surface-card__header">
            <div>
              <span className="eyebrow">最终确认</span>
              <h3>作者确认后再执行导出</h3>
            </div>
            <span className="status-chip">{versionTag.trim() || suggestNextPublishVersion(shell)}</span>
          </div>
          <div className="surface-grid surface-grid--two">
            <div className="detail-list">
              <div className="detail-list__item">
                <strong>版本回写</strong>
                <span>
                  这次会把 {versionTag.trim() || suggestNextPublishVersion(shell)} 与导出时间回写到项目配置中。
                </span>
              </div>
              <div className="detail-list__item">
                <strong>输出资产</strong>
                <span>会生成正文包、简介、发布备注、平台反馈与 manifest，不覆盖已有目录。</span>
              </div>
              <div className="detail-list__item">
                <strong>上一个版本</strong>
                <span>{latestExport ? `${latestExport.versionTag} · ${formatDateTime(latestExport.generatedAt)}` : '暂无历史版本'}</span>
              </div>
            </div>
            <div className="stacked-notes">
              {comparisonNotes.map((item) => (
                <div key={item} className="stacked-note">
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-actions">
            <button
              className="primary-button"
              disabled={!preset || !synopsis.trim() || !versionTag.trim() || isExporting}
              onClick={() =>
                preset &&
                onCreateExportPackage({
                  presetId: preset.presetId,
                  synopsis,
                  splitChapters: splitValue,
                  versionTag: versionTag.trim(),
                  notes
                })
              }
            >
              {isExporting ? '正在导出...' : '确认并导出'}
            </button>
            <button className="ghost-button" onClick={() => onConfirmOpenChange(false)}>
              继续调整参数
            </button>
          </div>
        </article>
      ) : null}

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
                  <strong>
                    {item.versionTag} · {presetTitleById.get(item.presetId) ?? item.presetId}
                  </strong>
                  <span>{formatDateTime(item.generatedAt)}</span>
                </div>
                <p>{item.platformFeedback[0] ?? '该版本未记录平台反馈摘要。'}</p>
                <p>
                  简介长度 {item.synopsis.trim().length} 字 · 拆章 {item.splitChapters} 组 · 产物 {item.fileCount} 个
                </p>
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
      <button className="panel-list-button" onClick={() => onSurfaceChange('analysis')}>
        <strong>拆书代理</strong>
        <span>{shell.analysisSamples.length > 0 ? `${shell.analysisSamples.length} 个样本可继续对标` : '先导入爆款样本开始建模'}</span>
      </button>
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
      <div className="panel-note">
        <strong>最近资产</strong>
        <span>
          {shell.recentExports[0]
            ? `${shell.recentExports[0].fileCount} 个产物 · ${shell.recentExports[0].versionTag}`
            : '等待首次正式导出'}
        </span>
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
  sidebarMode,
  feedState,
  activityLabel,
  isCreatingProject,
  isOpeningProject,
  isImportingAnalysisSample,
  isApplyingAnalysisStrategy,
  isCreatingExportPackage,
  onSurfaceChange,
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
  onCreateExportPackage
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
  const [selectedPresetId, setSelectedPresetId] = useState(shell.exportPresets[0]?.presetId)
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false)
  const [isCreateProjectModalOpen, setCreateProjectModalOpen] = useState(false)
  const [isSearchModalOpen, setSearchModalOpen] = useState(false)
  const [isFocusMode, setFocusMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<WorkspaceSearchItemDto[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setSearching] = useState(false)
  const [createProjectForm, setCreateProjectForm] = useState<CreateProjectFormState>(buildDefaultCreateProjectForm)
  const [isPublishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [publishSynopsis, setPublishSynopsis] = useState(
    `《${shell.project.title}》聚焦林清远在钟楼与旧雨季之间追索父亲失踪真相的过程，保留悬疑与都市奇幻的双重张力。`
  )
  const [exportSplit, setExportSplit] = useState('3')
  const [publishVersionTag, setPublishVersionTag] = useState(suggestNextPublishVersion(shell))
  const [publishNotes, setPublishNotes] = useState('')
  const searchRequestIdRef = useRef(0)

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
    setPublishVersionTag(suggestNextPublishVersion(shell))
    setPublishNotes(
      shell.recentExports[0]
        ? `延续 ${shell.recentExports[0].versionTag} 之后的当前发布快照，重点确认最新正文与简介差异。`
        : `首个正式导出版本，准备围绕《${shell.project.title}》建立发布基线。`
    )
  }, [shell.project.title, shell.workspacePath, shell.recentExports[0]?.exportId])

  useEffect(() => {
    setPublishConfirmOpen(false)
  }, [shell.workspacePath, shell.recentExports[0]?.exportId])

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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchModalOpen(true)
        return
      }

      if (event.key === 'Escape') {
        if (isSearchModalOpen) {
          setSearchModalOpen(false)
          return
        }

        if (isFocusMode) {
          setFocusMode(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [isFocusMode, isSearchModalOpen])

  useEffect(() => {
    if (!isSearchModalOpen) {
      setSearchQuery('')
      setSearchResults([])
      setSearchError(null)
      setSearching(false)
      return
    }

    const nextQuery = searchQuery.trim()

    if (!nextQuery) {
      setSearchResults([])
      setSearchError(null)
      setSearching(false)
      return
    }

    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId
    const timer = window.setTimeout(() => {
      setSearching(true)
      void desktopApi.workspace
        .searchWorkspace({
          query: nextQuery,
          limit: 16
        })
        .then((result) => {
          if (searchRequestIdRef.current !== requestId) {
            return
          }

          setSearchResults(result.items)
          setSearchError(null)
        })
        .catch((error) => {
          if (searchRequestIdRef.current !== requestId) {
            return
          }

          setSearchResults([])
          setSearchError(error instanceof Error ? error.message : '当前工作区暂时无法完成搜索。')
        })
        .finally(() => {
          if (searchRequestIdRef.current === requestId) {
            setSearching(false)
          }
        })
    }, 180)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isSearchModalOpen, searchQuery, shell.workspacePath])

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
  const latestPublishSynopsisDraft = feedState.feed.find(isPublishSynopsisDraftItem)
  const latestPublishNotesDraft = feedState.feed.find(isPublishNotesDraftItem)
  const latestPublishConfirmSuggestion = feedState.feed.find(isPublishConfirmSuggestionItem)
  const selectedPreset =
    shell.exportPresets.find((preset) => preset.presetId === selectedPresetId) ?? shell.exportPresets[0]
  const chapterStatusSummary =
    activeSurface === 'analysis'
      ? `爆款样本 ${shell.analysisSamples.length} 个`
      : activeChapter
        ? `第 ${activeChapter.order} 章 · ${activeChapter.title}`
        : '未选择章节'
  const visibleQuickActions: QuickActionDto[] =
    activeSurface === 'analysis' && selectedAnalysisSample
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
    setPublishSynopsis(value)
  }

  const handleApplyPublishNotesDraft = (value: string): void => {
    ensurePublishSurface()
    setPublishNotes(value)
  }

  const handleOpenPublishConfirm = (): void => {
    ensurePublishSurface()
    setPublishConfirmOpen(true)
  }

  const handleSearchSelect = (item: WorkspaceSearchItemDto): void => {
    setSearchModalOpen(false)

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

    if (item.surface === 'analysis') {
      onSurfaceChange('analysis')
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
      setSelectedPresetId(item.entityId)
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
            onClick={() => setSearchModalOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isSearchModalOpen}
            title="搜索当前项目"
          >
            <span className="command-trigger__label">搜索章节 / 样本 / 设定 / 修订</span>
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
          {activeSurface === 'analysis' ? (
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
              selectedPresetId={selectedPreset?.presetId}
              onSelectPreset={setSelectedPresetId}
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
          {activeSurface === 'analysis' ? (
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
              preset={selectedPreset}
              synopsis={publishSynopsis}
              synopsisDraft={latestPublishSynopsisDraft}
              notesDraft={latestPublishNotesDraft}
              confirmSuggestion={latestPublishConfirmSuggestion}
              versionTag={publishVersionTag}
              notes={publishNotes}
              isExporting={isCreatingExportPackage}
              isConfirmOpen={isPublishConfirmOpen}
              onSynopsisChange={setPublishSynopsis}
              onApplySynopsisDraft={handleApplyPublishSynopsisDraft}
              onApplyNotesDraft={handleApplyPublishNotesDraft}
              onVersionTagChange={setPublishVersionTag}
              onNotesChange={setPublishNotes}
              exportSplit={exportSplit}
              onExportSplitChange={setExportSplit}
              onSelectPreset={setSelectedPresetId}
              onStartTask={onStartTask}
              onConfirmOpenChange={setPublishConfirmOpen}
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
          <span className="status-bar__label">当前章节</span>
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

      {isSearchModalOpen ? (
        <WorkspaceSearchModal
          query={searchQuery}
          results={searchResults}
          isSearching={isSearching}
          error={searchError}
          onQueryChange={setSearchQuery}
          onClose={() => setSearchModalOpen(false)}
          onSelect={handleSearchSelect}
        />
      ) : null}
    </div>
  )
}
