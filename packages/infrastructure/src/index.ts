import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { SQLInputValue } from 'node:sqlite'
import type {
  AnalysisOverviewDto,
  AnalysisSampleDto,
  AnalysisScoreDto,
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentTaskDto,
  ApplyProjectStrategyProposalInputDto,
  ApplyProjectStrategyProposalResultDto,
  ApplyProposalResultDto,
  CanonCandidateDto,
  ChapterDocumentDto,
  CommitCanonCardInputDto,
  CommitCanonCardResultDto,
  CreateProjectInputDto,
  CreateProjectResultDto,
  ExportComparisonDto,
  CreateExportPackageInputDto,
  CreateExportPackageResultDto,
  ExportHistoryDto,
  ExportPresetDto,
  ImportAnalysisSampleInputDto,
  ImportAnalysisSampleResultDto,
  ProjectRepositoryPort,
  QuickActionDto,
  RejectProposalResultDto,
  RevisionIssueDto,
  SaveChapterInputDto,
  SaveChapterResultDto,
  UndoRevisionRecordResultDto,
  UpdateRevisionIssueInputDto,
  UpdateRevisionIssueResultDto,
  UpdateWorkspaceContextInputDto,
  WorkspaceSearchInputDto,
  WorkspaceSearchItemDto,
  WorkspaceSearchResultDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import { clamp, createId } from '@lime-novel/shared-kernel'
import type { FeatureToolId, NovelSurfaceId, RiskLevel, TaskStatus } from '@lime-novel/domain-novel'

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

type PublishStateConfig = {
  currentVersion: string
  lastPublishedAt: string
  lastPresetId: string
  lastManifestPath: string
  lastOutputDir: string
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
  currentFeatureTool?: FeatureToolId
  currentChapterId: string
  publishState: PublishStateConfig
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

type RevisionRecordRow = {
  record_id: string
  proposal_id: string
  chapter_id: string
  title: string
  summary: string
  before_content: string
  after_content: string
  source_surface: NovelSurfaceId
  linked_issue_id: string | null
  issue_status_before: RevisionIssueDto['status'] | null
  issue_status_after: RevisionIssueDto['status'] | null
  snapshot_path: string
  created_at: string
  undone_at: string | null
}

type ExportPresetRow = {
  preset_id: string
  title: string
  format: ExportPresetDto['format']
  status: ExportPresetDto['status']
  summary: string
}

type AnalysisSampleRow = {
  sample_id: string
  title: string
  author: string
  source_label: string
  synopsis: string
  sample_text: string
  tags_json: string
  comments_json: string
  scores_json: string
  hook_summary: string
  character_summary: string
  pacing_summary: string
  reader_signals_json: string
  risk_signals_json: string
  inspiration_signals_json: string
  imported_at: string
}

type ExportManifest = {
  projectId: string
  title: string
  version: {
    tag: string
    previousTag?: string
  }
  preset: {
    id: string
    title: string
    format: ExportPresetDto['format']
  }
  synopsis: string
  splitChapters: number
  notes: string
  platformFeedback: string[]
  generatedAt: string
  files: string[]
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
  status: NonNullable<AgentFeedItemDto['approvalStatus']>
  source_surface: NovelSurfaceId
  source_intent: string
  linked_issue_id: string | null
}

type RuntimeSeed = {
  analysisSamples: AnalysisSampleRow[]
  canonCandidates: CanonCandidateRow[]
  revisionIssues: RevisionIssueRow[]
  exportPresets: ExportPresetRow[]
  agentTasks: AgentTaskRow[]
  agentFeed: AgentFeedRow[]
  proposals: ProposalRow[]
}

const NAVIGATION = [
  { id: 'home', label: '首页', description: '恢复现场与项目健康度' },
  { id: 'writing', label: '写作', description: '章节树、场景与正文编辑' },
  { id: 'canon', label: '设定', description: '候选卡、关系与时间线' },
  { id: 'revision', label: '修订', description: '问题队列、证据与差异' },
  { id: 'publish', label: '发布', description: '导出预设与平台准备' }
] as const

const buildWorkspaceAgentHeader = (
  surface: NovelSurfaceId,
  featureTool?: FeatureToolId
): AgentHeaderDto => {
  if (surface === 'writing') {
    return {
      currentAgent: '章节代理',
      activeSubAgent: '设定扫描子代理',
      surface,
      memorySources: ['本章目标', '当前场景', '相邻章节', '最近提议'],
      riskLevel: 'medium'
    }
  }

  if (surface === 'canon') {
    return {
      currentAgent: '设定代理',
      activeSubAgent: '事实抽取子代理',
      surface,
      memorySources: ['候选设定', '证据片段', '章节引用', '最近任务'],
      riskLevel: 'medium'
    }
  }

  if (surface === 'analysis') {
    return {
      currentAgent: '拆书代理',
      activeSubAgent: '样本建模子代理',
      surface,
      memorySources: ['样本文本', '题材词', '结构信号', '项目 premise'],
      riskLevel: 'medium'
    }
  }

  if (surface === 'feature-center') {
    if (featureTool === 'analysis') {
      return buildWorkspaceAgentHeader('analysis')
    }

    return {
      currentAgent: '功能中心',
      surface,
      memorySources: ['插件能力', '样本导入', '项目回写', '最近功能'],
      riskLevel: 'low'
    }
  }

  if (surface === 'revision') {
    return {
      currentAgent: '修订代理',
      activeSubAgent: '连续性检查子代理',
      surface,
      memorySources: ['问题队列', '相邻章节', '证据片段', '修订记录'],
      riskLevel: 'high'
    }
  }

  if (surface === 'publish') {
    return {
      currentAgent: '发布代理',
      activeSubAgent: '导出预检子代理',
      surface,
      memorySources: ['导出预设', '版本快照', '平台提示', '最近导出'],
      riskLevel: 'medium'
    }
  }

  return {
    currentAgent: '项目总控代理',
    activeSubAgent: '章节代理',
    surface: 'home',
    memorySources: ['项目摘要', '最近任务', '候选设定', '修订问题'],
    riskLevel: 'medium'
  }
}

const buildProposalRetryPrompt = (proposal: ProposalRow): string => {
  if (proposal.source_surface === 'revision') {
    return `刚才的修订任务是：“${proposal.source_intent.trim()}”。请再来一版更克制、改动更小的修订方案，只输出可应用提议与一句理由。`
  }

  return `刚才的任务是：“${proposal.source_intent.trim()}”。请在同一章节目标下，再来一版更克制、语气更稳的可应用提议，不要直接覆盖正文。`
}

const buildPublishFeedActions = (row: AgentFeedRow): AgentFeedItemDto['actions'] => {
  if (row.title === '平台简介草案已生成' && row.supporting_label === '发布参数 / 可直接回填简介') {
    return [
      {
        id: createId('action'),
        label: '采用这版简介',
        kind: 'apply-publish-synopsis',
        value: row.body
      },
      {
        id: createId('action'),
        label: '再生成一版',
        kind: 'prompt',
        prompt: '请再生成一版更像长篇小说连载文案的平台简介。',
        surface: 'publish'
      }
    ]
  }

  if (row.title === '发布备注草案已生成' && row.supporting_label === '发布参数 / 可直接回填备注') {
    return [
      {
        id: createId('action'),
        label: '采用这版备注',
        kind: 'apply-publish-notes',
        value: row.body
      },
      {
        id: createId('action'),
        label: '再生成一版',
        kind: 'prompt',
        prompt: '请再生成一版更适合 release-notes 的发布备注，突出这一版的确认重点。',
        surface: 'publish'
      }
    ]
  }

  if (row.title === '最终确认建议已生成') {
    return [
      {
        id: createId('action'),
        label: '打开确认单',
        kind: 'open-publish-confirm'
      }
    ]
  }

  return undefined
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
  analysisSamples: [],
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
  analysisSamples: [
    {
      sample_id: 'analysis-sample-fog-city',
      title: '雾城回响',
      author: '青岚',
      source_label: '榜单样本 / 都市悬疑',
      synopsis:
        '记者林雾在暴雨夜里收到一卷录音带，录音中的自己提前说出了第二天会发生的命案。',
      sample_text:
        '暴雨沿着霓虹灯牌往下剥落，像有人把一整座城的秘密拆成了碎片。林雾捏着那卷还在渗凉气的磁带，没有立刻播放。她先听见的是自己掌心里不该出现的第二道呼吸。',
      tags_json: JSON.stringify(['都市悬疑', '时间回环', '女性主角']),
      comments_json: JSON.stringify([
        '开场钩子很强，第一章就想继续追。',
        '主角嘴硬但动作很脆，人物记忆点很稳。',
        '中段解释有点多，不过反转还是够狠。'
      ]),
      scores_json: JSON.stringify({
        hookStrength: 9,
        characterHeat: 8,
        pacingMomentum: 7,
        feedbackResonance: 8
      } satisfies AnalysisScoreDto),
      hook_summary: '用“主角先听见不该存在的第二道呼吸”建立第一秒的异常承诺。',
      character_summary: '主角表面冷静、动作失控，靠反差维持读者黏性。',
      pacing_summary: '开篇异常感很快落地，中段解释略多，但每章尾部会补一次更狠的反转钩子。',
      reader_signals_json: JSON.stringify([
        '读者最买单的是第一章异常感立得很快。',
        '人物反差与压抑动作让主角显得可记忆。',
        '章节尾部必须持续给到更强的危险感。'
      ]),
      risk_signals_json: JSON.stringify([
        '中段解释偏多时，悬念拉力会明显下滑。',
        '反转如果只靠设定补丁，后劲会变弱。'
      ]),
      inspiration_signals_json: JSON.stringify([
        '你的项目可以先立一个一秒可感知的异常物证，再展开主线秘密。',
        '主角吸引力更适合靠“嘴硬 + 身体反应失控”的反差来建立。',
        '章节结尾要保留新的危险承诺，而不是只做信息解释。'
      ]),
      imported_at: '2026-04-02T03:10:00.000Z'
    },
    {
      sample_id: 'analysis-sample-ember-courtyard',
      title: '余烬深院',
      author: '北栀',
      source_label: '手动拆录 / 女频强情绪',
      synopsis:
        '沈照在一场家族大火后被迫回到旧宅，与名义上的未婚夫一起清点遗嘱与旧债。',
      sample_text:
        '门轴转开的瞬间，灰尘没有先落下来，先落下来的是她十七岁那年没敢说出口的话。沈照站在回廊尽头，明明只是看见一盏旧灯，却像又被那场火烫了一次。',
      tags_json: JSON.stringify(['强情绪', '旧宅秘密', '关系拉扯']),
      comments_json: JSON.stringify([
        '氛围太好了，宅院感很浓。',
        '男女主互相试探特别上头。',
        '前面慢一点，但情绪爆点很够。'
      ]),
      scores_json: JSON.stringify({
        hookStrength: 8,
        characterHeat: 9,
        pacingMomentum: 6,
        feedbackResonance: 8
      } satisfies AnalysisScoreDto),
      hook_summary: '用旧宅、火灾余痕和未说出口的话，把情绪债与悬念债同时立住。',
      character_summary: '关系张力来自“彼此都知道真相的一部分，但都不先说破”。',
      pacing_summary: '推进不算快，但情绪落点密集，适合靠人物关系维持留存。',
      reader_signals_json: JSON.stringify([
        '读者会持续追看情绪压迫感与旧债关系。',
        '环境描写只要能服务人物记忆点，就会被接受。',
        '关系线越克制，评论越容易高频讨论。'
      ]),
      risk_signals_json: JSON.stringify([
        '如果连续几章只有氛围没有事件推进，弃读风险会抬头。',
        '关系试探需要不断升级，不然会显得同质。'
      ]),
      inspiration_signals_json: JSON.stringify([
        '如果你的项目也走强情绪路线，开篇需要把“旧债”具象化到一个可触摸物件上。',
        '关系张力最好依赖信息差，而不是单纯误会。',
        '情绪浓度高时，更要安排事件推进点去托住节奏。'
      ]),
      imported_at: '2026-04-02T03:26:00.000Z'
    }
  ],
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
      status: 'pending',
      source_surface: 'revision',
      source_intent: '请针对当前问题生成最小修订方案。',
      linked_issue_id: 'issue-pov-drift',
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

const DEFAULT_PUBLISH_STATE: PublishStateConfig = {
  currentVersion: 'v0.1.0',
  lastPublishedAt: '',
  lastPresetId: '',
  lastManifestPath: '',
  lastOutputDir: ''
}

const normalizeProjectConfig = (config: NovelProjectConfig): NovelProjectConfig => {
  const currentSurface = config.currentSurface === 'analysis' ? 'feature-center' : config.currentSurface
  const currentFeatureTool =
    currentSurface === 'feature-center'
      ? config.currentFeatureTool ?? (config.currentSurface === 'analysis' ? 'analysis' : undefined)
      : undefined

  return {
    ...config,
    currentSurface,
    currentFeatureTool,
    publishState: {
      ...DEFAULT_PUBLISH_STATE,
      ...config.publishState
    }
  }
}

const normalizeSearchValue = (value: string): string => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()

const createSearchExcerpt = (value: string, query: string, fallbackLength = 72): string => {
  const compact = value.replace(/\s+/g, ' ').trim()

  if (!compact) {
    return '当前对象尚未补充更多内容。'
  }

  const normalizedCompact = compact.toLocaleLowerCase()
  const normalizedQuery = normalizeSearchValue(query)
  const matchIndex = normalizedCompact.indexOf(normalizedQuery)

  if (matchIndex < 0) {
    return compact.length <= fallbackLength ? compact : `${compact.slice(0, fallbackLength)}...`
  }

  const start = Math.max(0, matchIndex - 20)
  const end = Math.min(compact.length, matchIndex + query.length + 44)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < compact.length ? '...' : ''

  return `${prefix}${compact.slice(start, end)}${suffix}`
}

const scoreSearchField = (value: string, query: string, weight: number): number => {
  if (!value.trim()) {
    return 0
  }

  const normalizedValue = normalizeSearchValue(value)
  const normalizedQuery = normalizeSearchValue(query)

  if (!normalizedQuery) {
    return 0
  }

  if (normalizedValue.includes(normalizedQuery)) {
    return weight + Math.max(0, 28 - normalizedValue.indexOf(normalizedQuery))
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean)

  if (tokens.length === 0 || !tokens.every((token) => normalizedValue.includes(token))) {
    return 0
  }

  return Math.max(1, Math.round(weight * 0.72))
}

const createNarrativePreview = (value: string, fallbackLength = 84): string => {
  const compact = value.replace(/\s+/g, ' ').trim()

  if (!compact) {
    return '暂无正文片段。'
  }

  if (compact.length <= fallbackLength) {
    return compact
  }

  return `${compact.slice(0, fallbackLength)}...`
}

const normalizeVersionTag = (value: string): string => {
  const trimmed = value.trim()

  if (!trimmed) {
    return DEFAULT_PUBLISH_STATE.currentVersion
  }

  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`
}

const suggestNextVersionTag = (previousVersionTag?: string): string => {
  if (!previousVersionTag?.trim()) {
    return DEFAULT_PUBLISH_STATE.currentVersion
  }

  const normalized = normalizeVersionTag(previousVersionTag ?? '')
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(normalized)

  if (!match) {
    return normalized === DEFAULT_PUBLISH_STATE.currentVersion ? 'v0.1.1' : `${normalized}-next`
  }

  const major = Number.parseInt(match[1], 10)
  const minor = Number.parseInt(match[2], 10)
  const patch = Number.parseInt(match[3], 10)
  return `v${major}.${minor}.${patch + 1}`
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

const ANALYSIS_STOPWORDS = new Set([
  '当前',
  '样本',
  '小说',
  '故事',
  '评论',
  '读者',
  '主角',
  '人物',
  '情绪',
  '关系',
  '章节',
  '开场',
  '设定',
  '感觉',
  '一个',
  '这部',
  '这个',
  '因为',
  '还是',
  '已经',
  '如果',
  '真的',
  '时候',
  '自己',
  '我们',
  '他们'
])

const ANALYSIS_KEYWORDS = {
  hook: ['秘密', '异常', '反转', '悬念', '危险', '命案', '火灾', '录音', '线索', '真相', '旧债', '遗嘱'],
  character: ['主角', '人物', '女主', '男主', '关系', '欲望', '压抑', '反差', '试探', '嘴硬', '克制'],
  pace: ['开场', '推进', '节奏', '反转', '爆点', '冲突', '回合', '收束', '尾钩', '高潮'],
  positive: ['上头', '好看', '想追', '记忆点', '钩子', '带感', '惊艳', '喜欢', '稳', '好磕', '很强'],
  negative: ['太慢', '拖', '解释多', '同质', '疲软', '注水', '跳章', '劝退', '无聊', '崩']
} as const

const parseJsonArray = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const parseJsonObject = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const splitManualTags = (value: string): string[] =>
  [...new Set(value.split(/[\n,，、/|]+/).map((item) => item.trim()).filter(Boolean))].slice(0, 6)

const splitManualComments = (value: string): string[] =>
  value
    .split(/\n+/)
    .map((item) => item.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 12)

const extractAnalysisTerms = (value: string, limit = 6): string[] => {
  const counts = new Map<string, number>()
  const matches = value.match(/[\u4e00-\u9fff]{2,6}/g) ?? []

  for (const token of matches) {
    if (ANALYSIS_STOPWORDS.has(token)) {
      continue
    }

    counts.set(token, (counts.get(token) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] === left[1]) {
        return right[0].length - left[0].length
      }

      return right[1] - left[1]
    })
    .map(([token]) => token)
    .slice(0, limit)
}

const countKeywordHits = (value: string, keywords: readonly string[]): number =>
  keywords.reduce((total, keyword) => total + (value.includes(keyword) ? 1 : 0), 0)

const buildAnalysisScores = (input: {
  synopsis: string
  sampleText: string
  commentText: string
}): AnalysisScoreDto => {
  const narrative = `${input.synopsis} ${input.sampleText}`
  const averageParagraphLength = Math.max(
    1,
    Math.round(
      input.sampleText
        .split(/\n{2,}/)
        .map((item) => item.trim())
        .filter(Boolean)
        .reduce((sum, item, _index, list) => sum + Math.round(item.length / list.length), 0)
    )
  )
  const hookHits = countKeywordHits(narrative, ANALYSIS_KEYWORDS.hook)
  const characterHits = countKeywordHits(`${narrative} ${input.commentText}`, ANALYSIS_KEYWORDS.character)
  const paceHits = countKeywordHits(`${narrative} ${input.commentText}`, ANALYSIS_KEYWORDS.pace)
  const positiveHits = countKeywordHits(input.commentText, ANALYSIS_KEYWORDS.positive)
  const negativeHits = countKeywordHits(input.commentText, ANALYSIS_KEYWORDS.negative)

  return {
    hookStrength: clamp(Math.round(5 + hookHits * 1.1 + positiveHits * 0.5 - negativeHits * 0.4), 1, 10),
    characterHeat: clamp(Math.round(5 + characterHits * 1 + positiveHits * 0.4 - negativeHits * 0.2), 1, 10),
    pacingMomentum: clamp(
      Math.round(5 + paceHits * 0.9 + (averageParagraphLength < 90 ? 1 : 0) - negativeHits * 0.6),
      1,
      10
    ),
    feedbackResonance: clamp(Math.round(4 + positiveHits * 0.9 + negativeHits * 0.6), 1, 10)
  }
}

const buildFallbackReaderSignals = (tags: string[], terms: string[]): string[] =>
  [
    tags[0] ? `题材层面最稳的是“${tags[0]}”带来的清晰承诺。` : undefined,
    terms[0] ? `样本反复强调“${terms[0]}”，说明读者会记住最先被感知到的异常或情绪。` : undefined,
    tags[1] ? `第二层吸引点落在“${tags[1]}”，适合用来抬高角色关系或世界观黏性。` : undefined
  ].filter((item): item is string => Boolean(item))

const buildFallbackRiskSignals = (scores: AnalysisScoreDto): string[] => {
  const signals: string[] = []

  if (scores.pacingMomentum <= 6) {
    signals.push('样本节奏偏依赖氛围或解释，照搬时容易把推进速度拖慢。')
  }

  if (scores.feedbackResonance <= 6) {
    signals.push('评论信号还不够集中，说明卖点表达可能存在分散风险。')
  }

  if (signals.length === 0) {
    signals.push('当前样本的主要风险不在开篇，而在中后段如何持续升级冲突。')
  }

  return signals
}

const buildAnalysisInspirationSignals = (input: {
  projectTitle: string
  projectGenre: string
  tags: string[]
  hookSummary: string
  characterSummary: string
  pacingSummary: string
  riskSignals: string[]
}): string[] => [
  `《${input.projectTitle}》可以先借鉴样本在“${input.tags[0] ?? input.projectGenre}”上的第一秒承诺：${input.hookSummary}`,
  `人物吸引力建议参考这层处理：${input.characterSummary}`,
  `节奏上更适合吸收“${input.pacingSummary}”，同时避免 ${input.riskSignals[0] ?? '只解释不推进'}。`
]

const stripMarkdownScaffold = (content: string): string =>
  content
    .replace(/^---[\s\S]*?---\s*/u, '')
    .replace(/^```[\s\S]*?```\s*/gmu, '')
    .trim()

const inferAnalysisTitleFromFile = (filePath: string, content: string): string => {
  const headingMatch = content.match(/^#\s+(.+)$/mu)

  if (headingMatch?.[1]?.trim()) {
    return headingMatch[1].trim()
  }

  return basename(filePath, extname(filePath)).trim() || '未命名样本'
}

const inferAnalysisSynopsisFromContent = (content: string): string => {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((item) => item.replace(/^#+\s+/u, '').trim())
    .filter(Boolean)

  return paragraphs[0] ?? '当前样本未显式提供简介，以下拆解会直接基于正文内容进行。'
}

const buildAnalysisSampleRow = (
  input: ImportAnalysisSampleInputDto,
  project: WorkspaceShellDto['project']
): AnalysisSampleRow => {
  const fileContent = stripMarkdownScaffold(readFileSync(input.filePath, 'utf8'))
  const synopsis = inferAnalysisSynopsisFromContent(fileContent)
  const sampleText = fileContent
  const commentText = ''
  const comments = splitManualComments(commentText)
  const tags: string[] = []
  const title = inferAnalysisTitleFromFile(input.filePath, fileContent)
  const derivedTerms = extractAnalysisTerms(`${title} ${synopsis} ${sampleText} ${commentText}`)
  const normalizedTags = tags.length > 0 ? tags : derivedTerms.slice(0, 3)
  const scores = buildAnalysisScores({
    synopsis,
    sampleText,
    commentText
  })
  const strongestTerm = derivedTerms[0] ?? normalizedTags[0] ?? '异常承诺'
  const secondaryTerm = derivedTerms[1] ?? normalizedTags[1] ?? '人物反差'
  const hookSummary = `样本开篇先把“${strongestTerm}”抛到台前，再用 ${normalizedTags.slice(0, 2).join(' / ') || '题材组合'} 继续加压。`
  const characterSummary = comments.some((item) => /(人物|主角|女主|男主|关系|cp)/iu.test(item))
    ? `评论高频会提到人物或关系，说明吸引力来自“${secondaryTerm}”这一层的可讨论性。`
    : `人物吸引力更依赖“${secondaryTerm}”式的反差或欲望外露，而不是单纯设定说明。`
  const pacingSummary =
    scores.pacingMomentum >= 8
      ? '开场推进较快，异常感、动作和尾钩能在较短篇幅内形成闭环。'
      : scores.pacingMomentum >= 6
        ? '节奏中速，依赖情绪与信息差共同托住阅读惯性。'
        : '节奏更依赖氛围堆叠，适合拆解其情绪手法，但不宜直接照搬推进速度。'
  const readerSignals =
    comments
      .filter((item) => countKeywordHits(item, ANALYSIS_KEYWORDS.positive) > 0)
      .slice(0, 3)
      .map((item) => `评论高频肯定：${item}`) || []
  const riskSignals =
    comments
      .filter((item) => countKeywordHits(item, ANALYSIS_KEYWORDS.negative) > 0)
      .slice(0, 2)
      .map((item) => `评论里已经出现风险信号：${item}`)
  const normalizedReaderSignals =
    readerSignals.length > 0 ? readerSignals : buildFallbackReaderSignals(normalizedTags, derivedTerms)
  const normalizedRiskSignals = riskSignals.length > 0 ? riskSignals : buildFallbackRiskSignals(scores)
  const inspirationSignals = buildAnalysisInspirationSignals({
    projectTitle: project.title,
    projectGenre: project.genre,
    tags: normalizedTags,
    hookSummary,
    characterSummary,
    pacingSummary,
    riskSignals: normalizedRiskSignals
  })

  return {
    sample_id: createId('analysis-sample'),
    title,
    author: '文件导入',
    source_label: `${extname(input.filePath).toLowerCase() || '.txt'} 文件导入`,
    synopsis,
    sample_text: sampleText,
    tags_json: JSON.stringify(normalizedTags),
    comments_json: JSON.stringify(comments),
    scores_json: JSON.stringify(scores),
    hook_summary: hookSummary,
    character_summary: characterSummary,
    pacing_summary: pacingSummary,
    reader_signals_json: JSON.stringify(normalizedReaderSignals),
    risk_signals_json: JSON.stringify(normalizedRiskSignals),
    inspiration_signals_json: JSON.stringify(inspirationSignals),
    imported_at: new Date().toISOString()
  }
}

const buildAnalysisExcerpt = (row: AnalysisSampleRow): string[] => {
  const paragraphs = row.sample_text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (paragraphs.length > 0) {
    return paragraphs.slice(0, 3)
  }

  return row.synopsis ? [row.synopsis] : ['当前样本还没有足够正文内容，暂时无法生成有效摘录。']
}

const mapAnalysisSampleRow = (row: AnalysisSampleRow): AnalysisSampleDto => ({
  sampleId: row.sample_id,
  title: row.title,
  author: row.author,
  sourceLabel: row.source_label,
  synopsis: row.synopsis,
  excerpt: buildAnalysisExcerpt(row),
  comments: parseJsonArray(row.comments_json),
  tags: parseJsonArray(row.tags_json),
  importedAt: row.imported_at,
  scores: parseJsonObject<AnalysisScoreDto>(row.scores_json, {
    hookStrength: 0,
    characterHeat: 0,
    pacingMomentum: 0,
    feedbackResonance: 0
  }),
  hookSummary: row.hook_summary,
  characterSummary: row.character_summary,
  pacingSummary: row.pacing_summary,
  readerSignals: parseJsonArray(row.reader_signals_json),
  riskSignals: parseJsonArray(row.risk_signals_json),
  inspirationSignals: parseJsonArray(row.inspiration_signals_json)
})

const buildAnalysisOverview = (samples: AnalysisSampleDto[]): AnalysisOverviewDto => {
  if (samples.length === 0) {
    return {
      sampleCount: 0,
      dominantTags: [],
      strongestSignals: ['先导入 1 个爆款样本，工作台才会开始建立题材、人物和节奏参考。'],
      cautionSignals: ['当前还没有样本，任何结论都不应凭空外推。'],
      projectAngles: ['建议先导入一个 .txt 或 .md 样本文件，再开始立项对标。'],
      averageScores: {
        hookStrength: 0,
        characterHeat: 0,
        pacingMomentum: 0,
        feedbackResonance: 0
      }
    }
  }

  const tagCounts = new Map<string, number>()
  const strongestSignals = new Map<string, number>()
  const cautionSignals = new Map<string, number>()
  const projectAngles = new Map<string, number>()
  const scoreTotals = samples.reduce(
    (totals, sample) => ({
      hookStrength: totals.hookStrength + sample.scores.hookStrength,
      characterHeat: totals.characterHeat + sample.scores.characterHeat,
      pacingMomentum: totals.pacingMomentum + sample.scores.pacingMomentum,
      feedbackResonance: totals.feedbackResonance + sample.scores.feedbackResonance
    }),
    {
      hookStrength: 0,
      characterHeat: 0,
      pacingMomentum: 0,
      feedbackResonance: 0
    }
  )

  for (const sample of samples) {
    for (const tag of sample.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }

    for (const signal of sample.readerSignals) {
      strongestSignals.set(signal, (strongestSignals.get(signal) ?? 0) + 1)
    }

    for (const signal of sample.riskSignals) {
      cautionSignals.set(signal, (cautionSignals.get(signal) ?? 0) + 1)
    }

    for (const signal of sample.inspirationSignals) {
      projectAngles.set(signal, (projectAngles.get(signal) ?? 0) + 1)
    }
  }

  const sortByCount = (entries: Map<string, number>): string[] =>
    [...entries.entries()]
      .sort((left, right) => {
        if (right[1] === left[1]) {
          return left[0].localeCompare(right[0], 'zh-CN')
        }

        return right[1] - left[1]
      })
      .map(([value]) => value)

  return {
    sampleCount: samples.length,
    dominantTags: sortByCount(tagCounts).slice(0, 4),
    strongestSignals: sortByCount(strongestSignals).slice(0, 3),
    cautionSignals: sortByCount(cautionSignals).slice(0, 3),
    projectAngles: sortByCount(projectAngles).slice(0, 3),
    averageScores: {
      hookStrength: Math.round(scoreTotals.hookStrength / samples.length),
      characterHeat: Math.round(scoreTotals.characterHeat / samples.length),
      pacingMomentum: Math.round(scoreTotals.pacingMomentum / samples.length),
      feedbackResonance: Math.round(scoreTotals.feedbackResonance / samples.length)
    }
  }
}

const buildStrategyQuickActions = (
  sample: AnalysisSampleDto,
  project: WorkspaceShellDto['project']
): QuickActionDto[] => [
  {
    id: `analysis-hook-${sample.sampleId}`,
    label: '钩子建模',
    prompt: `请结合样本《${sample.title}》的爆款钩子，为《${project.title}》设计一个更快进入冲突的开篇场景。`
  },
  {
    id: `analysis-character-${sample.sampleId}`,
    label: '人物张力',
    prompt: `请参考样本《${sample.title}》里的人物吸引点，为《${project.title}》补一版人物关系张力方案。`
  }
]

const buildStrategyHighlights = (sample: AnalysisSampleDto): HomeHighlightConfig[] => [
  {
    title: '爆款钩子参考',
    detail: sample.inspirationSignals[0] ?? sample.hookSummary
  },
  {
    title: '样本风险提醒',
    detail: sample.riskSignals[0] ?? '照搬样本节奏与题材承诺会带来同质化风险。'
  }
]

const mergeQuickActions = (current: QuickActionDto[], next: QuickActionDto[]): QuickActionDto[] => {
  const retained = current.filter((item) => !next.some((candidate) => candidate.id === item.id))
  return [...next, ...retained].slice(0, 6)
}

const mergeHighlights = (current: HomeHighlightConfig[], next: HomeHighlightConfig[]): HomeHighlightConfig[] => {
  const retained = current.filter((item) => !next.some((candidate) => candidate.title === item.title))
  return [...next, ...retained].slice(0, 4)
}

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
    subtitle: input.template === 'mystery' ? '悬疑长篇创作项目' : '长篇创作项目',
    status: 'planning',
    language: 'zh-CN',
    genre: input.genre.trim() || '待定题材',
    premise: input.premise.trim() || '请补充作品 premise，让代理能围绕主线持续协作。',
    currentSurface: 'home',
    currentChapterId: chapterId,
    publishState: { ...DEFAULT_PUBLISH_STATE },
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
          const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Partial<ExportManifest>

          return {
            exportId: entry.name,
            presetId: manifest.preset?.id ?? 'unknown',
            versionTag: normalizeVersionTag(manifest.version?.tag ?? ''),
            format: manifest.preset?.format ?? 'markdown',
            generatedAt: manifest.generatedAt ?? entry.name,
            synopsis: manifest.synopsis ?? '',
            splitChapters: manifest.splitChapters ?? 0,
            notes: manifest.notes ?? '',
            platformFeedback: Array.isArray(manifest.platformFeedback) ? manifest.platformFeedback : [],
            previousVersionTag: manifest.version?.previousTag,
            fileCount: manifest.files?.length ?? 0,
            files: Array.isArray(manifest.files) ? manifest.files.filter((item): item is string => typeof item === 'string') : [],
            outputDir: join(exportsDir, entry.name),
            manifestPath
          } satisfies ExportHistoryDto
        } catch {
          return {
            exportId: entry.name,
            presetId: 'unknown',
            versionTag: DEFAULT_PUBLISH_STATE.currentVersion,
            format: 'markdown',
            generatedAt: entry.name,
            synopsis: '',
            splitChapters: 0,
            notes: '',
            platformFeedback: [],
            previousVersionTag: undefined,
            fileCount: 0,
            files: [],
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

const buildPublishFeedback = (input: {
  config: NovelProjectConfig
  preset: ExportPresetRow
  synopsis: string
  splitChapters: number
  versionTag: string
  previousVersionTag?: string
}): string[] => {
  const synopsisLength = input.synopsis.trim().length
  const chapterCount = input.config.chapters.length
  const feedback: string[] = []

  if (synopsisLength < 60) {
    feedback.push('平台简介偏短，建议补足主角处境、冲突与悬念钩子。')
  } else {
    feedback.push('平台简介长度达标，已覆盖主角处境与主线悬念入口。')
  }

  if (input.splitChapters >= chapterCount) {
    feedback.push('当前拆章数接近或超过正文总章数，发布前请再次确认平台分卷策略。')
  } else if (chapterCount % input.splitChapters !== 0) {
    feedback.push('平台拆章不能整除当前章数，最后一组会保留非均分尾章。')
  } else {
    feedback.push('平台拆章与当前章节数匹配，发布后更便于连载节奏控制。')
  }

  if (input.preset.format === 'epub' && input.preset.status === 'draft') {
    feedback.push('EPUB 预设仍是草稿状态，适合内测包，不建议直接作为最终公开版本。')
  } else {
    feedback.push(`当前导出将以 ${input.preset.format.toUpperCase()} 产出新的项目快照。`)
  }

  if (input.previousVersionTag) {
    feedback.push(`上一版为 ${input.previousVersionTag}，本次确认后会回写 ${input.versionTag}。`)
  } else {
    feedback.push(`当前项目还没有正式导出记录，这次会创建首个版本 ${input.versionTag}。`)
  }

  return feedback
}

const buildLatestExportComparison = (recentExports: ExportHistoryDto[]): ExportComparisonDto | undefined => {
  const [currentExport, previousExport] = recentExports

  if (!currentExport || !previousExport) {
    return undefined
  }

  const changedFields: string[] = []
  const synopsisDelta = currentExport.synopsis.trim().length - previousExport.synopsis.trim().length
  const splitChaptersDelta = currentExport.splitChapters - previousExport.splitChapters
  const fileCountDelta = currentExport.fileCount - previousExport.fileCount

  if (currentExport.presetId !== previousExport.presetId || currentExport.format !== previousExport.format) {
    changedFields.push('导出预设')
  }

  if (synopsisDelta !== 0) {
    changedFields.push('平台简介')
  }

  if (splitChaptersDelta !== 0) {
    changedFields.push('拆章策略')
  }

  if (currentExport.notes.trim() !== previousExport.notes.trim()) {
    changedFields.push('发布备注')
  }

  if (fileCountDelta !== 0) {
    changedFields.push('导出资产')
  }

  const currentFeedbackSet = new Set(currentExport.platformFeedback)
  const previousFeedbackSet = new Set(previousExport.platformFeedback)
  const addedFeedback = currentExport.platformFeedback.filter((item) => !previousFeedbackSet.has(item))
  const removedFeedback = previousExport.platformFeedback.filter((item) => !currentFeedbackSet.has(item))

  if (addedFeedback.length > 0 || removedFeedback.length > 0) {
    changedFields.push('平台反馈')
  }

  const riskLevel: RiskLevel =
    addedFeedback.some((item) => item.includes('不建议') || item.includes('再次确认') || item.includes('偏短'))
      ? 'high'
      : changedFields.length >= 3
        ? 'medium'
        : 'low'

  const summary =
    changedFields.length > 0
      ? `相较 ${previousExport.versionTag}，${currentExport.versionTag} 主要变化在${changedFields.join('、')}。`
      : `相较 ${previousExport.versionTag}，${currentExport.versionTag} 的发布参数保持一致。`

  return {
    currentExportId: currentExport.exportId,
    previousExportId: previousExport.exportId,
    currentVersionTag: currentExport.versionTag,
    previousVersionTag: previousExport.versionTag,
    currentGeneratedAt: currentExport.generatedAt,
    previousGeneratedAt: previousExport.generatedAt,
    summary,
    riskLevel,
    changedFields,
    synopsisDelta,
    splitChaptersDelta,
    fileCountDelta,
    addedFeedback,
    removedFeedback
  }
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8')) as T

const ensureTableColumn = (
  database: DatabaseSync,
  tableName: string,
  columnName: string,
  definition: string
): void => {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>

  if (columns.some((column) => column.name === columnName)) {
    return
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

const createRuntimeDatabase = (dbPath: string): DatabaseSync => {
  const database = new DatabaseSync(dbPath)

  database.exec(`
    CREATE TABLE IF NOT EXISTS analysis_samples (
      sample_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      source_label TEXT NOT NULL,
      synopsis TEXT NOT NULL,
      sample_text TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      comments_json TEXT NOT NULL,
      scores_json TEXT NOT NULL,
      hook_summary TEXT NOT NULL,
      character_summary TEXT NOT NULL,
      pacing_summary TEXT NOT NULL,
      reader_signals_json TEXT NOT NULL,
      risk_signals_json TEXT NOT NULL,
      inspiration_signals_json TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

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
      full_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      source_surface TEXT NOT NULL DEFAULT 'writing',
      source_intent TEXT NOT NULL DEFAULT '',
      linked_issue_id TEXT
    );

    CREATE TABLE IF NOT EXISTS revision_issue_state (
      issue_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revision_records (
      record_id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      before_content TEXT NOT NULL,
      after_content TEXT NOT NULL,
      source_surface TEXT NOT NULL,
      linked_issue_id TEXT,
      issue_status_before TEXT,
      issue_status_after TEXT,
      snapshot_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      undone_at TEXT
    );
  `)

  ensureTableColumn(database, 'proposals', 'status', "TEXT NOT NULL DEFAULT 'pending'")
  ensureTableColumn(database, 'proposals', 'source_surface', "TEXT NOT NULL DEFAULT 'writing'")
  ensureTableColumn(database, 'proposals', 'source_intent', "TEXT NOT NULL DEFAULT ''")
  ensureTableColumn(database, 'proposals', 'linked_issue_id', 'TEXT')
  ensureTableColumn(database, 'revision_records', 'linked_issue_id', 'TEXT')
  ensureTableColumn(database, 'revision_records', 'issue_status_before', 'TEXT')
  ensureTableColumn(database, 'revision_records', 'issue_status_after', 'TEXT')
  ensureTableColumn(database, 'revision_records', 'snapshot_path', "TEXT NOT NULL DEFAULT ''")
  ensureTableColumn(database, 'revision_records', 'undone_at', 'TEXT')

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
  seedTableIfEmpty(database, 'analysis_samples', seed.analysisSamples)
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
    const latestExportComparison = buildLatestExportComparison(recentExports)
    const analysisSamples = (
      this.database
        .prepare(
          `SELECT sample_id, title, author, source_label, synopsis, sample_text, tags_json, comments_json,
                  scores_json, hook_summary, character_summary, pacing_summary, reader_signals_json,
                  risk_signals_json, inspiration_signals_json, imported_at
             FROM analysis_samples
            ORDER BY datetime(imported_at) DESC, rowid DESC`
        )
        .all() as AnalysisSampleRow[]
    ).map((row) => mapAnalysisSampleRow(row))
    const volumeLabelById = new Map(config.volumes.map((volume) => [volume.volumeId, volume.title]))
    const chapterLabelById = new Map(
      config.chapters.map((chapter) => [chapter.chapterId, `第 ${chapter.order} 章 · ${chapter.title}`])
    )
    const currentChapter = this.getChapterConfig(config, config.currentChapterId)
    const issueStatusById = new Map(
      (
        this.database
          .prepare('SELECT issue_id, status, updated_at FROM revision_issue_state ORDER BY updated_at DESC')
          .all() as RevisionIssueStateRow[]
      ).map((row) => [row.issue_id, row.status])
    )
    const proposalById = new Map(
      (
        this.database
          .prepare(
            `SELECT proposal_id, chapter_id, full_content, status, source_surface, source_intent, linked_issue_id
               FROM proposals`
          )
          .all() as ProposalRow[]
      ).map((row) => [row.proposal_id, row])
    )
    const revisionRecordRows = this.database
      .prepare(
        `SELECT record_id, proposal_id, chapter_id, title, summary, before_content, after_content, source_surface,
                linked_issue_id, issue_status_before, issue_status_after, snapshot_path, created_at, undone_at
           FROM revision_records
          ORDER BY datetime(created_at) DESC, rowid DESC
          LIMIT 12`
      )
      .all() as RevisionRecordRow[]
    const currentChapterContentById = new Map(
      await Promise.all(
        [...new Set(revisionRecordRows.map((row) => row.chapter_id))].map(async (chapterId) => {
          const chapter = config.chapters.find((item) => item.chapterId === chapterId)

          if (!chapter) {
            return [chapterId, ''] as const
          }

          try {
            const content = await readFile(join(this.workspaceRoot, chapter.file), 'utf8')
            return [chapterId, normalizeNarrativeContent(content)] as const
          } catch {
            return [chapterId, ''] as const
          }
        })
      )
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
        releaseVersion: config.publishState.currentVersion,
        lastPublishedAt: config.publishState.lastPublishedAt || undefined,
        currentSurface: config.currentSurface,
        currentFeatureTool: config.currentFeatureTool,
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
      analysisOverview: buildAnalysisOverview(analysisSamples),
      analysisSamples,
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
      revisionRecords: revisionRecordRows.map((row) => ({
        recordId: row.record_id,
        proposalId: row.proposal_id,
        chapterId: row.chapter_id,
        chapterTitle: chapterLabelById.get(row.chapter_id) ?? row.chapter_id,
        title: row.title,
        summary: row.summary,
        beforePreview: createNarrativePreview(row.before_content),
        afterPreview: createNarrativePreview(row.after_content),
        sourceSurface: row.source_surface,
        linkedIssueId: row.linked_issue_id ?? undefined,
        status: row.undone_at ? 'undone' : 'applied',
        canUndo:
          !row.undone_at &&
          currentChapterContentById.get(row.chapter_id) === normalizeNarrativeContent(row.after_content),
        snapshotPath: row.snapshot_path,
        createdAt: row.created_at,
        undoneAt: row.undone_at ?? undefined
      })),
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
      agentHeader: buildWorkspaceAgentHeader(config.currentSurface, config.currentFeatureTool),
      agentTasks: this.database
        .prepare('SELECT task_id, title, summary, status, surface, agent_type FROM agent_tasks ORDER BY rowid DESC')
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
        .map((row) => this.mapAgentFeedRow(row as AgentFeedRow, proposalById.get((row as AgentFeedRow).proposal_id ?? ''))),
      quickActions: config.quickActions,
      recentExports,
      latestExportComparison
    }
  }

  async searchWorkspace(input: WorkspaceSearchInputDto): Promise<WorkspaceSearchResultDto> {
    const query = input.query.trim()

    if (!query) {
      return {
        query,
        items: []
      }
    }

    const limit = Math.max(1, Math.min(input.limit ?? 18, 40))
    const config = await this.loadConfig()
    const chapterContentEntries = await Promise.all(
      config.chapters.map(async (chapter) => ({
        chapter,
        content: await readFile(join(this.workspaceRoot, chapter.file), 'utf8')
      }))
    )

    const items: WorkspaceSearchItemDto[] = []
    const pushItem = (item: WorkspaceSearchItemDto): void => {
      if (item.score > 0) {
        items.push(item)
      }
    }

    const projectScore =
      scoreSearchField(config.title, query, 120) +
      scoreSearchField(config.subtitle, query, 88) +
      scoreSearchField(config.genre, query, 64) +
      scoreSearchField(config.premise, query, 72)

    pushItem({
      itemId: `project-${config.projectId}`,
      kind: 'project',
      title: config.title,
      snippet: createSearchExcerpt(`${config.subtitle} ${config.genre} ${config.premise}`, query),
      surface: 'home',
      score: projectScore
    })

    for (const { chapter, content } of chapterContentEntries) {
      const chapterScore =
        scoreSearchField(chapter.title, query, 110) +
        scoreSearchField(chapter.summary, query, 70) +
        scoreSearchField(chapter.objective, query, 66) +
        scoreSearchField(content, query, 84)

      pushItem({
        itemId: `chapter-${chapter.chapterId}`,
        kind: 'chapter',
        title: `第 ${chapter.order} 章 · ${chapter.title}`,
        snippet: createSearchExcerpt(`${chapter.summary} ${chapter.objective} ${content}`, query),
        surface: 'writing',
        chapterId: chapter.chapterId,
        entityId: chapter.chapterId,
        score: chapterScore
      })

      for (const scene of chapter.scenes) {
        const sceneScore =
          scoreSearchField(scene.title, query, 86) +
          scoreSearchField(scene.goal, query, 70)

        pushItem({
          itemId: `scene-${scene.sceneId}`,
          kind: 'scene',
          title: `${chapter.title} / ${scene.title}`,
          snippet: createSearchExcerpt(scene.goal, query),
          surface: 'writing',
          chapterId: chapter.chapterId,
          entityId: scene.sceneId,
          score: sceneScore
        })
      }
    }

    const analysisRows = this.database
      .prepare(
        `SELECT sample_id, title, author, source_label, synopsis, sample_text, tags_json, comments_json,
                scores_json, hook_summary, character_summary, pacing_summary, reader_signals_json,
                risk_signals_json, inspiration_signals_json, imported_at
           FROM analysis_samples
          ORDER BY datetime(imported_at) DESC, rowid DESC`
      )
      .all() as AnalysisSampleRow[]

    for (const row of analysisRows) {
      const analysisScore =
        scoreSearchField(row.title, query, 108) +
        scoreSearchField(row.author, query, 52) +
        scoreSearchField(row.source_label, query, 42) +
        scoreSearchField(row.synopsis, query, 84) +
        scoreSearchField(row.sample_text, query, 76) +
        scoreSearchField(row.hook_summary, query, 70) +
        scoreSearchField(row.character_summary, query, 64)

      pushItem({
        itemId: `analysis-${row.sample_id}`,
        kind: 'analysis-sample',
        title: row.title,
        snippet: createSearchExcerpt(
          `${row.source_label} ${row.synopsis} ${row.hook_summary} ${row.character_summary} ${row.pacing_summary}`,
          query
        ),
        surface: 'feature-center',
        featureTool: 'analysis',
        entityId: row.sample_id,
        score: analysisScore
      })
    }

    const canonRows = this.database
      .prepare('SELECT card_id, name, kind, summary, visibility, evidence FROM canon_candidates ORDER BY rowid ASC')
      .all() as CanonCandidateRow[]

    for (const row of canonRows) {
      const canonScore =
        scoreSearchField(row.name, query, 104) +
        scoreSearchField(row.summary, query, 74) +
        scoreSearchField(row.evidence, query, 58)

      pushItem({
        itemId: `canon-${row.card_id}`,
        kind: 'canon-card',
        title: row.name,
        snippet: createSearchExcerpt(`${row.summary} ${row.evidence}`, query),
        surface: 'canon',
        entityId: row.card_id,
        score: canonScore
      })
    }

    const revisionStatusById = new Map(
      (
        this.database
          .prepare('SELECT issue_id, status, updated_at FROM revision_issue_state ORDER BY updated_at DESC')
          .all() as RevisionIssueStateRow[]
      ).map((row) => [row.issue_id, row.status])
    )
    const revisionRows = this.database
      .prepare('SELECT issue_id, chapter_id, title, summary, severity FROM revision_issues ORDER BY rowid ASC')
      .all() as RevisionIssueRow[]

    for (const row of revisionRows) {
      if (revisionStatusById.get(row.issue_id) === 'resolved') {
        continue
      }

      const revisionScore =
        scoreSearchField(row.title, query, 106) +
        scoreSearchField(row.summary, query, 76) +
        scoreSearchField(row.severity, query, 24)

      pushItem({
        itemId: `revision-${row.issue_id}`,
        kind: 'revision-issue',
        title: row.title,
        snippet: createSearchExcerpt(`${row.summary} ${row.chapter_id} ${row.severity}`, query),
        surface: 'revision',
        chapterId: row.chapter_id,
        entityId: row.issue_id,
        score: revisionScore
      })
    }

    const exportRows = this.database
      .prepare('SELECT preset_id, title, format, status, summary FROM export_presets ORDER BY rowid ASC')
      .all() as ExportPresetRow[]

    for (const row of exportRows) {
      const exportScore =
        scoreSearchField(row.title, query, 90) +
        scoreSearchField(row.summary, query, 68) +
        scoreSearchField(row.format, query, 36)

      pushItem({
        itemId: `export-${row.preset_id}`,
        kind: 'export-preset',
        title: row.title,
        snippet: createSearchExcerpt(`${row.summary} ${row.format} ${row.status}`, query),
        surface: 'publish',
        entityId: row.preset_id,
        score: exportScore
      })
    }

    return {
      query,
      items: items.sort((left, right) => right.score - left.score).slice(0, limit)
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
    const nextSurface = input.surface === 'analysis' ? 'feature-center' : input.surface
    const nextFeatureTool =
      nextSurface === 'feature-center'
        ? input.featureTool ?? (input.surface === 'analysis' ? 'analysis' : undefined)
        : undefined

    await this.saveConfig({
      ...config,
      currentSurface: nextSurface,
      currentFeatureTool: nextFeatureTool,
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

  async importAnalysisSample(input: ImportAnalysisSampleInputDto): Promise<ImportAnalysisSampleResultDto> {
    const config = await this.loadConfig()
    const extension = extname(input.filePath).toLowerCase()

    if (!['.txt', '.md', '.markdown'].includes(extension)) {
      throw new Error('当前只支持导入 .txt、.md 或 .markdown 文件。')
    }

    const row = buildAnalysisSampleRow(input, {
      projectId: config.projectId,
      title: config.title,
      subtitle: config.subtitle,
      status: config.status,
      genre: config.genre,
      premise: config.premise,
      releaseVersion: config.publishState.currentVersion,
      lastPublishedAt: config.publishState.lastPublishedAt || undefined,
      currentSurface: config.currentSurface,
      currentChapterId: config.currentChapterId
    })

    this.database
      .prepare(
        `INSERT INTO analysis_samples (
            sample_id, title, author, source_label, synopsis, sample_text, tags_json, comments_json,
            scores_json, hook_summary, character_summary, pacing_summary, reader_signals_json,
            risk_signals_json, inspiration_signals_json, imported_at
          ) VALUES (
            @sample_id, @title, @author, @source_label, @synopsis, @sample_text, @tags_json, @comments_json,
            @scores_json, @hook_summary, @character_summary, @pacing_summary, @reader_signals_json,
            @risk_signals_json, @inspiration_signals_json, @imported_at
          )
          ON CONFLICT(sample_id) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            source_label = excluded.source_label,
            synopsis = excluded.synopsis,
            sample_text = excluded.sample_text,
            tags_json = excluded.tags_json,
            comments_json = excluded.comments_json,
            scores_json = excluded.scores_json,
            hook_summary = excluded.hook_summary,
            character_summary = excluded.character_summary,
            pacing_summary = excluded.pacing_summary,
            reader_signals_json = excluded.reader_signals_json,
            risk_signals_json = excluded.risk_signals_json,
            inspiration_signals_json = excluded.inspiration_signals_json,
            imported_at = excluded.imported_at`
      )
      .run(row)

    await this.saveConfig({
      ...config,
      currentSurface: 'feature-center',
      currentFeatureTool: 'analysis'
    })

    return {
      sampleId: row.sample_id,
      title: row.title,
      summary: `已从 ${basename(input.filePath)} 导入《${row.title}》，并完成首轮钩子、人物与节奏拆解。`
    }
  }

  async applyProjectStrategyProposal(
    input: ApplyProjectStrategyProposalInputDto
  ): Promise<ApplyProjectStrategyProposalResultDto> {
    const row = this.database
      .prepare(
        `SELECT sample_id, title, author, source_label, synopsis, sample_text, tags_json, comments_json,
                scores_json, hook_summary, character_summary, pacing_summary, reader_signals_json,
                risk_signals_json, inspiration_signals_json, imported_at
           FROM analysis_samples
          WHERE sample_id = ?`
      )
      .get(input.sampleId) as AnalysisSampleRow | undefined

    if (!row) {
      throw new Error(`未找到拆书样本：${input.sampleId}`)
    }

    const config = await this.loadConfig()
    const sample = mapAnalysisSampleRow(row)
    const generatedQuickActions = buildStrategyQuickActions(sample, {
      projectId: config.projectId,
      title: config.title,
      subtitle: config.subtitle,
      status: config.status,
      genre: config.genre,
      premise: config.premise,
      releaseVersion: config.publishState.currentVersion,
      lastPublishedAt: config.publishState.lastPublishedAt || undefined,
      currentSurface: config.currentSurface,
      currentChapterId: config.currentChapterId
    })
    const generatedCards: CanonCandidateDto[] = [
      {
        cardId: createId('canon-strategy'),
        name: `开篇钩子规则 · ${sample.title}`,
        kind: 'rule',
        summary: sample.inspirationSignals[0] ?? sample.hookSummary,
        visibility: 'candidate',
        evidence: `拆书回写 · ${sample.title} · ${sample.hookSummary}`
      },
      {
        cardId: createId('canon-strategy'),
        name: `读者反馈边界 · ${sample.title}`,
        kind: 'rule',
        summary: sample.riskSignals[0] ?? '避免照搬样本节奏与题材承诺，保持本项目自己的冲突升级方式。',
        visibility: 'candidate',
        evidence: `拆书回写 · ${sample.title} · ${sample.characterSummary}`
      }
    ]

    for (const card of generatedCards) {
      await this.upsertCanonCandidate(card)
    }

    await this.saveConfig({
      ...config,
      currentSurface: 'feature-center',
      currentFeatureTool: 'analysis',
      homeHighlights: mergeHighlights(config.homeHighlights, buildStrategyHighlights(sample)),
      quickActions: mergeQuickActions(config.quickActions, generatedQuickActions)
    })

    return {
      sampleId: input.sampleId,
      createdCanonCardIds: generatedCards.map((card) => card.cardId),
      createdQuickActionIds: generatedQuickActions.map((action) => action.id),
      summary: `已把《${sample.title}》的拆书结论回写成项目高亮、快捷动作和设定候选。`
    }
  }

  async upsertAgentTask(task: AgentTaskDto): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO agent_tasks (task_id, title, summary, status, surface, agent_type)
         VALUES (@task_id, @title, @summary, @status, @surface, @agent_type)
         ON CONFLICT(task_id) DO UPDATE SET
           title = excluded.title,
           summary = excluded.summary,
           status = excluded.status,
           surface = excluded.surface,
           agent_type = excluded.agent_type`
      )
      .run({
        task_id: task.taskId,
        title: task.title,
        summary: task.summary,
        status: task.status,
        surface: task.surface,
        agent_type: task.agentType
      })
  }

  async appendAgentFeed(item: AgentFeedItemDto): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO agent_feed (
            item_id, task_id, kind, title, body, supporting_label, severity,
            proposal_id, approval_id, diff_before, diff_after, created_at
          ) VALUES (
            @item_id, @task_id, @kind, @title, @body, @supporting_label, @severity,
            @proposal_id, @approval_id, @diff_before, @diff_after, @created_at
          )
          ON CONFLICT(item_id) DO NOTHING`
      )
      .run({
        item_id: item.itemId,
        task_id: item.taskId,
        kind: item.kind,
        title: item.title,
        body: item.body,
        supporting_label: item.supportingLabel ?? null,
        severity: item.severity ?? null,
        proposal_id: item.proposalId ?? null,
        approval_id: item.approvalId ?? null,
        diff_before: item.diffPreview?.before ?? null,
        diff_after: item.diffPreview?.after ?? null,
        created_at: item.createdAt
      })
  }

  async saveGeneratedProposal(input: {
    proposalId: string
    chapterId: string
    fullContent: string
    sourceSurface: NovelSurfaceId
    sourceIntent: string
    linkedIssueId?: string
  }): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO proposals (
            proposal_id, chapter_id, full_content, status, source_surface, source_intent, linked_issue_id
          )
         VALUES (
            @proposal_id, @chapter_id, @full_content, @status, @source_surface, @source_intent, @linked_issue_id
          )
         ON CONFLICT(proposal_id) DO UPDATE SET
           chapter_id = excluded.chapter_id,
           full_content = excluded.full_content,
           status = excluded.status,
           source_surface = excluded.source_surface,
           source_intent = excluded.source_intent,
           linked_issue_id = excluded.linked_issue_id`
      )
      .run({
        proposal_id: input.proposalId,
        chapter_id: input.chapterId,
        full_content: normalizeNarrativeContent(input.fullContent),
        status: 'pending',
        source_surface: input.sourceSurface,
        source_intent: input.sourceIntent,
        linked_issue_id: input.linkedIssueId ?? null
      })
  }

  async upsertCanonCandidate(card: CanonCandidateDto): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO canon_candidates (card_id, name, kind, summary, visibility, evidence)
         VALUES (@card_id, @name, @kind, @summary, @visibility, @evidence)
         ON CONFLICT(card_id) DO UPDATE SET
           name = excluded.name,
           kind = excluded.kind,
           summary = excluded.summary,
           visibility = excluded.visibility,
           evidence = excluded.evidence`
      )
      .run({
        card_id: card.cardId,
        name: card.name,
        kind: card.kind,
        summary: card.summary,
        visibility: card.visibility,
        evidence: card.evidence
      })
  }

  async upsertRevisionIssue(issue: RevisionIssueDto): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO revision_issues (issue_id, chapter_id, title, summary, severity)
         VALUES (@issue_id, @chapter_id, @title, @summary, @severity)
         ON CONFLICT(issue_id) DO UPDATE SET
           chapter_id = excluded.chapter_id,
           title = excluded.title,
           summary = excluded.summary,
           severity = excluded.severity`
      )
      .run({
        issue_id: issue.issueId,
        chapter_id: issue.chapterId,
        title: issue.title,
        summary: issue.summary,
        severity: issue.severity
      })

    this.writeRevisionIssueStatus(issue.issueId, issue.status)
  }

  async applyProposal(proposalId: string): Promise<ApplyProposalResultDto> {
    const proposal = this.database
      .prepare(
        `SELECT proposal_id, chapter_id, full_content, status, source_surface, source_intent, linked_issue_id
           FROM proposals
          WHERE proposal_id = ?`
      )
      .get(proposalId) as ProposalRow | undefined

    if (!proposal) {
      throw new Error(`未找到提议：${proposalId}`)
    }

    const config = await this.loadConfig()
    const chapter = this.getChapterConfig(config, proposal.chapter_id)
    const previousContent = normalizeNarrativeContent(await readFile(join(this.workspaceRoot, chapter.file), 'utf8'))
    const issueStatusBefore = proposal.linked_issue_id
      ? (this.getRevisionIssueStatus(proposal.linked_issue_id) ?? 'open')
      : undefined
    const issueTitle = proposal.linked_issue_id ? this.getRevisionIssueTitle(proposal.linked_issue_id) : undefined
    let revisionRecord: RevisionRecordRow | undefined

    if (proposal.source_surface === 'revision') {
      revisionRecord = await this.createRevisionRecord({
        proposal,
        beforeContent: previousContent,
        afterContent: proposal.full_content,
        issueTitle,
        issueStatusBefore
      })
    }

    let saveResult: SaveChapterResultDto

    try {
      saveResult = await this.saveChapterDocument({
        chapterId: proposal.chapter_id,
        content: proposal.full_content
      })
    } catch (error) {
      if (revisionRecord) {
        await this.removeRevisionRecord(revisionRecord.record_id, revisionRecord.snapshot_path)
      }

      throw error
    }

    try {
      this.database
        .prepare('UPDATE proposals SET status = @status WHERE proposal_id = @proposal_id')
        .run({
          status: 'accepted',
          proposal_id: proposalId
        })

      if (proposal.linked_issue_id) {
        this.writeRevisionIssueStatus(proposal.linked_issue_id, 'resolved')
      }
    } catch (error) {
      throw error
    }

    await this.appendAgentFeed({
      itemId: createId('feed'),
      taskId: 'proposal-review',
      kind: 'approval',
      title: '提议已被接受并写回正文',
      body:
        proposal.source_surface === 'revision'
          ? '修订方案已经应用到正文，同时写入可撤销记录并把关联问题标记为已解决。'
          : '正文提议已经应用到当前章节，并保留后续自动更新链继续同步设定与修订结果。',
      supportingLabel: revisionRecord ? `${proposalId} · ${revisionRecord.record_id}` : proposalId,
      proposalId,
      approvalStatus: 'accepted',
      linkedIssueId: proposal.linked_issue_id ?? undefined,
      createdAt: new Date().toISOString()
    })

    return {
      chapterId: saveResult.chapterId,
      proposalId,
      content: saveResult.content,
      summary:
        proposal.source_surface === 'revision'
          ? '已把修订方案应用到当前章节，并写入可撤销修订记录。'
          : '已把右栏提议应用到当前章节草稿。'
    }
  }

  async rejectProposal(proposalId: string): Promise<RejectProposalResultDto> {
    const proposal = this.database
      .prepare(
        `SELECT proposal_id, chapter_id, full_content, status, source_surface, source_intent, linked_issue_id
           FROM proposals
          WHERE proposal_id = ?`
      )
      .get(proposalId) as ProposalRow | undefined

    if (!proposal) {
      throw new Error(`未找到提议：${proposalId}`)
    }

    this.database
      .prepare('UPDATE proposals SET status = @status WHERE proposal_id = @proposal_id')
      .run({
        status: 'rejected',
        proposal_id: proposalId
      })

    await this.appendAgentFeed({
      itemId: createId('feed'),
      taskId: 'proposal-review',
      kind: 'approval',
      title: '提议已被拒绝',
      body:
        proposal.source_surface === 'revision'
          ? '当前修订方案已作废，你可以直接要求修订代理再来一版。'
          : '当前正文提议不会写回草稿，你可以继续让章节代理再给一个版本。',
      supportingLabel: proposalId,
      proposalId,
      approvalStatus: 'rejected',
      linkedIssueId: proposal.linked_issue_id ?? undefined,
      createdAt: new Date().toISOString()
    })

    return {
      chapterId: proposal.chapter_id,
      proposalId,
      summary: '当前提议已拒绝，不会写回正文。'
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

    this.writeRevisionIssueStatus(input.issueId, input.status)

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

  async undoRevisionRecord(recordId: string): Promise<UndoRevisionRecordResultDto> {
    const record = this.database
      .prepare(
        `SELECT record_id, proposal_id, chapter_id, title, summary, before_content, after_content, source_surface,
                linked_issue_id, issue_status_before, issue_status_after, snapshot_path, created_at, undone_at
           FROM revision_records
          WHERE record_id = ?`
      )
      .get(recordId) as RevisionRecordRow | undefined

    if (!record) {
      throw new Error(`未找到修订记录：${recordId}`)
    }

    if (record.undone_at) {
      throw new Error('这条修订记录已经撤销过了。')
    }

    const config = await this.loadConfig()
    const chapter = this.getChapterConfig(config, record.chapter_id)
    const currentContent = normalizeNarrativeContent(await readFile(join(this.workspaceRoot, chapter.file), 'utf8'))

    if (currentContent !== normalizeNarrativeContent(record.after_content)) {
      throw new Error('当前章节在应用后已经继续编辑，暂时不能直接撤销，请先手动比较差异。')
    }

    const saveResult = await this.saveChapterDocument({
      chapterId: record.chapter_id,
      content: record.before_content
    })

    if (record.linked_issue_id && record.issue_status_before) {
      this.writeRevisionIssueStatus(record.linked_issue_id, record.issue_status_before)
    }

    const undoneAt = new Date().toISOString()

    this.database
      .prepare('UPDATE revision_records SET undone_at = @undone_at WHERE record_id = @record_id')
      .run({
        undone_at: undoneAt,
        record_id: record.record_id
      })

    await this.syncRevisionSnapshot({
      ...record,
      undone_at: undoneAt
    })

    await this.appendAgentFeed({
      itemId: createId('feed'),
      taskId: 'revision-undo',
      kind: 'status',
      title: '修订记录已撤销',
      body: `已把“${record.title}”恢复到应用前版本，并同步回修订工作面。`,
      supportingLabel: record.record_id,
      linkedIssueId: record.linked_issue_id ?? undefined,
      createdAt: undoneAt
    })

    return {
      recordId: record.record_id,
      chapterId: saveResult.chapterId,
      content: saveResult.content,
      summary: '已撤销这次修订，并恢复应用前正文。'
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

    const synopsis = input.synopsis.trim()
    const splitChapters = Math.max(1, Math.floor(input.splitChapters))
    const notes = input.notes.trim()
    const recentExports = await loadExportHistory(this.workspaceRoot)
    const previousVersionTag =
      recentExports[0]?.versionTag ??
      (config.publishState.lastPublishedAt ? config.publishState.currentVersion : undefined)
    const versionTag = normalizeVersionTag(input.versionTag || suggestNextVersionTag(previousVersionTag))

    if (!synopsis) {
      throw new Error('发布简介不能为空，请先补齐平台简介再确认导出。')
    }

    if (recentExports.some((item) => item.versionTag === versionTag)) {
      throw new Error(`版本号 ${versionTag} 已存在，请换一个新的版本号后再导出。`)
    }

    const platformFeedback = buildPublishFeedback({
      config,
      preset,
      synopsis,
      splitChapters,
      versionTag,
      previousVersionTag
    })
    const timestamp = new Date().toISOString().replaceAll(':', '-')
    const outputDir = join(
      this.workspaceRoot,
      'exports',
      `${timestamp}-${sanitizeFileSegment(versionTag)}-${preset.preset_id}`
    )
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
    const notesPath = join(outputDir, 'release-notes.md')
    const feedbackPath = join(outputDir, 'platform-feedback.md')
    const manifestPath = join(outputDir, 'manifest.json')
    const generatedAt = new Date().toISOString()

    await writeFile(
      manuscriptPath,
      [`# ${config.title}`, '', `> 版本：${versionTag}`, `> 预设：${preset.title}`, '', ...chapterBlocks].join('\n'),
      'utf8'
    )
    await writeFile(synopsisPath, `${synopsis}\n`, 'utf8')
    await writeFile(
      notesPath,
      `${[
        `# ${versionTag} 发布备注`,
        '',
        notes || `本次导出围绕《${config.title}》的当前主线稿进行版本确认。`,
        ''
      ].join('\n')}\n`,
      'utf8'
    )
    await writeFile(
      feedbackPath,
      `${['# 平台反馈', '', ...platformFeedback.map((item) => `- ${item}`), ''].join('\n')}\n`,
      'utf8'
    )

    const manifest: ExportManifest = {
      projectId: config.projectId,
      title: config.title,
      version: {
        tag: versionTag,
        previousTag: previousVersionTag
      },
      preset: {
        id: preset.preset_id,
        title: preset.title,
        format: preset.format
      },
      synopsis,
      splitChapters,
      notes,
      platformFeedback,
      generatedAt,
      files: [manuscriptPath, synopsisPath, notesPath, feedbackPath]
    }

    await writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8'
    )

    await this.saveConfig({
      ...config,
      currentSurface: 'publish',
      publishState: {
        currentVersion: versionTag,
        lastPublishedAt: generatedAt,
        lastPresetId: preset.preset_id,
        lastManifestPath: manifestPath,
        lastOutputDir: outputDir
      }
    })

    return {
      presetId: preset.preset_id,
      versionTag,
      outputDir,
      manifestPath,
      summary: `已确认并导出 ${versionTag}，结果与平台反馈已回写到项目。`
    }
  }

  private async loadConfig(): Promise<NovelProjectConfig> {
    return normalizeProjectConfig(await readJson<NovelProjectConfig>(this.configPath))
  }

  private loadConfigSync(): NovelProjectConfig {
    return normalizeProjectConfig(JSON.parse(readFileSync(this.configPath, 'utf8')) as NovelProjectConfig)
  }

  private async saveConfig(config: NovelProjectConfig): Promise<void> {
    await writeFile(this.configPath, `${JSON.stringify(normalizeProjectConfig(config), null, 2)}\n`, 'utf8')
  }

  private getRevisionIssueStatus(issueId: string): RevisionIssueDto['status'] | undefined {
    const row = this.database
      .prepare('SELECT status FROM revision_issue_state WHERE issue_id = ?')
      .get(issueId) as { status: RevisionIssueDto['status'] } | undefined

    return row?.status
  }

  private getRevisionIssueTitle(issueId: string): string | undefined {
    const row = this.database
      .prepare('SELECT title FROM revision_issues WHERE issue_id = ?')
      .get(issueId) as { title: string } | undefined

    return row?.title
  }

  private writeRevisionIssueStatus(issueId: string, status: RevisionIssueDto['status']): void {
    this.database
      .prepare(
        `INSERT INTO revision_issue_state (issue_id, status, updated_at)
         VALUES (@issue_id, @status, @updated_at)
         ON CONFLICT(issue_id) DO UPDATE SET
           status = excluded.status,
           updated_at = excluded.updated_at`
      )
      .run({
        issue_id: issueId,
        status,
        updated_at: new Date().toISOString()
      })
  }

  private getChapterConfig(config: NovelProjectConfig, chapterId: string): ChapterConfig {
    const chapter = config.chapters.find((item) => item.chapterId === chapterId)

    if (!chapter) {
      throw new Error(`未找到章节配置：${chapterId}`)
    }

    return chapter
  }

  private async createRevisionRecord(input: {
    proposal: ProposalRow
    beforeContent: string
    afterContent: string
    issueTitle?: string
    issueStatusBefore?: RevisionIssueDto['status']
  }): Promise<RevisionRecordRow> {
    const createdAt = new Date().toISOString()
    const recordId = createId('revision')
    const snapshotPath = join(
      this.workspaceRoot,
      'revisions',
      'snapshots',
      `${createdAt.replaceAll(':', '-')}-${recordId}.md`
    )
    const row: RevisionRecordRow = {
      record_id: recordId,
      proposal_id: input.proposal.proposal_id,
      chapter_id: input.proposal.chapter_id,
      title: input.issueTitle ?? '最小修订已应用',
      summary: input.issueTitle
        ? `围绕“${input.issueTitle}”应用了一版可撤销修订。`
        : '修订代理应用了一版可撤销改写。',
      before_content: normalizeNarrativeContent(input.beforeContent),
      after_content: normalizeNarrativeContent(input.afterContent),
      source_surface: input.proposal.source_surface,
      linked_issue_id: input.proposal.linked_issue_id,
      issue_status_before: input.issueStatusBefore ?? null,
      issue_status_after: input.proposal.linked_issue_id ? 'resolved' : null,
      snapshot_path: snapshotPath,
      created_at: createdAt,
      undone_at: null
    }

    await this.syncRevisionSnapshot(row)

    this.database
      .prepare(
        `INSERT INTO revision_records (
            record_id, proposal_id, chapter_id, title, summary, before_content, after_content, source_surface,
            linked_issue_id, issue_status_before, issue_status_after, snapshot_path, created_at, undone_at
          ) VALUES (
            @record_id, @proposal_id, @chapter_id, @title, @summary, @before_content, @after_content, @source_surface,
            @linked_issue_id, @issue_status_before, @issue_status_after, @snapshot_path, @created_at, @undone_at
          )`
      )
      .run(row)

    return row
  }

  private async syncRevisionSnapshot(record: RevisionRecordRow): Promise<void> {
    const config = await this.loadConfig()
    const chapter = this.getChapterConfig(config, record.chapter_id)
    const content = [
      '# 修订记录',
      '',
      `- 记录 ID：${record.record_id}`,
      `- 提议 ID：${record.proposal_id}`,
      `- 章节：第 ${chapter.order} 章 · ${chapter.title}`,
      `- 来源工作面：${record.source_surface}`,
      `- 关联问题：${record.title}`,
      `- 状态：${record.undone_at ? '已撤销' : '已应用'}`,
      `- 创建时间：${record.created_at}`,
      ...(record.undone_at ? [`- 撤销时间：${record.undone_at}`] : []),
      '',
      '## 摘要',
      '',
      record.summary,
      '',
      '## 应用前',
      '',
      record.before_content.trim(),
      '',
      '## 应用后',
      '',
      record.after_content.trim(),
      ''
    ].join('\n')

    await writeFile(record.snapshot_path, `${content}\n`, 'utf8')
  }

  private async removeRevisionRecord(recordId: string, snapshotPath: string): Promise<void> {
    this.database.prepare('DELETE FROM revision_records WHERE record_id = ?').run(recordId)

    if (snapshotPath && existsSync(snapshotPath)) {
      await unlink(snapshotPath)
    }
  }

  private mapAgentFeedRow(row: AgentFeedRow, proposal?: ProposalRow): AgentFeedItemDto {
    const proposalActions =
      proposal && proposal.status === 'pending'
        ? [
            {
              id: createId('action'),
              label: '应用提议',
              kind: 'apply-proposal' as const,
              proposalId: proposal.proposal_id
            },
            {
              id: createId('action'),
              label: '拒绝',
              kind: 'reject-proposal' as const,
              proposalId: proposal.proposal_id
            },
            {
              id: createId('action'),
              label: '再来一版',
              kind: 'prompt' as const,
              prompt: buildProposalRetryPrompt(proposal),
              surface: proposal.source_surface
            }
          ]
        : undefined
    const actions = proposalActions ?? buildPublishFeedActions(row)

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
      approvalStatus: proposal?.status,
      linkedIssueId: proposal?.linked_issue_id ?? undefined,
      diffPreview:
        row.diff_before && row.diff_after
          ? {
              before: row.diff_before,
              after: row.diff_after
            }
          : undefined,
      actions,
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

export const createFileSystemNovelRepository = (workspaceRoot: string): ProjectRepositoryPort =>
  new FileSystemNovelRepository(workspaceRoot)
