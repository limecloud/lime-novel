import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { SQLInputValue } from 'node:sqlite'
import type {
  AgentFeedItemDto,
  AgentTaskDto,
  ApplyProposalResultDto,
  ChapterDocumentDto,
  CommitCanonCardInputDto,
  CommitCanonCardResultDto,
  CreateProjectInputDto,
  CreateProjectResultDto,
  CreateExportPackageInputDto,
  CreateExportPackageResultDto,
  ExportHistoryDto,
  ExportPresetDto,
  ProjectRepositoryPort,
  QuickActionDto,
  RevisionIssueDto,
  SaveChapterInputDto,
  SaveChapterResultDto,
  UpdateRevisionIssueInputDto,
  UpdateRevisionIssueResultDto,
  UpdateWorkspaceContextInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import { createId } from '@lime-novel/shared-kernel'
import type { NovelSurfaceId, RiskLevel, TaskStatus } from '@lime-novel/domain-novel'

type ChapterSceneConfig = {
  sceneId: string
  order: number
  title: string
  goal: string
  status: string
}

type ChapterConfig = {
  chapterId: string
  file: string
  volumeId?: string
  order: number
  title: string
  summary: string
  status: string
  wordCount: number
  objective: string
  lastEditedAt: string
  scenes: ChapterSceneConfig[]
}

type VolumeConfig = {
  volumeId: string
  order: number
  title: string
  summary: string
}

type HomeHighlightConfig = {
  title: string
  detail: string
}

type NovelProjectConfig = {
  schemaVersion: number
  projectId: string
  title: string
  subtitle: string
  status: string
  language: string
  genre: string
  premise: string
  currentSurface: NovelSurfaceId
  currentChapterId: string
  volumes: VolumeConfig[]
  chapters: ChapterConfig[]
  homeHighlights: HomeHighlightConfig[]
  quickActions: QuickActionDto[]
}

type CanonCandidateRow = {
  card_id: string
  name: string
  kind: string
  summary: string
  visibility: string
  evidence: string
}

type RevisionIssueRow = {
  issue_id: string
  chapter_id: string
  title: string
  summary: string
  severity: RevisionIssueDto['severity']
}

type RevisionIssueStateRow = {
  issue_id: string
  status: RevisionIssueDto['status']
  updated_at: string
}

type ExportPresetRow = {
  preset_id: string
  title: string
  format: ExportPresetDto['format']
  status: ExportPresetDto['status']
  summary: string
}

type AgentTaskRow = {
  task_id: string
  title: string
  summary: string
  status: TaskStatus
  surface: NovelSurfaceId
  agent_type: AgentTaskDto['agentType']
}

type AgentFeedRow = {
  item_id: string
  task_id: string
  kind: AgentFeedItemDto['kind']
  title: string
  body: string
  supporting_label: string | null
  severity: RiskLevel | null
  proposal_id: string | null
  approval_id: string | null
  diff_before: string | null
  diff_after: string | null
  created_at: string
}

type ProposalRow = {
  proposal_id: string
  chapter_id: string
  full_content: string
}

type RuntimeSeed = {
  canonCandidates: CanonCandidateRow[]
  revisionIssues: RevisionIssueRow[]
  exportPresets: ExportPresetRow[]
  agentTasks: AgentTaskRow[]
  agentFeed: AgentFeedRow[]
  proposals: ProposalRow[]
}

const DEFAULT_WORKSPACE_ROOT = resolve(process.cwd(), 'playground/demo-project')

const NAVIGATION = [
  { id: 'home', label: '首页', description: '恢复现场与项目健康度' },
  { id: 'writing', label: '写作', description: '章节树、场景与正文编辑' },
  { id: 'canon', label: '设定', description: '候选卡、关系与时间线' },
  { id: 'revision', label: '修订', description: '问题队列、证据与差异' },
  { id: 'publish', label: '发布', description: '导出预设与平台准备' }
] as const

const HOME_HEADER = {
  currentAgent: '项目总控代理',
  activeSubAgent: '章节代理',
  surface: 'home' as const,
  memorySources: ['项目摘要', '第 12 章', '人物画像', '最近任务'],
  riskLevel: 'medium' as const
}

const BASE_EXPORT_PRESETS: ExportPresetRow[] = [
  {
    preset_id: 'export-md',
    title: '长稿 Markdown',
    format: 'markdown',
    status: 'ready',
    summary: '保留章节标题、场景分隔与批注锚点。'
  },
  {
    preset_id: 'export-epub',
    title: '连载 EPUB 预设',
    format: 'epub',
    status: 'draft',
    summary: '适合阶段性内测，不含平台元数据。'
  }
]

const BLANK_RUNTIME_SEED: RuntimeSeed = {
  canonCandidates: [],
  revisionIssues: [],
  exportPresets: BASE_EXPORT_PRESETS,
  agentTasks: [
    {
      task_id: 'task-project-bootstrap',
      title: '项目已创建',
      summary: '项目总控代理已经装配基础结构，建议先补第一章目标，再继续正文开场。',
      status: 'completed',
      surface: 'home',
      agent_type: 'project'
    }
  ],
  agentFeed: [
    {
      item_id: 'feed-project-bootstrap',
      task_id: 'task-project-bootstrap',
      kind: 'status',
      title: '新的小说项目已经就绪',
      body: '你现在可以先补第一章目标、主角处境和第一处冲突，再进入写作工作面。',
      supporting_label: '首页 / 项目总控代理',
      severity: null,
      proposal_id: null,
      approval_id: null,
      diff_before: null,
      diff_after: null,
      created_at: '2026-04-02T12:00:00.000Z'
    }
  ],
  proposals: []
}

const DEMO_RUNTIME_SEED: RuntimeSeed = {
  canonCandidates: [
    {
      card_id: 'canon-key',
      name: '钟楼钥匙',
      kind: 'item',
      summary: '一把带旧铜味的长柄钥匙，只会在大雨或钟鸣时发冷。',
      visibility: 'candidate',
      evidence: '第 12 章反复出现，但尚未沉淀为正式设定卡。'
    },
    {
      card_id: 'canon-character-lin',
      name: '林清远',
      kind: 'character',
      summary: '主角，擅长把恐惧藏在动作细节里，不轻易直接承认情绪。',
      visibility: 'confirmed',
      evidence: '第 1 - 12 章人物画像一致。'
    }
  ],
  revisionIssues: [
    {
      issue_id: 'issue-pov-drift',
      chapter_id: 'chapter-12',
      title: '视角焦点短暂漂移',
      summary: '有一处句子泄露了林清远当下不可能知道的钟楼内部信息。',
      severity: 'high'
    },
    {
      issue_id: 'issue-pace-flat',
      chapter_id: 'chapter-12',
      title: '悬念推进还不够陡',
      summary: '进门前的心理活动还可以更具体一点，否则动作落点不够强。',
      severity: 'medium'
    }
  ],
  exportPresets: BASE_EXPORT_PRESETS,
  agentTasks: [
    {
      task_id: 'task-home-resume',
      title: '恢复现场',
      summary: '把最近写作上下文和后台结果合并成可继续工作的建议面。',
      status: 'completed',
      surface: 'home',
      agent_type: 'project'
    },
    {
      task_id: 'task-canon-sync',
      title: '设定候选提取',
      summary: '从第 12 章抽取新物件与人物状态变化。',
      status: 'completed',
      surface: 'canon',
      agent_type: 'canon'
    },
    {
      task_id: 'task-revision-scan',
      title: '连续性预扫',
      summary: '确认视角边界与节奏是否偏平。',
      status: 'waiting_approval',
      surface: 'revision',
      agent_type: 'revision'
    }
  ],
  agentFeed: [
    {
      item_id: 'feed-home-resume',
      task_id: 'task-home-resume',
      kind: 'status',
      title: '项目总控代理已恢复现场',
      body: '建议先继续第 12 章，再处理修订代理刚发现的高优先问题。',
      supporting_label: '首页 / 建议视图',
      severity: null,
      proposal_id: null,
      approval_id: null,
      diff_before: null,
      diff_after: null,
      created_at: '2026-04-02T11:40:00.000Z'
    },
    {
      item_id: 'feed-canon-hit',
      task_id: 'task-canon-sync',
      kind: 'evidence',
      title: '候选设定“钟楼钥匙”已命中',
      body: '物件已经出现两次以上，并开始承载情绪与主线信息，适合提升为正式卡片。',
      supporting_label: '第 12 章 / 物件候选',
      severity: null,
      proposal_id: null,
      approval_id: null,
      diff_before: null,
      diff_after: null,
      created_at: '2026-04-02T11:42:00.000Z'
    },
    {
      item_id: 'feed-rewrite-opening',
      task_id: 'task-revision-scan',
      kind: 'proposal',
      title: '先从开头三段做更克制的悬念推进',
      body: '不用提前揭示门后的信息，只增强感官线索和心理阻力，能更稳地把悬念推进到下一章。',
      supporting_label: '写作工作面可直接应用',
      severity: null,
      proposal_id: 'proposal-rewrite-opening',
      approval_id: null,
      diff_before: '她把钥匙按进锁孔，门还是没有开。',
      diff_after: '林清远把钥匙按进锁孔，金属先发出一声潮湿的轻响。',
      created_at: '2026-04-02T11:46:00.000Z'
    }
  ],
  proposals: [
    {
      proposal_id: 'proposal-rewrite-opening',
      chapter_id: 'chapter-12',
      full_content: `# 第十二章 钥匙进锁之前

林清远把钥匙按进锁孔，金属先发出一声潮湿的轻响，像某段迟迟不肯说破的旧事在门后换气。

她没有立刻转动，只让指尖贴着冰凉的齿纹往下滑。雨水顺着外套袖口往腕骨里钻，冷得她差一点松手。可真正让她停住的不是冷，而是钟楼里那股熟悉得过分的旧铜味。它像父亲离家前最后一次抱她时，袖口蹭过她额角的气味，只是更潮，也更旧。

楼梯上方没有声音，整座塔像把呼吸憋进了砖缝。她忽然明白，自己拖延的从来不是开门这一个动作，而是门开之后必须承认的事实：这些年她追的也许不是一个失踪者，而是一场被全城默许的沉默。

她终于转动钥匙。
`
    }
  ]
}

const formatTimestamp = (date = new Date()): string => {
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const min = `${date.getMinutes()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

const countNarrativeChars = (content: string): number => content.replace(/\s+/g, '').length

const normalizeNarrativeContent = (content: string): string => `${content.trimEnd()}\n`

const sanitizeFileSegment = (value: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized || 'lime-novel-project'
}

const buildProjectQuickActions = (template: CreateProjectInputDto['template']): QuickActionDto[] =>
  template === 'mystery'
    ? [
        {
          id: 'quick-scene-hook',
          label: '推进悬念',
          prompt: '请基于当前章节目标，把开场的悬念钩子再往前提半步。'
        },
        {
          id: 'quick-clue-card',
          label: '沉淀线索',
          prompt: '把当前章里值得长期追踪的线索、物件和规则抽成候选卡。'
        },
        {
          id: 'quick-risk-scan',
          label: '检查视角',
          prompt: '检查本章是否出现视角泄露、信息过早暴露或节奏偏平。'
        }
      ]
    : [
        {
          id: 'quick-outline',
          label: '补第一章目标',
          prompt: '请根据当前项目 premise，补齐第一章的冲突、主角欲望和收束句落点。'
        },
        {
          id: 'quick-canon',
          label: '先建设定卡',
          prompt: '请帮我先建立主角、地点和规则三类基础设定卡草案。'
        },
        {
          id: 'quick-revision',
          label: '检查开场',
          prompt: '请检查当前开场是否已经建立人物处境、冲突与可持续悬念。'
        }
      ]

const buildProjectHighlights = (template: CreateProjectInputDto['template']): HomeHighlightConfig[] =>
  template === 'mystery'
    ? [
        {
          title: '恢复写作',
          detail: '先把第一章开场镜头和第一处异样感写出来，再决定是否推进到明确线索。'
        },
        {
          title: '后台建议',
          detail: '项目总控代理已装配悬念推进、线索沉淀和开场诊断三类默认能力。'
        },
        {
          title: '项目健康度',
          detail: '新项目已建立基础结构，接下来最重要的是确定主角欲望与首章冲突。'
        }
      ]
    : [
        {
          title: '恢复写作',
          detail: '先补第一章目标和主角处境，再把开场场景写成可继续推进的正文入口。'
        },
        {
          title: '后台建议',
          detail: '项目总控代理已装配项目初始化、设定起卡和第一章节奏检查。'
        },
        {
          title: '项目健康度',
          detail: '项目结构已准备好，当前最需要沉淀的是 premise、第一章目标和卷册主线。'
        }
      ]

const buildInitialChapterContent = ({
  title,
  premise,
  template
}: CreateProjectInputDto): string =>
  template === 'mystery'
    ? `# 第一章 雨刚落下时

这里是《${title}》的第一章草稿。

你可以先写下：
- 主角正在试图隐瞒什么
- 第一个反常细节是什么
- 本章结束时读者必须想继续追下去的那一瞬间

核心 premise：
${premise.trim() || '在这里补上你的主线秘密、人物欲望和第一次危险靠近。'}
`
    : `# 第一章 开篇

这里是《${title}》的第一章草稿。

建议先补三件事：
- 主角此刻最想解决的问题
- 这个世界里最不对劲的一处细节
- 读者读完本章后必须记住的一句或一个动作

项目 premise：
${premise.trim() || '在这里写下故事的主线冲突、人物欲望和世界规则入口。'}
`

const buildNovelProjectConfig = (
  input: CreateProjectInputDto,
  initialChapterContent: string
): NovelProjectConfig => {
  const projectId = createId('proj')
  const volumeId = createId('volume')
  const chapterId = createId('chapter')
  const sceneId = createId('scene')
  const chapterTitle = input.template === 'mystery' ? '雨刚落下时' : '开篇'
  const chapterSummary =
    input.template === 'mystery'
      ? '让第一处异常感和主角的压抑反应同时出现，建立持续推进的悬念。'
      : '用一个稳定可继续的开场场景，建立主角处境、冲突与第一步行动。'
  const chapterObjective =
    input.template === 'mystery'
      ? '让读者先感到不对劲，再看见主角为何非继续靠近不可。'
      : '建立人物、世界和冲突入口，让第一章能自然接到下一场景。'
  const timestamp = formatTimestamp()

  return {
    schemaVersion: 1,
    projectId,
    title: input.title.trim(),
    subtitle: input.template === 'mystery' ? 'AI 代理协作悬疑小说项目' : 'AI 代理协作小说项目',
    status: 'planning',
    language: 'zh-CN',
    genre: input.genre.trim() || '待定题材',
    premise: input.premise.trim() || '请补充作品 premise，让代理能围绕主线持续协作。',
    currentSurface: 'home',
    currentChapterId: chapterId,
    volumes: [
      {
        volumeId,
        order: 1,
        title: '第一卷',
        summary: input.template === 'mystery' ? '先建立秘密、线索和人物驱动力。' : '先建立世界、人物和主线冲突。'
      }
    ],
    chapters: [
      {
        chapterId,
        file: 'manuscript/chapters/001-opening.md',
        volumeId,
        order: 1,
        title: chapterTitle,
        summary: chapterSummary,
        status: 'draft',
        wordCount: countNarrativeChars(normalizeNarrativeContent(initialChapterContent)),
        objective: chapterObjective,
        lastEditedAt: timestamp,
        scenes: [
          {
            sceneId,
            order: 1,
            title: input.template === 'mystery' ? '第一处异样感' : '开场镜头',
            goal:
              input.template === 'mystery'
                ? '让异常感、人物反应和继续追下去的理由同时出现。'
                : '让主角处境、当前动作和下一步目标同时成立。',
            status: 'planned'
          }
        ]
      }
    ],
    homeHighlights: buildProjectHighlights(input.template),
    quickActions: buildProjectQuickActions(input.template)
  }
}

const resolveRuntimeSeed = (config: NovelProjectConfig): RuntimeSeed =>
  config.projectId === 'proj-lime-novel' ? DEMO_RUNTIME_SEED : BLANK_RUNTIME_SEED

const ensureWorkspacePath = async (baseDirectory: string, title: string): Promise<string> => {
  await mkdir(baseDirectory, { recursive: true })

  const baseSlug = sanitizeFileSegment(title)
  let attempt = 0
  let candidate = join(baseDirectory, baseSlug)

  while (existsSync(candidate)) {
    attempt += 1
    candidate = join(baseDirectory, `${baseSlug}-${attempt}`)
  }

  return candidate
}

const slugFromCard = (cardId: string): string => cardId.replace(/^canon-/, '')

const canonDirectoryByKind = (kind: string): string => {
  if (kind === 'character') {
    return 'characters'
  }

  if (kind === 'location') {
    return 'locations'
  }

  if (kind === 'rule') {
    return 'rules'
  }

  if (kind === 'timeline-event') {
    return 'timeline'
  }

  return 'items'
}

const loadExportHistory = async (workspaceRoot: string): Promise<ExportHistoryDto[]> => {
  const exportsDir = join(workspaceRoot, 'exports')

  try {
    const entries = await readdir(exportsDir, { withFileTypes: true })
    const exportDirs = entries.filter((entry) => entry.isDirectory()).sort((left, right) => right.name.localeCompare(left.name))

    const items = await Promise.all(
      exportDirs.map(async (entry) => {
        const manifestPath = join(exportsDir, entry.name, 'manifest.json')

        try {
          const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
            preset?: { id?: string }
            generatedAt?: string
          }

          return {
            exportId: entry.name,
            presetId: manifest.preset?.id ?? 'unknown',
            generatedAt: manifest.generatedAt ?? entry.name,
            outputDir: join(exportsDir, entry.name),
            manifestPath
          } satisfies ExportHistoryDto
        } catch {
          return {
            exportId: entry.name,
            presetId: 'unknown',
            generatedAt: entry.name,
            outputDir: join(exportsDir, entry.name),
            manifestPath
          } satisfies ExportHistoryDto
        }
      })
    )

    return items.slice(0, 8)
  } catch {
    return []
  }
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8')) as T

const createRuntimeDatabase = (dbPath: string): DatabaseSync => {
  const database = new DatabaseSync(dbPath)

  database.exec(`
    CREATE TABLE IF NOT EXISTS canon_candidates (
      card_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      visibility TEXT NOT NULL,
      evidence TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revision_issues (
      issue_id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      severity TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS export_presets (
      preset_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_tasks (
      task_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      surface TEXT NOT NULL,
      agent_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_feed (
      item_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      supporting_label TEXT,
      severity TEXT,
      proposal_id TEXT,
      approval_id TEXT,
      diff_before TEXT,
      diff_after TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proposals (
      proposal_id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      full_content TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revision_issue_state (
      issue_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  return database
}

const seedTableIfEmpty = <Row extends Record<string, SQLInputValue>>(
  database: DatabaseSync,
  tableName: string,
  rows: Row[]
): void => {
  const result = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number }

  if (result.count > 0 || rows.length === 0) {
    return
  }

  const columns = Object.keys(rows[0])
  const placeholders = columns.map((column) => `@${column}`).join(', ')
  const statement = database.prepare(
    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
  )

  for (const row of rows) {
    statement.run(row)
  }
}

const seedRuntimeDatabase = (database: DatabaseSync, seed: RuntimeSeed): void => {
  seedTableIfEmpty(database, 'canon_candidates', seed.canonCandidates)
  seedTableIfEmpty(database, 'revision_issues', seed.revisionIssues)
  seedTableIfEmpty(database, 'export_presets', seed.exportPresets)
  seedTableIfEmpty(database, 'agent_tasks', seed.agentTasks)
  seedTableIfEmpty(database, 'agent_feed', seed.agentFeed)
  seedTableIfEmpty(database, 'proposals', seed.proposals)
}

class FileSystemNovelRepository implements ProjectRepositoryPort {
  private readonly configPath: string
  private readonly runtimeDir: string
  private readonly database: DatabaseSync

  constructor(private readonly workspaceRoot: string) {
    this.configPath = join(this.workspaceRoot, 'novel.json')
    const config = this.loadConfigSync()

    this.runtimeDir = join(this.workspaceRoot, '.lime/runtime')
    mkdirSync(this.runtimeDir, { recursive: true })

    this.database = createRuntimeDatabase(join(this.runtimeDir, 'project.db'))
    seedRuntimeDatabase(this.database, resolveRuntimeSeed(config))
  }

  async loadWorkspaceShell(): Promise<WorkspaceShellDto> {
    const config = await this.loadConfig()
    const recentExports = await loadExportHistory(this.workspaceRoot)
    const volumeLabelById = new Map(config.volumes.map((volume) => [volume.volumeId, volume.title]))
    const currentChapter = this.getChapterConfig(config, config.currentChapterId)
    const issueStatusById = new Map(
      (
        this.database
          .prepare('SELECT issue_id, status, updated_at FROM revision_issue_state ORDER BY updated_at DESC')
          .all() as RevisionIssueStateRow[]
      ).map((row) => [row.issue_id, row.status])
    )

    return {
      workspacePath: this.workspaceRoot,
      project: {
        projectId: config.projectId,
        title: config.title,
        subtitle: config.subtitle,
        status: config.status,
        genre: config.genre,
        premise: config.premise,
        currentSurface: config.currentSurface,
        currentChapterId: config.currentChapterId
      },
      navigation: [...NAVIGATION],
      chapterTree: config.chapters.map((chapter) => ({
        chapterId: chapter.chapterId,
        order: chapter.order,
        title: chapter.title,
        summary: chapter.summary,
        status: chapter.status,
        wordCount: chapter.wordCount,
        volumeLabel: chapter.volumeId ? volumeLabelById.get(chapter.volumeId) : undefined
      })),
      sceneList: currentChapter.scenes.map((scene) => ({
        sceneId: scene.sceneId,
        order: scene.order,
        title: scene.title,
        goal: scene.goal,
        status: scene.status
      })),
      homeHighlights: config.homeHighlights,
      canonCandidates: this.database
        .prepare(
          'SELECT card_id, name, kind, summary, visibility, evidence FROM canon_candidates ORDER BY rowid ASC'
        )
        .all()
        .map((row) => ({
          cardId: (row as CanonCandidateRow).card_id,
          name: (row as CanonCandidateRow).name,
          kind: (row as CanonCandidateRow).kind,
          summary: (row as CanonCandidateRow).summary,
          visibility: (row as CanonCandidateRow).visibility,
          evidence: (row as CanonCandidateRow).evidence
        })),
      revisionIssues: this.database
        .prepare(
          'SELECT issue_id, chapter_id, title, summary, severity FROM revision_issues ORDER BY severity DESC, rowid ASC'
        )
        .all()
        .map((row) => ({
          issueId: (row as RevisionIssueRow).issue_id,
          chapterId: (row as RevisionIssueRow).chapter_id,
          title: (row as RevisionIssueRow).title,
          summary: (row as RevisionIssueRow).summary,
          severity: (row as RevisionIssueRow).severity,
          status: issueStatusById.get((row as RevisionIssueRow).issue_id) ?? 'open'
        }))
        .filter((issue) => issue.status !== 'resolved'),
      exportPresets: this.database
        .prepare('SELECT preset_id, title, format, status, summary FROM export_presets ORDER BY rowid ASC')
        .all()
        .map((row) => ({
          presetId: (row as ExportPresetRow).preset_id,
          title: (row as ExportPresetRow).title,
          format: (row as ExportPresetRow).format,
          status: (row as ExportPresetRow).status,
          summary: (row as ExportPresetRow).summary
        })),
      agentHeader: HOME_HEADER,
      agentTasks: this.database
        .prepare('SELECT task_id, title, summary, status, surface, agent_type FROM agent_tasks ORDER BY rowid ASC')
        .all()
        .map((row) => ({
          taskId: (row as AgentTaskRow).task_id,
          title: (row as AgentTaskRow).title,
          summary: (row as AgentTaskRow).summary,
          status: (row as AgentTaskRow).status,
          surface: (row as AgentTaskRow).surface,
          agentType: (row as AgentTaskRow).agent_type
        })),
      agentFeed: this.database
        .prepare(
          `SELECT item_id, task_id, kind, title, body, supporting_label, severity, proposal_id, approval_id,
                  diff_before, diff_after, created_at
             FROM agent_feed
            ORDER BY datetime(created_at) DESC, rowid DESC`
        )
        .all()
        .map((row) => this.mapAgentFeedRow(row as AgentFeedRow)),
      quickActions: config.quickActions,
      recentExports
    }
  }

  async loadChapterDocument(chapterId: string): Promise<ChapterDocumentDto> {
    const config = await this.loadConfig()
    const chapter = this.getChapterConfig(config, chapterId)
    const content = await readFile(join(this.workspaceRoot, chapter.file), 'utf8')

    return {
      chapterId: chapter.chapterId,
      title: `第${chapter.order}章 ${chapter.title}`,
      objective: chapter.objective,
      lastEditedAt: chapter.lastEditedAt,
      wordCount: chapter.wordCount,
      content
    }
  }

  async updateWorkspaceContext(input: UpdateWorkspaceContextInputDto): Promise<void> {
    const config = await this.loadConfig()
    await this.saveConfig({
      ...config,
      currentSurface: input.surface,
      currentChapterId: input.chapterId ?? config.currentChapterId
    })
  }

  async saveChapterDocument(input: SaveChapterInputDto): Promise<SaveChapterResultDto> {
    const config = await this.loadConfig()
    const chapter = this.getChapterConfig(config, input.chapterId)
    const nextContent = normalizeNarrativeContent(input.content)
    const nextEditedAt = formatTimestamp()
    const nextWordCount = countNarrativeChars(nextContent)

    await writeFile(join(this.workspaceRoot, chapter.file), nextContent, 'utf8')

    await this.saveConfig({
      ...config,
      currentSurface: 'writing',
      currentChapterId: chapter.chapterId,
      chapters: config.chapters.map((item) =>
        item.chapterId === chapter.chapterId
          ? {
              ...item,
              wordCount: nextWordCount,
              lastEditedAt: nextEditedAt
            }
          : item
      )
    })

    return {
      chapterId: chapter.chapterId,
      content: nextContent,
      wordCount: nextWordCount,
      lastEditedAt: nextEditedAt,
      summary: '正文已保存到本地项目目录。'
    }
  }

  async applyProposal(proposalId: string): Promise<ApplyProposalResultDto> {
    const proposal = this.database
      .prepare('SELECT proposal_id, chapter_id, full_content FROM proposals WHERE proposal_id = ?')
      .get(proposalId) as ProposalRow | undefined

    if (!proposal) {
      throw new Error(`未找到提议：${proposalId}`)
    }

    const saveResult = await this.saveChapterDocument({
      chapterId: proposal.chapter_id,
      content: proposal.full_content
    })

    if (proposalId === 'proposal-rewrite-opening') {
      await this.updateRevisionIssue({
        issueId: 'issue-pov-drift',
        status: 'resolved'
      })
    }

    return {
      chapterId: saveResult.chapterId,
      proposalId,
      content: saveResult.content,
      summary: '已把右栏提议应用到当前章节草稿。'
    }
  }

  async commitCanonCard(input: CommitCanonCardInputDto): Promise<CommitCanonCardResultDto> {
    const row = this.database
      .prepare(
        'SELECT card_id, name, kind, summary, visibility, evidence FROM canon_candidates WHERE card_id = ?'
      )
      .get(input.cardId) as CanonCandidateRow | undefined

    if (!row) {
      throw new Error(`未找到设定卡：${input.cardId}`)
    }

    this.database
      .prepare('UPDATE canon_candidates SET visibility = @visibility WHERE card_id = @card_id')
      .run({
        visibility: input.visibility,
        card_id: input.cardId
      })

    const directory = join(this.workspaceRoot, 'canon', canonDirectoryByKind(row.kind))
    await mkdir(directory, { recursive: true })
    const outputPath = join(directory, `${slugFromCard(row.card_id)}.md`)
    const content = [
      `# ${row.name}`,
      '',
      `- 类型：${row.kind}`,
      `- 可见性：${input.visibility}`,
      '',
      row.summary,
      '',
      '## 证据',
      row.evidence,
      ''
    ].join('\n')

    await writeFile(outputPath, content, 'utf8')

    return {
      cardId: row.card_id,
      visibility: input.visibility,
      outputPath,
      summary: input.visibility === 'confirmed' ? '设定卡已写回正式设定目录。' : '设定卡状态已更新。'
    }
  }

  async updateRevisionIssue(input: UpdateRevisionIssueInputDto): Promise<UpdateRevisionIssueResultDto> {
    const exists = this.database
      .prepare('SELECT issue_id FROM revision_issues WHERE issue_id = ?')
      .get(input.issueId) as { issue_id: string } | undefined

    if (!exists) {
      throw new Error(`未找到修订问题：${input.issueId}`)
    }

    this.database
      .prepare(
        `INSERT INTO revision_issue_state (issue_id, status, updated_at)
         VALUES (@issue_id, @status, @updated_at)
         ON CONFLICT(issue_id) DO UPDATE SET
           status = excluded.status,
           updated_at = excluded.updated_at`
      )
      .run({
        issue_id: input.issueId,
        status: input.status,
        updated_at: new Date().toISOString()
      })

    return {
      issueId: input.issueId,
      status: input.status,
      summary:
        input.status === 'resolved'
          ? '修订问题已标记为已解决。'
          : input.status === 'deferred'
            ? '修订问题已稍后处理。'
            : '修订问题已重新打开。'
    }
  }

  async createExportPackage(input: CreateExportPackageInputDto): Promise<CreateExportPackageResultDto> {
    const config = await this.loadConfig()
    const preset = this.database
      .prepare('SELECT preset_id, title, format, status, summary FROM export_presets WHERE preset_id = ?')
      .get(input.presetId) as ExportPresetRow | undefined

    if (!preset) {
      throw new Error(`未找到导出预设：${input.presetId}`)
    }

    const timestamp = new Date().toISOString().replaceAll(':', '-')
    const outputDir = join(this.workspaceRoot, 'exports', `${timestamp}-${preset.preset_id}`)
    await mkdir(outputDir, { recursive: true })

    const selectedChapters = config.chapters
    const chapterBlocks = await Promise.all(
      selectedChapters.map(async (chapter) => {
        const content = await readFile(join(this.workspaceRoot, chapter.file), 'utf8')
        return `# 第${chapter.order}章 ${chapter.title}\n\n${content.trim()}\n`
      })
    )

    const manuscriptPath = join(outputDir, preset.format === 'markdown' ? 'manuscript.md' : 'prepack.md')
    const synopsisPath = join(outputDir, 'synopsis.md')
    const manifestPath = join(outputDir, 'manifest.json')

    await writeFile(
      manuscriptPath,
      [`# ${config.title}`, '', `> 预设：${preset.title}`, '', ...chapterBlocks].join('\n'),
      'utf8'
    )
    await writeFile(synopsisPath, `${input.synopsis.trim()}\n`, 'utf8')
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          projectId: config.projectId,
          title: config.title,
          preset: {
            id: preset.preset_id,
            title: preset.title,
            format: preset.format
          },
          splitChapters: input.splitChapters,
          generatedAt: new Date().toISOString(),
          files: [manuscriptPath, synopsisPath]
        },
        null,
        2
      )}\n`,
      'utf8'
    )

    return {
      presetId: preset.preset_id,
      outputDir,
      manifestPath,
      summary: '导出包已生成到项目 exports 目录。'
    }
  }

  private async loadConfig(): Promise<NovelProjectConfig> {
    return readJson<NovelProjectConfig>(this.configPath)
  }

  private loadConfigSync(): NovelProjectConfig {
    return JSON.parse(readFileSync(this.configPath, 'utf8')) as NovelProjectConfig
  }

  private async saveConfig(config: NovelProjectConfig): Promise<void> {
    await writeFile(this.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  }

  private getChapterConfig(config: NovelProjectConfig, chapterId: string): ChapterConfig {
    const chapter = config.chapters.find((item) => item.chapterId === chapterId)

    if (!chapter) {
      throw new Error(`未找到章节配置：${chapterId}`)
    }

    return chapter
  }

  private mapAgentFeedRow(row: AgentFeedRow): AgentFeedItemDto {
    return {
      itemId: row.item_id,
      taskId: row.task_id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      supportingLabel: row.supporting_label ?? undefined,
      severity: row.severity ?? undefined,
      proposalId: row.proposal_id ?? undefined,
      approvalId: row.approval_id ?? undefined,
      diffPreview:
        row.diff_before && row.diff_after
          ? {
              before: row.diff_before,
              after: row.diff_after
            }
          : undefined,
      actions: row.proposal_id
        ? [
            {
              id: createId('action'),
              label: '应用提议',
              kind: 'apply-proposal',
              proposalId: row.proposal_id
            }
          ]
        : undefined,
      createdAt: row.created_at
    }
  }
}

export const createNovelProjectWorkspace = async (
  baseDirectory: string,
  input: CreateProjectInputDto
): Promise<CreateProjectResultDto> => {
  const workspacePath = await ensureWorkspacePath(baseDirectory, input.title)
  const initialChapterContent = buildInitialChapterContent(input)
  const config = buildNovelProjectConfig(input, initialChapterContent)

  await mkdir(workspacePath, { recursive: true })
  await Promise.all(
    [
      'manuscript/chapters',
      'canon/characters',
      'canon/locations',
      'canon/rules',
      'canon/items',
      'canon/timeline',
      'revisions/snapshots',
      'exports',
      'references',
      '.lime/runtime',
      '.lime/embeddings',
      '.lime/cache',
      '.lime/logs'
    ].map((directory) => mkdir(join(workspacePath, directory), { recursive: true }))
  )

  await writeFile(join(workspacePath, 'novel.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  await writeFile(
    join(workspacePath, config.chapters[0].file),
    normalizeNarrativeContent(initialChapterContent),
    'utf8'
  )

  return {
    workspacePath,
    projectId: config.projectId,
    title: config.title
  }
}

export const createFileSystemNovelRepository = (workspaceRoot = DEFAULT_WORKSPACE_ROOT): ProjectRepositoryPort =>
  new FileSystemNovelRepository(workspaceRoot)
