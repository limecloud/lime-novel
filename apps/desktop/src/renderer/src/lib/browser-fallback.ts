import type {
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentTaskDto,
  ApplyProposalResultDto,
  ChapterDocumentDto,
  CommitCanonCardResultDto,
  CreateProjectInputDto,
  CreateExportPackageResultDto,
  DesktopApiContract,
  QuickActionDto,
  SaveChapterResultDto,
  TaskEventDto,
  UpdateRevisionIssueResultDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import { createMockAgentRuntime } from '@lime-novel/agent-runtime'

const quickActions: QuickActionDto[] = [
  {
    id: 'quick-continue',
    label: '推进下一段',
    prompt: '请基于当前章节目标，给我一版更克制但更有悬念推进力的下一段。'
  },
  {
    id: 'quick-canon',
    label: '沉淀设定卡',
    prompt: '把当前章新增的角色、物件和规则提炼成候选卡，并标出证据。'
  },
  {
    id: 'quick-revision',
    label: '检查视角',
    prompt: '检查本章是否出现视角越界，并给出证据与修订建议。'
  }
]

const initialHeader: AgentHeaderDto = {
  currentAgent: '项目总控代理',
  activeSubAgent: '章节代理',
  surface: 'home',
  memorySources: ['项目摘要', '第 12 章', '人物画像', '最近任务'],
  riskLevel: 'medium'
}

const initialTasks: AgentTaskDto[] = [
  {
    taskId: 'task-home-resume',
    title: '恢复现场',
    summary: '把最近写作上下文和后台结果合并成可继续工作的建议面。',
    status: 'completed',
    surface: 'home',
    agentType: 'project'
  },
  {
    taskId: 'task-canon-sync',
    title: '设定候选提取',
    summary: '从第 12 章抽取新物件与人物状态变化。',
    status: 'completed',
    surface: 'canon',
    agentType: 'canon'
  },
  {
    taskId: 'task-revision-scan',
    title: '连续性预扫',
    summary: '确认视角边界与节奏是否偏平。',
    status: 'waiting_approval',
    surface: 'revision',
    agentType: 'revision'
  }
]

const initialFeed: AgentFeedItemDto[] = [
  {
    itemId: 'feed-home-resume',
    taskId: 'task-home-resume',
    kind: 'status',
    title: '项目总控代理已恢复现场',
    body: '建议先继续第 12 章，再处理修订代理刚发现的高优先问题。',
    supportingLabel: '首页 / 建议视图',
    createdAt: '2026-04-02T11:40:00.000Z'
  },
  {
    itemId: 'feed-canon-hit',
    taskId: 'task-canon-sync',
    kind: 'evidence',
    title: '候选设定“钟楼钥匙”已命中',
    body: '物件已经出现两次以上，并开始承载情绪与主线信息，适合提升为正式卡片。',
    supportingLabel: '第 12 章 / 物件候选',
    createdAt: '2026-04-02T11:42:00.000Z'
  },
  {
    itemId: 'feed-rewrite-opening',
    taskId: 'task-revision-scan',
    kind: 'proposal',
    title: '先从开头三段做更克制的悬念推进',
    body: '不用提前揭示门后的信息，只增强感官线索和心理阻力，能更稳地把悬念推进到下一章。',
    supportingLabel: '写作工作面可直接应用',
    proposalId: 'proposal-rewrite-opening',
    diffPreview: {
      before: '她把钥匙按进锁孔，门还是没有开。',
      after: '林清远把钥匙按进锁孔，金属先发出一声潮湿的轻响。'
    },
    actions: [
      {
        id: 'action-apply-proposal',
        label: '应用提议',
        kind: 'apply-proposal',
        proposalId: 'proposal-rewrite-opening'
      }
    ],
    createdAt: '2026-04-02T11:46:00.000Z'
  }
]

const rewrittenChapter = `# 第十二章 钥匙进锁之前

林清远把钥匙按进锁孔，金属先发出一声潮湿的轻响，像某段迟迟不肯说破的旧事在门后换气。

她没有立刻转动，只让指尖贴着冰凉的齿纹往下滑。雨水顺着外套袖口往腕骨里钻，冷得她差一点松手。可真正让她停住的不是冷，而是钟楼里那股熟悉得过分的旧铜味。它像父亲离家前最后一次抱她时，袖口蹭过她额角的气味，只是更潮，也更旧。

楼梯上方没有声音，整座塔像把呼吸憋进了砖缝。她忽然明白，自己拖延的从来不是开门这一个动作，而是门开之后必须承认的事实：这些年她追的也许不是一个失踪者，而是一场被全城默许的沉默。

她终于转动钥匙。
`

const createInitialShell = (): WorkspaceShellDto => ({
  workspacePath: '/Users/coso/Documents/dev/ai/limecloud/lime-novel/playground/demo-project',
  project: {
    projectId: 'proj-lime-novel',
    title: '钟塔尽头的雨季',
    subtitle: '代理优先的长篇小说工作台',
    status: 'drafting',
    genre: '悬疑 / 都市奇幻',
    premise: '女主在父亲失踪后的旧钟楼里，逐步揭开一条被整座城市默许的时间裂缝。',
    currentSurface: 'home',
    currentChapterId: 'chapter-12'
  },
  navigation: [
    { id: 'home', label: '首页', description: '恢复现场与项目健康度' },
    { id: 'writing', label: '写作', description: '章节树、场景与正文编辑' },
    { id: 'canon', label: '设定', description: '候选卡、关系与时间线' },
    { id: 'revision', label: '修订', description: '问题队列、证据与差异' },
    { id: 'publish', label: '发布', description: '导出预设与平台准备' }
  ],
  chapterTree: [
    {
      chapterId: 'chapter-11',
      order: 11,
      title: '旧站台的回声',
      summary: '林清远第一次确认失踪案和钟楼钥匙有关。',
      status: 'revised',
      wordCount: 2890,
      volumeLabel: '第一卷：雨季回声'
    },
    {
      chapterId: 'chapter-12',
      order: 12,
      title: '钥匙进锁之前',
      summary: '她终于站到门前，却发现自己真正害怕的不是门后，而是门开之后必须承认的事实。',
      status: 'draft',
      wordCount: 3264,
      volumeLabel: '第一卷：雨季回声'
    },
    {
      chapterId: 'chapter-13',
      order: 13,
      title: '雨幕下的空层',
      summary: '反派的视角第一次靠近核心秘密，但不能提前泄露信息。',
      status: 'idea',
      wordCount: 0,
      volumeLabel: '第一卷：雨季回声'
    }
  ],
  sceneList: [
    {
      sceneId: 'scene-12-1',
      order: 1,
      title: '楼梯口的迟疑',
      goal: '把心理犹疑写够，让进入钟楼成为主动选择。',
      status: 'drafting'
    },
    {
      sceneId: 'scene-12-2',
      order: 2,
      title: '门锁前的潮气',
      goal: '让钥匙、门锁和旧铜味形成感官钩子。',
      status: 'planned'
    },
    {
      sceneId: 'scene-12-3',
      order: 3,
      title: '第一声异响',
      goal: '把悬念推进到必须进入下一章。',
      status: 'planned'
    }
  ],
  homeHighlights: [
    {
      title: '恢复写作',
      detail: '从第 12 章继续，当前最好先补强进门前的心理犹疑。'
    },
    {
      title: '最近后台结果',
      detail: '设定代理提取了 1 张候选卡，修订代理发现 2 个需要处理的问题。'
    },
    {
      title: '项目健康度',
      detail: '主线稳定，问题集中在第 12 - 13 章的视角边界和节奏抬升。'
    }
  ],
  canonCandidates: [
    {
      cardId: 'canon-key',
      name: '钟楼钥匙',
      kind: 'item',
      summary: '一把带旧铜味的长柄钥匙，只会在大雨或钟鸣时发冷。',
      visibility: 'candidate',
      evidence: '第 12 章反复出现，但尚未沉淀为正式设定卡。'
    },
    {
      cardId: 'canon-character-lin',
      name: '林清远',
      kind: 'character',
      summary: '主角，擅长把恐惧藏在动作细节里，不轻易直接承认情绪。',
      visibility: 'confirmed',
      evidence: '第 1 - 12 章人物画像一致。'
    }
  ],
  revisionIssues: [
    {
      issueId: 'issue-pov-drift',
      chapterId: 'chapter-12',
      title: '视角焦点短暂漂移',
      summary: '有一处句子泄露了林清远当下不可能知道的钟楼内部信息。',
      severity: 'high',
      status: 'open'
    },
    {
      issueId: 'issue-pace-flat',
      chapterId: 'chapter-12',
      title: '悬念推进还不够陡',
      summary: '进门前的心理活动还可以更具体一点，否则动作落点不够强。',
      severity: 'medium',
      status: 'open'
    }
  ],
  exportPresets: [
    {
      presetId: 'export-md',
      title: '长稿 Markdown',
      format: 'markdown',
      status: 'ready',
      summary: '保留章节标题、场景分隔与批注锚点。'
    },
    {
      presetId: 'export-epub',
      title: '连载 EPUB 预设',
      format: 'epub',
      status: 'draft',
      summary: '适合阶段性内测，不含平台元数据。'
    }
  ],
  agentHeader: initialHeader,
  agentTasks: initialTasks,
  agentFeed: initialFeed,
  quickActions,
  recentExports: []
})

const createFallbackProjectState = (input: CreateProjectInputDto): {
  shell: WorkspaceShellDto
  document: ChapterDocumentDto
} => {
  const projectId = `fallback-project-${Math.random().toString(36).slice(2, 8)}`
  const chapterId = 'chapter-1'
  const chapterTitle = input.template === 'mystery' ? '雨刚落下时' : '开篇'
  const chapterContent =
    input.template === 'mystery'
      ? `# 第一章 雨刚落下时

这里是《${input.title}》的第一章草稿。

先写下：
- 主角正在压住什么情绪
- 第一处让人觉得不对劲的细节
- 本章结尾必须继续追下去的那一步
`
      : `# 第一章 开篇

这里是《${input.title}》的第一章草稿。

先写下：
- 主角此刻最急迫的问题
- 故事世界的第一处异常
- 本章结束时必须成立的下一步动作
`

  return {
    shell: {
      workspacePath: `/fallback/projects/${projectId}`,
      project: {
        projectId,
        title: input.title,
        subtitle: input.template === 'mystery' ? 'AI 代理协作悬疑小说项目' : 'AI 代理协作小说项目',
        status: 'planning',
        genre: input.genre || '待定题材',
        premise: input.premise || '请补充故事 premise，让代理围绕主线稳定协作。',
        currentSurface: 'home',
        currentChapterId: chapterId
      },
      navigation: [
        { id: 'home', label: '首页', description: '恢复现场与项目健康度' },
        { id: 'writing', label: '写作', description: '章节树、场景与正文编辑' },
        { id: 'canon', label: '设定', description: '候选卡、关系与时间线' },
        { id: 'revision', label: '修订', description: '问题队列、证据与差异' },
        { id: 'publish', label: '发布', description: '导出预设与平台准备' }
      ],
      chapterTree: [
        {
          chapterId,
          order: 1,
          title: chapterTitle,
          summary: input.template === 'mystery' ? '建立异常感与第一处悬念入口。' : '建立人物、冲突和下一步动作入口。',
          status: 'draft',
          wordCount: chapterContent.replace(/\s+/g, '').length,
          volumeLabel: '第一卷'
        }
      ],
      sceneList: [
        {
          sceneId: 'scene-1-1',
          order: 1,
          title: input.template === 'mystery' ? '第一处异样感' : '开场镜头',
          goal: input.template === 'mystery' ? '让异常感和人物反应同时出现。' : '让人物处境和当前动作同时成立。',
          status: 'planned'
        }
      ],
      homeHighlights: [
        {
          title: '恢复写作',
          detail: '先补第一章目标和开场动作，再进入正文推进。'
        },
        {
          title: '最近后台结果',
          detail: '项目总控代理已装配基础工作面与默认动作。'
        },
        {
          title: '项目健康度',
          detail: '新项目结构已准备好，接下来最重要的是建立第一章冲突。'
        }
      ],
      canonCandidates: [],
      revisionIssues: [],
      exportPresets: [
        {
          presetId: 'export-md',
          title: '长稿 Markdown',
          format: 'markdown',
          status: 'ready',
          summary: '保留章节标题、场景分隔与批注锚点。'
        },
        {
          presetId: 'export-epub',
          title: '连载 EPUB 预设',
          format: 'epub',
          status: 'draft',
          summary: '适合阶段性内测，不含平台元数据。'
        }
      ],
      agentHeader: initialHeader,
      agentTasks: [
        {
          taskId: 'task-project-bootstrap',
          title: '项目已创建',
          summary: '项目总控代理已经装配基础结构，建议先完成第一章目标。',
          status: 'completed',
          surface: 'home',
          agentType: 'project'
        }
      ],
      agentFeed: [
        {
          itemId: 'feed-project-bootstrap',
          taskId: 'task-project-bootstrap',
          kind: 'status',
          title: '新的小说项目已经就绪',
          body: '现在可以先补第一章目标、主角处境和第一处冲突，再切到写作工作面。',
          supportingLabel: '首页 / 项目总控代理',
          createdAt: new Date().toISOString()
        }
      ],
      quickActions: [
        {
          id: 'quick-outline',
          label: '补第一章目标',
          prompt: '请根据当前 premise，补齐第一章的冲突、主角欲望和结尾落点。'
        },
        {
          id: 'quick-canon',
          label: '先建设定卡',
          prompt: '请帮我建立主角、地点和规则三类基础设定卡草案。'
        },
        {
          id: 'quick-revision',
          label: '检查开场',
          prompt: '请检查当前开场是否已经建立人物处境、冲突与可持续悬念。'
        }
      ],
      recentExports: []
    },
    document: {
      chapterId,
      title: `第1章 ${chapterTitle}`,
      objective: input.template === 'mystery' ? '让读者先感到不对劲，再看见主角为何必须靠近。' : '建立人物、世界和冲突入口，让正文能自然继续推进。',
      lastEditedAt: '2026-04-02 22:36',
      wordCount: chapterContent.replace(/\s+/g, '').length,
      content: `${chapterContent.trimEnd()}\n`
    }
  }
}

export const createBrowserFallbackApi = (): DesktopApiContract => {
  const runtime = createMockAgentRuntime()
  const shell = createInitialShell()
  const exportedPackages: CreateExportPackageResultDto[] = []
  const chapterDocuments = new Map<string, ChapterDocumentDto>([
    [
      'chapter-12',
      {
        chapterId: 'chapter-12',
        title: '第12章 钥匙进锁之前',
        objective: '让林清远在进入钟楼前完成一次主动选择，而不是被剧情推着走。',
        lastEditedAt: '2026-04-02 20:16',
        wordCount: 3264,
        content: `# 第十二章 钥匙进锁之前

她把钥匙按进锁孔，门还是没有开。

雨顺着扶手往下淌，像一段被拖长的呼吸。林清远抬起手，又放下。她明明已经走到这里，却还是迟迟不肯把第二个动作做完。不是因为冷，也不是因为怕，而是因为她知道，门后的东西一旦真的出现，过去十年里她赖以维持秩序的解释就会全部失效。

她想起父亲失踪前最后一次回头时，衣角上带着一阵轻微的铜味。那气味现在正从门缝里渗出来，一点一点，把她拖回到那个雨夜。
`
      }
    ]
  ])

  return {
    workspace: {
      loadShell: async () => shell,
      updateContext: async (input) => {
        shell.project.currentSurface = input.surface
        if (input.chapterId) {
          shell.project.currentChapterId = input.chapterId
        }
      },
      createProject: async (input) => {
        const next = createFallbackProjectState(input)

        shell.workspacePath = next.shell.workspacePath
        shell.project = next.shell.project
        shell.navigation = next.shell.navigation
        shell.chapterTree = next.shell.chapterTree
        shell.sceneList = next.shell.sceneList
        shell.homeHighlights = next.shell.homeHighlights
        shell.canonCandidates = next.shell.canonCandidates
        shell.revisionIssues = next.shell.revisionIssues
        shell.exportPresets = next.shell.exportPresets
        shell.agentHeader = next.shell.agentHeader
        shell.agentTasks = next.shell.agentTasks
        shell.agentFeed = next.shell.agentFeed
        shell.quickActions = next.shell.quickActions
        shell.recentExports = next.shell.recentExports

        chapterDocuments.clear()
        chapterDocuments.set(next.document.chapterId, next.document)

        return {
          workspacePath: next.shell.workspacePath,
          projectId: next.shell.project.projectId,
          title: next.shell.project.title
        }
      },
      openProjectDialog: async () => ({
        workspacePath: shell.workspacePath,
        projectId: shell.project.projectId,
        title: shell.project.title
      })
    },
    chapter: {
      loadDocument: async (chapterId: string) => {
        const document = chapterDocuments.get(chapterId)
        if (!document) {
          throw new Error(`未找到章节：${chapterId}`)
        }
        return document
      },
      saveDocument: async (input): Promise<SaveChapterResultDto> => {
        const current = chapterDocuments.get(input.chapterId)
        if (!current) {
          throw new Error(`未找到章节：${input.chapterId}`)
        }

        const nextContent = `${input.content.trimEnd()}\n`
        const nextEditedAt = '2026-04-02 22:08'
        const nextWordCount = nextContent.replace(/\s+/g, '').length

        chapterDocuments.set(input.chapterId, {
          ...current,
          content: nextContent,
          lastEditedAt: nextEditedAt,
          wordCount: nextWordCount
        })
        shell.project.currentSurface = 'writing'
        shell.project.currentChapterId = input.chapterId
        shell.chapterTree = shell.chapterTree.map((chapter) =>
          chapter.chapterId === input.chapterId
            ? {
                ...chapter,
                wordCount: nextWordCount
              }
            : chapter
        )

        return {
          chapterId: input.chapterId,
          content: nextContent,
          wordCount: nextWordCount,
          lastEditedAt: nextEditedAt,
          summary: '正文已保存到本地草稿。'
        }
      },
      applyProposal: async (proposalId: string): Promise<ApplyProposalResultDto> => {
        if (proposalId !== 'proposal-rewrite-opening') {
          throw new Error(`未找到提议：${proposalId}`)
        }

        chapterDocuments.set('chapter-12', {
          chapterId: 'chapter-12',
          title: '第12章 钥匙进锁之前',
          objective: '让林清远在进入钟楼前完成一次主动选择，而不是被剧情推着走。',
          lastEditedAt: '2026-04-02 21:08',
          wordCount: rewrittenChapter.replace(/\s+/g, '').length,
          content: rewrittenChapter
        })
        shell.revisionIssues = shell.revisionIssues.filter((issue) => issue.issueId !== 'issue-pov-drift')

        return {
          chapterId: 'chapter-12',
          proposalId,
          content: rewrittenChapter,
          summary: '已把右栏提议应用到当前章节草稿。'
        }
      }
    },
    canon: {
      commitCard: async (input): Promise<CommitCanonCardResultDto> => {
        shell.canonCandidates = shell.canonCandidates.map((card) =>
          card.cardId === input.cardId
            ? {
                ...card,
                visibility: input.visibility
              }
            : card
        )

        return {
          cardId: input.cardId,
          visibility: input.visibility,
          outputPath: `/fallback/canon/${input.cardId}.md`,
          summary: '设定卡已写回回退环境。'
        }
      }
    },
    revision: {
      updateIssue: async (input): Promise<UpdateRevisionIssueResultDto> => {
        shell.revisionIssues = shell.revisionIssues
          .map((issue) =>
            issue.issueId === input.issueId
              ? {
                  ...issue,
                  status: input.status
                }
              : issue
          )
          .filter((issue) => issue.status !== 'resolved')

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
    },
    publish: {
      createExportPackage: async (input): Promise<CreateExportPackageResultDto> => {
        const result = {
          presetId: input.presetId,
          outputDir: `/fallback/exports/${input.presetId}`,
          manifestPath: `/fallback/exports/${input.presetId}/manifest.json`,
          summary: '导出包已生成到回退环境。'
        }
        exportedPackages.unshift(result)
        shell.recentExports = exportedPackages.map((item, index) => ({
          exportId: `fallback-${index + 1}`,
          presetId: item.presetId,
          generatedAt: new Date().toISOString(),
          outputDir: item.outputDir,
          manifestPath: item.manifestPath
        }))
        return result
      }
    },
    agent: {
      startTask: async (input) => runtime.startTask(input),
      subscribeTaskEvents: (callback: (event: TaskEventDto) => void) => runtime.subscribe(callback)
    }
  }
}
