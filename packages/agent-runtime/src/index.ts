import { createId, nowIso } from '@lime-novel/shared-kernel'
import type {
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentRuntimePort,
  AgentTaskDto,
  CanonCandidateDto,
  ChapterDocumentDto,
  ProjectRepositoryPort,
  RevisionIssueDto,
  StartTaskInputDto,
  StartTaskResultDto,
  TaskEventDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { NovelSurfaceId, TaskStatus } from '@lime-novel/domain-novel'

type AgentArtifacts = {
  feed: AgentFeedItemDto[]
  finalStatus: TaskStatus
  finalSummary: string
}

const inferPublishRiskLevel = (shell: WorkspaceShellDto): AgentHeaderDto['riskLevel'] => {
  if (shell.latestExportComparison?.riskLevel === 'high') {
    return 'high'
  }

  if (
    shell.exportPresets.some((preset) => preset.status === 'draft') ||
    shell.latestExportComparison?.riskLevel === 'medium'
  ) {
    return 'medium'
  }

  return 'low'
}

const buildHeader = (surface: StartTaskInputDto['surface'], shell: WorkspaceShellDto): AgentHeaderDto => {
  if (surface === 'writing') {
    return {
      currentAgent: '章节代理',
      activeSubAgent: '现场续写子代理',
      surface,
      memorySources: [
        shell.project.title,
        shell.sceneList[0]?.title ?? '当前场景',
        shell.project.premise,
        shell.chapterTree[0]?.title ?? '当前章节'
      ],
      riskLevel: 'medium'
    }
  }

  if (surface === 'canon') {
    return {
      currentAgent: '设定代理',
      activeSubAgent: '事实抽取子代理',
      surface,
      memorySources: [
        shell.chapterTree[0]?.title ?? '当前章节',
        shell.sceneList[0]?.goal ?? '当前场景目标',
        `${shell.canonCandidates.length} 张候选卡`,
        shell.project.genre
      ],
      riskLevel: 'medium'
    }
  }

  if (surface === 'analysis') {
    const overview = shell.analysisOverview

    return {
      currentAgent: '拆书代理',
      activeSubAgent: '样本建模子代理',
      surface,
      memorySources: [
        `${overview.sampleCount} 个爆款样本`,
        overview.dominantTags[0] ?? shell.project.genre,
        overview.projectAngles[0] ?? shell.project.premise,
        overview.cautionSignals[0] ?? '等待更多评论信号'
      ],
      riskLevel: overview.cautionSignals.length > 1 ? 'medium' : 'low'
    }
  }

  if (surface === 'revision') {
    return {
      currentAgent: '修订代理',
      activeSubAgent: '连续性检查子代理',
      surface,
      memorySources: [
        shell.chapterTree[0]?.title ?? '当前章节',
        `${shell.revisionIssues.length} 个待处理问题`,
        shell.project.premise,
        shell.project.genre
      ],
      riskLevel: 'high'
    }
  }

  if (surface === 'publish') {
    const readyPresets = shell.exportPresets.filter((preset) => preset.status === 'ready').length
    const latestExport = shell.recentExports[0]
    const comparisonSummary =
      shell.latestExportComparison?.changedFields.slice(0, 2).join(' / ') ??
      `${shell.recentExports.length} 次最近导出`

    return {
      currentAgent: '发布代理',
      activeSubAgent: '导出预检子代理',
      surface,
      memorySources: [
        `${readyPresets}/${shell.exportPresets.length} 个预设可导出`,
        `当前版本 ${shell.project.releaseVersion}`,
        latestExport ? `最近导出 ${latestExport.versionTag}` : '当前还没有正式导出',
        `版本比较：${comparisonSummary || '暂无参数差异'}`
      ],
      riskLevel: inferPublishRiskLevel(shell)
    }
  }

  return {
    currentAgent: '项目总控代理',
    activeSubAgent: '现场恢复子代理',
    surface,
    memorySources: [
      shell.project.title,
      shell.project.premise,
      `${shell.chapterTree.length} 章`,
      `${shell.revisionIssues.length} 个修订问题`
    ],
    riskLevel: shell.revisionIssues.some((issue) => issue.severity === 'high') ? 'high' : 'medium'
  }
}

const buildTaskTitle = (surface: NovelSurfaceId, intent: string): string => {
  if (surface === 'writing') {
    return intent.includes('改') ? '章节改写' : '章节推进'
  }

  if (surface === 'canon') {
    return '设定提取'
  }

  if (surface === 'analysis') {
    if (/(立项|策略|启发|对标)/u.test(intent)) {
      return '立项启发'
    }

    if (/(比较|对比|样本)/u.test(intent)) {
      return '样本对比'
    }

    return '拆书分析'
  }

  if (surface === 'revision') {
    return '修订检查'
  }

  if (surface === 'publish') {
    if (/(简介|文案|宣传)/u.test(intent)) {
      return '发布文案'
    }

    if (/(备注|说明|发布单|release)/iu.test(intent)) {
      return '发布备注'
    }

    if (/(比较|差异|版本|变化)/u.test(intent)) {
      return '版本比较'
    }

    if (/(确认|复核|导出|发布)/u.test(intent)) {
      return '导出确认'
    }

    return '发布预检'
  }

  return '项目恢复'
}

const buildProposalRetryPrompt = (
  surface: NovelSurfaceId,
  sourceIntent: string,
  issueTitle?: string
): string => {
  const normalizedIntent = sourceIntent.trim()

  if (surface === 'revision') {
    return `刚才围绕“${issueTitle ?? '当前修订问题'}”的任务是：“${normalizedIntent}”。请再来一版更克制、改动更小的修订方案，只输出可应用提议与一句理由。`
  }

  return `刚才的任务是：“${normalizedIntent}”。请在同一章节目标下，再来一版更克制、语气更稳的可应用提议，不要直接覆盖正文。`
}

const extractBodyParagraphs = (content: string): string[] =>
  content
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !segment.startsWith('#'))

const replaceFirstBodyParagraph = (content: string, nextParagraph: string): string => {
  const parts = content
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  const firstBodyIndex = parts.findIndex((segment) => !segment.startsWith('#'))

  if (firstBodyIndex < 0) {
    return `${content.trim()}\n\n${nextParagraph}\n`
  }

  const nextParts = [...parts]
  nextParts[firstBodyIndex] = nextParagraph.trim()
  return `${nextParts.join('\n\n').trim()}\n`
}

const appendParagraphs = (content: string, paragraphs: string[]): string =>
  `${content.trimEnd()}\n\n${paragraphs.map((paragraph) => paragraph.trim()).join('\n\n')}\n`

const toSnippet = (value: string, maxLength = 40): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`

const pickScene = (shell: WorkspaceShellDto, chapterId?: string) =>
  shell.sceneList.find((scene) => scene.sceneId === chapterId) ?? shell.sceneList[0]

const extractKeyTerms = (content: string, fallbackTerms: string[]): string[] => {
  const stopwords = new Set([
    '当前',
    '工作台',
    '项目',
    '继续',
    '这里',
    '一个',
    '这部',
    '因为',
    '已经',
    '没有',
    '不是',
    '可以',
    '自己',
    '时候',
    '场景',
    '章节',
    '正文',
    '目标',
    '主线',
    '故事',
    '动作',
    '结果',
    '问题',
    '建议',
    '设定',
    '修订',
    '导出'
  ])

  const counts = new Map<string, number>()
  const matches = content.match(/[\u4e00-\u9fff]{2,6}/g) ?? []

  for (const token of matches) {
    if (stopwords.has(token)) {
      continue
    }

    counts.set(token, (counts.get(token) ?? 0) + 1)
  }

  const ranked = [...counts.entries()]
    .sort((left, right) => {
      if (right[1] === left[1]) {
        return right[0].length - left[0].length
      }

      return right[1] - left[1]
    })
    .map(([token]) => token)

  return [...new Set([...fallbackTerms.filter(Boolean), ...ranked])].slice(0, 3)
}

const inferCanonKind = (term: string): CanonCandidateDto['kind'] => {
  if (/(楼|塔|街|巷|馆|室|城|镇|村|桥|门)$/u.test(term)) {
    return 'location'
  }

  if (/(规则|禁忌|仪式|律|约定)$/u.test(term)) {
    return 'rule'
  }

  if (/(钥匙|手稿|相片|信封|门锁|戒指|碎片|地图)$/u.test(term)) {
    return 'item'
  }

  return 'item'
}

const buildWritingProposal = (
  shell: WorkspaceShellDto,
  chapter: ChapterDocumentDto,
  intent: string
): {
  proposalId: string
  fullContent: string
  before: string
  after: string
  title: string
  body: string
} => {
  const paragraphs = extractBodyParagraphs(chapter.content)
  const firstParagraph = paragraphs[0] ?? chapter.objective
  const lastParagraph = paragraphs.at(-1) ?? chapter.objective
  const sceneTitle = shell.sceneList[0]?.title ?? '当前场景'
  const sceneGoal = shell.sceneList[0]?.goal ?? chapter.objective
  const proposalId = createId('proposal')

  if (intent.includes('改') || intent.includes('开头') || intent.includes('克制')) {
    const rewrittenOpening = [
      `${sceneTitle}里没有任何多余解释，先逼近的是动作本身。`,
      `她把注意力压回到眼前那一步，只让${toSnippet(sceneGoal, 18)}先发生，再把情绪藏进更细的反应里。`
    ].join('')

    return {
      proposalId,
      fullContent: replaceFirstBodyParagraph(chapter.content, rewrittenOpening),
      before: toSnippet(firstParagraph, 48),
      after: toSnippet(rewrittenOpening, 48),
      title: '开头改写提议已生成',
      body: '已经把开头收紧为“动作先落下、解释后补足”的版本，适合直接应用到正文。'
    }
  }

  const continuationParagraphs = [
    `她没有再把注意力让给犹豫，反而顺着${toSnippet(sceneGoal, 18)}往前推了一步。眼前的信息仍然不完整，但动作已经替她做出了选择。`,
    `真正需要被确认的，不是答案本身，而是${toSnippet(lastParagraph, 20)}之后还能不能继续成立。于是她把下一步落到更具体的感官与细节上，让场景继续向前。`
  ]

  return {
    proposalId,
    fullContent: appendParagraphs(chapter.content, continuationParagraphs),
    before: toSnippet(lastParagraph, 48),
    after: toSnippet(continuationParagraphs[0], 48),
    title: '续写提议已生成',
    body: '已经基于当前章节目标补了一版可直接应用的下一段，保持当前场景继续向前。'
  }
}

const buildWritingArtifacts = async (
  repository: ProjectRepositoryPort,
  shell: WorkspaceShellDto,
  input: StartTaskInputDto,
  task: AgentTaskDto
): Promise<AgentArtifacts> => {
  const chapterId = input.chapterId ?? shell.project.currentChapterId
  const chapter = await repository.loadChapterDocument(chapterId)
  const proposal = buildWritingProposal(shell, chapter, input.intent)

  await repository.saveGeneratedProposal({
    proposalId: proposal.proposalId,
    chapterId,
    fullContent: proposal.fullContent,
    sourceSurface: 'writing',
    sourceIntent: input.intent
  })

  return {
    feed: [
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'status',
        title: `${chapter.title} 的上下文已装配`,
        body: `当前任务会围绕“${chapter.objective}”继续推进，并优先贴合 ${shell.sceneList[0]?.title ?? '当前场景'}。`,
        supportingLabel: `${shell.project.title} / 写作工作面`,
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'evidence',
        title: '当前场景目标已命中',
        body: shell.sceneList[0]?.goal ?? chapter.objective,
        supportingLabel: `${chapter.title} / 场景目标`,
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'proposal',
        title: proposal.title,
        body: proposal.body,
        supportingLabel: `${chapter.title} / 可直接应用`,
        proposalId: proposal.proposalId,
        approvalStatus: 'pending',
        diffPreview: {
          before: proposal.before,
          after: proposal.after
        },
        actions: [
          {
            id: createId('action'),
            label: '应用提议',
            kind: 'apply-proposal',
            proposalId: proposal.proposalId
          },
          {
            id: createId('action'),
            label: '拒绝',
            kind: 'reject-proposal',
            proposalId: proposal.proposalId
          },
          {
            id: createId('action'),
            label: '再来一版',
            kind: 'prompt',
            prompt: buildProposalRetryPrompt('writing', input.intent),
            surface: 'writing'
          }
        ],
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'approval',
        title: '正文提议等待确认',
        body: '这一版改写不会直接覆盖正文，请先在右栏接受、拒绝或要求再来一版。',
        supportingLabel: `${chapter.title} / 审批边界`,
        proposalId: proposal.proposalId,
        approvalStatus: 'pending',
        createdAt: nowIso()
      }
    ],
    finalStatus: 'waiting_approval',
    finalSummary: '已经生成一版可应用的正文提议。'
  }
}

const shouldGenerateRevisionProposal = (intent: string): boolean =>
  /(方案|改写|重写|再来一版|克制|应用)/u.test(intent)

const buildRevisionProposal = (
  chapter: ChapterDocumentDto,
  issue: RevisionIssueDto,
  intent: string
): {
  proposalId: string
  fullContent: string
  before: string
  after: string
  title: string
  body: string
} => {
  const paragraphs = extractBodyParagraphs(chapter.content)
  const firstParagraph = paragraphs[0] ?? chapter.objective
  const isRestrained = intent.includes('再来一版') || intent.includes('克制')
  const proposalId = createId('proposal')

  if (issue.title.includes('视角')) {
    const rewritten = isRestrained
      ? '林清远先被钟声逼得耳骨发紧，才把视线压回门锁。她不去猜门后有什么，只抓住自己能够确认的潮湿铜味与楼梯回声，让紧张留在身体反应里。'
      : '钟声贴着耳骨落下来时，林清远先摸到口袋里的旧硬币，才勉强稳住呼吸。她没有越过门板去想象里面发生过什么，只盯着锁孔边缘那一圈被雨气浸亮的铜色。'

    return {
      proposalId,
      fullContent: replaceFirstBodyParagraph(chapter.content, rewritten),
      before: toSnippet(firstParagraph, 48),
      after: toSnippet(rewritten, 48),
      title: '修订方案 A 已生成',
      body: '已经围绕视角边界给出一版最小修订方案，优先把越界信息收回到角色可感知范围。'
    }
  }

  if (issue.title.includes('密度') || issue.title.includes('节奏')) {
    const rewritten = isRestrained
      ? '她没有继续解释门后的意义，只让钥匙、门锁和旧铜味更快碰到一起。动作先发生，判断被压到下一拍，整段呼吸会更稳。'
      : '她把解释压短，只留下钥匙进锁、门锁回声和旧铜味同时逼近的那一下。这样动作会更早落地，悬念也不需要靠额外说明支撑。'

    return {
      proposalId,
      fullContent: replaceFirstBodyParagraph(chapter.content, rewritten),
      before: toSnippet(firstParagraph, 48),
      after: toSnippet(rewritten, 48),
      title: '节奏修订方案已生成',
      body: '已经把开头改成更快落动作的一版，优先解决解释偏多、推进偏缓的问题。'
    }
  }

  const rewritten = isRestrained
    ? '她先确认眼前能够被看见、被听见的细节，再决定下一步动作，把容易冲突的解释全部往后收。'
    : '她先把能够确认的事实落成动作，再把解释延后，让当前章的冲突和信息边界重新对齐。'

  return {
    proposalId,
    fullContent: replaceFirstBodyParagraph(chapter.content, rewritten),
    before: toSnippet(firstParagraph, 48),
    after: toSnippet(rewritten, 48),
    title: '最小修订方案已生成',
    body: '已经基于当前问题给出一版最小改动的修订方案，方便先验证冲突是否被消掉。'
  }
}

const buildCanonArtifacts = async (
  repository: ProjectRepositoryPort,
  shell: WorkspaceShellDto,
  input: StartTaskInputDto,
  task: AgentTaskDto
): Promise<AgentArtifacts> => {
  const chapterId = input.chapterId ?? shell.project.currentChapterId
  const chapter = await repository.loadChapterDocument(chapterId)
  const scene = shell.sceneList[0]
  const terms = extractKeyTerms(chapter.content, [scene?.title ?? '', chapter.title.replace(/^第\d+章\s*/u, '')])

  const cards: CanonCandidateDto[] = terms.slice(0, 2).map((term, index) => ({
    cardId: createId(`canon-${index + 1}`),
    name: term,
    kind: inferCanonKind(term),
    summary: `在 ${chapter.title} 中被反复调用，当前承担“${scene?.goal ?? chapter.objective}”的叙事功能，适合继续追踪。`,
    visibility: 'candidate',
    evidence: `章节：${chapter.title} · 场景：${scene?.title ?? '当前场景'} · 线索词：${term}`
  }))

  for (const card of cards) {
    await repository.upsertCanonCandidate(card)
  }

  return {
    feed: [
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'status',
        title: '设定提取已完成',
        body: `已从 ${chapter.title} 提炼出 ${cards.length} 张新的候选设定卡，并写入项目运行仓储。`,
        supportingLabel: `${shell.project.title} / 设定工作面`,
        createdAt: nowIso()
      },
      ...cards.map((card) => ({
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'evidence' as const,
        title: `候选设定：${card.name}`,
        body: card.summary,
        supportingLabel: card.evidence,
        createdAt: nowIso()
      }))
    ],
    finalStatus: 'completed',
    finalSummary: '候选设定已经写入当前项目。'
  }
}

const pickAnalysisSample = (shell: WorkspaceShellDto, intent: string) =>
  shell.analysisSamples.find((sample) => intent.includes(sample.title)) ?? shell.analysisSamples[0]

const buildAnalysisArtifacts = (
  shell: WorkspaceShellDto,
  input: StartTaskInputDto,
  task: AgentTaskDto
): AgentArtifacts => {
  const sample = pickAnalysisSample(shell, input.intent)
  const overview = shell.analysisOverview

  if (!sample) {
    return {
      feed: [
        {
          itemId: createId('feed'),
          taskId: task.taskId,
          kind: 'status',
          title: '拆书代理还没有拿到样本',
          body: '先导入至少一个爆款样本，再让拆书代理生成立项启发或对标建议。',
          supportingLabel: `${shell.project.title} / 拆书工作面`,
          createdAt: nowIso()
        }
      ],
      finalStatus: 'completed',
      finalSummary: '当前没有可分析的爆款样本。'
    }
  }

  return {
    feed: [
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'status',
        title: `拆书代理已装配《${sample.title}》`,
        body: `当前已把 ${overview.sampleCount} 个样本的共性读进来，并优先围绕《${sample.title}》生成立项参考。`,
        supportingLabel: `${sample.sourceLabel} / ${sample.author}`,
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'evidence',
        title: '样本钩子与人物吸引点已命中',
        body: `${sample.hookSummary} ${sample.characterSummary}`,
        supportingLabel: sample.tags.join(' / '),
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: sample.riskSignals.length > 0 ? 'issue' : 'evidence',
        title: sample.riskSignals.length > 0 ? '样本风险边界需要保留' : '当前样本没有明显风险外露',
        body:
          sample.riskSignals[0] ??
          '当前样本最值得保留的是其题材承诺与角色反差之间的咬合方式。',
        supportingLabel: sample.pacingSummary,
        severity: sample.riskSignals.length > 0 ? 'medium' : undefined,
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'status',
        title: '立项启发已整理',
        body: sample.inspirationSignals.join(' '),
        supportingLabel: `对标 ${shell.project.title} / ${overview.dominantTags.join('、') || shell.project.genre}`,
        createdAt: nowIso()
      }
    ],
    finalStatus: 'completed',
    finalSummary: '拆书结论与立项启发已同步到当前工作面。'
  }
}

const buildRevisionArtifacts = async (
  repository: ProjectRepositoryPort,
  shell: WorkspaceShellDto,
  input: StartTaskInputDto,
  task: AgentTaskDto
): Promise<AgentArtifacts> => {
  const chapterId = input.chapterId ?? shell.project.currentChapterId
  const chapter = await repository.loadChapterDocument(chapterId)
  const paragraphs = extractBodyParagraphs(chapter.content)
  const averageLength =
    paragraphs.length > 0
      ? Math.round(paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0) / paragraphs.length)
      : chapter.content.length

  const title =
    input.intent.includes('视角')
      ? '视角边界待复核'
      : averageLength > 120
        ? '段落密度偏高'
        : '推进节点还可再收紧'
  const summary =
    input.intent.includes('视角')
      ? '需要确认叙述信息都仍然留在当前角色可感知范围内，避免越界说明。'
      : averageLength > 120
        ? '当前章节段落平均长度偏高，阅读呼吸点不足，建议拆句并提前动作落点。'
        : '当前章的推进仍然以解释为主，建议把动作和选择提前半步。'

  const existingIssue = shell.revisionIssues.find((issue) => issue.chapterId === chapterId && issue.title === title)
  const issue: RevisionIssueDto = {
    issueId: existingIssue?.issueId ?? createId('issue'),
    chapterId,
    title,
    summary,
    severity: input.intent.includes('视角') ? 'high' : 'medium',
    status: 'open'
  }

  await repository.upsertRevisionIssue(issue)

  const shouldAttachProposal = shouldGenerateRevisionProposal(input.intent)
  const proposal = shouldAttachProposal ? buildRevisionProposal(chapter, issue, input.intent) : undefined

  if (proposal) {
    await repository.saveGeneratedProposal({
      proposalId: proposal.proposalId,
      chapterId,
      fullContent: proposal.fullContent,
      sourceSurface: 'revision',
      sourceIntent: input.intent,
      linkedIssueId: issue.issueId
    })
  }

  return {
    feed: [
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'status',
        title: '修订扫描已完成',
        body: `已对 ${chapter.title} 做本地规则检查，并把问题队列同步回项目运行仓储。`,
        supportingLabel: `${shell.project.title} / 修订工作面`,
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'issue',
        title: issue.title,
        body: issue.summary,
        supportingLabel: `${chapter.title} / 平均段长 ${averageLength} 字`,
        severity: issue.severity,
        createdAt: nowIso()
      },
      ...(proposal
        ? [
            {
              itemId: createId('feed'),
              taskId: task.taskId,
              kind: 'proposal' as const,
              title: proposal.title,
              body: proposal.body,
              supportingLabel: `${chapter.title} / ${issue.title}`,
              proposalId: proposal.proposalId,
              approvalStatus: 'pending' as const,
              linkedIssueId: issue.issueId,
              diffPreview: {
                before: proposal.before,
                after: proposal.after
              },
              actions: [
                {
                  id: createId('action'),
                  label: '应用提议',
                  kind: 'apply-proposal' as const,
                  proposalId: proposal.proposalId
                },
                {
                  id: createId('action'),
                  label: '拒绝',
                  kind: 'reject-proposal' as const,
                  proposalId: proposal.proposalId
                },
                {
                  id: createId('action'),
                  label: '再来一版',
                  kind: 'prompt' as const,
                  prompt: buildProposalRetryPrompt('revision', input.intent, issue.title),
                  surface: 'revision' as const
                }
              ],
              createdAt: nowIso()
            },
            {
              itemId: createId('feed'),
              taskId: task.taskId,
              kind: 'approval' as const,
              title: '修订方案等待确认',
              body: '修订代理已经给出一版可应用方案。确认前不会直接改正文，适合先比较差异再决定。',
              supportingLabel: `${chapter.title} / ${issue.title}`,
              proposalId: proposal.proposalId,
              approvalStatus: 'pending' as const,
              linkedIssueId: issue.issueId,
              createdAt: nowIso()
            }
          ]
        : [])
    ],
    finalStatus: proposal ? 'waiting_approval' : 'completed',
    finalSummary: proposal ? '修订问题与可应用方案已同步回当前项目。' : '修订问题已同步回当前项目。'
  }
}

const buildPublishSynopsisDraft = (shell: WorkspaceShellDto): string => {
  const premise = shell.project.premise.replace(/\s+/g, ' ').trim()
  const latestExport = shell.recentExports[0]
  const comparison = shell.latestExportComparison

  return [
    `《${shell.project.title}》是一部${shell.project.genre}长篇小说，围绕${toSnippet(premise, 42)}持续推进。`,
    latestExport
      ? `当前准备发布的 ${latestExport.versionTag} 后续版本，会延续既有悬念，同时把主角欲望与代价说得更清楚。`
      : '当前准备发布的是首个正式版本，需要先把主角处境、核心冲突和持续悬念一起交代清楚。',
    comparison?.changedFields.includes('平台简介')
      ? '最近两版的平台简介已经发生变化，建议继续保留“人物处境 + 主线秘密 + 下一步危险”这三层结构。'
      : '简介建议保持“人物处境 + 主线秘密 + 下一步危险”的三层结构，避免只剩题材概括。'
  ].join('')
}

const buildPublishNotesDraft = (shell: WorkspaceShellDto): string => {
  const latestExport = shell.recentExports[0]
  const comparison = shell.latestExportComparison
  const highRiskIssues = shell.revisionIssues.filter((issue) => issue.severity === 'high' && issue.status !== 'resolved')
  const leadingRisk = comparison?.addedFeedback[0] ?? highRiskIssues[0]?.title

  return [
    latestExport
      ? `延续 ${latestExport.versionTag} 的发布基线，聚焦本轮正文推进、简介更新与平台化资产复核。`
      : `首个正式导出版本将围绕《${shell.project.title}》建立发布基线，并同步生成完整平台资产。`,
    comparison?.changedFields.length
      ? `这次重点变化包括：${comparison.changedFields.join('、')}。`
      : '这次导出延续既有发布参数，重点确认版本号、简介和拆章是否仍然成立。',
    leadingRisk
      ? `确认前仍需复看：${leadingRisk}。`
      : '当前没有新增高风险阻塞，可以在确认单里继续核对版本与备注后导出。'
  ].join('')
}

const buildPublishSynopsisActions = (shell: WorkspaceShellDto): AgentFeedItemDto['actions'] => [
  {
    id: createId('action'),
    label: '采用这版简介',
    kind: 'apply-publish-synopsis',
    value: buildPublishSynopsisDraft(shell)
  },
  {
    id: createId('action'),
    label: '再生成一版',
    kind: 'prompt',
    prompt: '请再生成一版更像长篇小说连载文案的平台简介。',
    surface: 'publish'
  }
]

const buildPublishNotesActions = (shell: WorkspaceShellDto): AgentFeedItemDto['actions'] => [
  {
    id: createId('action'),
    label: '采用这版备注',
    kind: 'apply-publish-notes',
    value: buildPublishNotesDraft(shell)
  },
  {
    id: createId('action'),
    label: '再生成一版',
    kind: 'prompt',
    prompt: '请再生成一版更适合 release-notes 的发布备注，突出这一版的确认重点。',
    surface: 'publish'
  }
]

const buildPublishArtifacts = (
  shell: WorkspaceShellDto,
  input: StartTaskInputDto,
  task: AgentTaskDto
): AgentArtifacts => {
  const intent = input.intent.trim()
  const latestExport = shell.recentExports[0]
  const comparison = shell.latestExportComparison
  const draftPresetCount = shell.exportPresets.filter((preset) => preset.status === 'draft').length
  const wantsSynopsis = /(简介|文案|宣传)/u.test(intent)
  const wantsComparison = /(比较|差异|版本|变化)/u.test(intent)
  const wantsReview = /(确认|复核|导出|发布|预检)/u.test(intent) || (!wantsSynopsis && !wantsComparison)
  const feed: AgentFeedItemDto[] = [
    {
      itemId: createId('feed'),
      taskId: task.taskId,
      kind: 'status',
      title: '发布上下文已装配',
      body: `当前项目版本为 ${shell.project.releaseVersion}，发布代理已读取导出预设、最近导出与版本比较结果。`,
      supportingLabel: `${shell.project.title} / 发布工作面`,
      createdAt: nowIso()
    }
  ]

  if (wantsComparison) {
    if (comparison) {
      feed.push({
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: comparison.riskLevel === 'high' ? 'issue' : 'evidence',
        title: '最近两次版本比较已完成',
        body: comparison.summary,
        supportingLabel: `${comparison.previousVersionTag} -> ${comparison.currentVersionTag}`,
        severity: comparison.riskLevel === 'low' ? undefined : comparison.riskLevel,
        createdAt: nowIso()
      })

      feed.push({
        itemId: createId('feed'),
        taskId: task.taskId,
        kind:
          comparison.addedFeedback.length > 0 && comparison.riskLevel !== 'low' ? 'issue' : 'evidence',
        title: comparison.addedFeedback.length > 0 ? '新增平台反馈需要确认' : '最近版本反馈已收口',
        body:
          comparison.addedFeedback.length > 0
            ? comparison.addedFeedback.join('；')
            : comparison.removedFeedback.length > 0
              ? `已消除的反馈：${comparison.removedFeedback.join('；')}`
              : '最近两次导出之间没有新增平台反馈，当前参数可以继续沿用。',
        supportingLabel: comparison.changedFields.join(' / ') || '暂无参数变化',
        severity:
          comparison.addedFeedback.length > 0 && comparison.riskLevel === 'high' ? 'high' : undefined,
        createdAt: nowIso()
      })
    } else {
      feed.push({
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'evidence',
        title: '当前还不足以比较版本',
        body:
          latestExport != null
            ? `当前只有 ${latestExport.versionTag} 一次正式导出，再完成一版后才能生成真实版本比较。`
            : '当前项目还没有正式导出记录，需要先完成第一次导出后才能比较版本差异。',
        supportingLabel: `${shell.recentExports.length} 次最近导出`,
        createdAt: nowIso()
      })
    }
  }

  if (wantsSynopsis) {
    feed.push({
      itemId: createId('feed'),
      taskId: task.taskId,
      kind: 'evidence',
      title: '平台简介草案已生成',
      body: buildPublishSynopsisDraft(shell),
      supportingLabel: '发布参数 / 可直接回填简介',
      actions: buildPublishSynopsisActions(shell),
      createdAt: nowIso()
    })
  }

  if (wantsReview) {
    feed.push({
      itemId: createId('feed'),
      taskId: task.taskId,
      kind:
        draftPresetCount > 0 || comparison?.riskLevel === 'high'
          ? 'issue'
          : latestExport
            ? 'evidence'
            : 'status',
      title: '发布校验结果已生成',
      body:
        draftPresetCount > 0
          ? `当前还有 ${draftPresetCount} 个草稿预设未补齐，公开发布前建议优先确认格式与元数据。`
          : comparison?.riskLevel === 'high'
            ? `最近版本比较仍有高风险项：${comparison.addedFeedback[0] ?? comparison.summary}`
            : latestExport
              ? `最近导出 ${latestExport.versionTag} 已包含 ${latestExport.fileCount} 个产物，可继续进入确认单决定是否发布新版本。`
              : '当前没有历史导出，可以直接以首个正式版本进入确认单。',
      supportingLabel: `${shell.exportPresets.length} 个导出预设 / ${shell.recentExports.length} 次导出`,
      severity:
        comparison?.riskLevel === 'high' ? 'high' : draftPresetCount > 0 ? 'medium' : undefined,
      createdAt: nowIso()
    })

    feed.push({
      itemId: createId('feed'),
      taskId: task.taskId,
      kind: 'evidence',
      title: '发布备注草案已生成',
      body: buildPublishNotesDraft(shell),
      supportingLabel: '发布参数 / 可直接回填备注',
      actions: buildPublishNotesActions(shell),
      createdAt: nowIso()
    })

    feed.push({
      itemId: createId('feed'),
      taskId: task.taskId,
      kind: 'status',
      title: '最终确认建议已生成',
      body:
        comparison?.riskLevel === 'high'
          ? '建议先处理新增平台反馈，再执行最终导出确认，避免把高风险版本直接推进到公开发布。'
          : '当前可以进入发布工作面的确认单，核对版本号、简介、拆章与发布备注后再执行导出。',
      supportingLabel:
        latestExport != null
          ? `基线版本 ${latestExport.versionTag}`
          : `首发版本 ${shell.project.releaseVersion}`,
      actions: [
        {
          id: createId('action'),
          label: '打开确认单',
          kind: 'open-publish-confirm'
        }
      ],
      createdAt: nowIso()
    })
  }

  const finalSummary =
    wantsSynopsis && wantsComparison
      ? '发布文案与版本比较已同步到当前项目。'
      : wantsSynopsis
        ? '发布文案草案已生成。'
        : wantsComparison
          ? '发布版本差异已同步。'
          : '发布预检与确认建议已完成。'

  return {
    feed,
    finalStatus: 'completed',
    finalSummary
  }
}

const buildHomeArtifacts = (shell: WorkspaceShellDto, task: AgentTaskDto): AgentArtifacts => {
  const activeChapter = shell.chapterTree.find((chapter) => chapter.chapterId === shell.project.currentChapterId) ?? shell.chapterTree[0]
  const highRiskIssues = shell.revisionIssues.filter((issue) => issue.severity === 'high').length

  return {
    feed: [
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'status',
        title: '项目现场已恢复',
        body: `当前项目共 ${shell.chapterTree.length} 章、${shell.canonCandidates.length} 张候选设定卡，最近可以继续从 ${activeChapter?.title ?? '当前章节'} 往前。`,
        supportingLabel: `${shell.project.title} / 首页`,
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: highRiskIssues > 0 ? 'issue' : 'evidence',
        title: highRiskIssues > 0 ? '仍有高优先修订问题待处理' : '当前主链可继续推进',
        body:
          highRiskIssues > 0
            ? `当前还有 ${highRiskIssues} 个高风险问题，建议先切到修订工作面确认。`
            : `当前没有高风险阻塞，建议直接继续 ${activeChapter?.title ?? '当前章节'} 的正文推进。`,
        supportingLabel: `${shell.revisionIssues.length} 个修订问题 / ${shell.recentExports.length} 次导出`,
        severity: highRiskIssues > 0 ? 'high' : undefined,
        createdAt: nowIso()
      }
    ],
    finalStatus: 'completed',
    finalSummary: '项目现场恢复完成。'
  }
}

export class LocalAgentRuntime implements AgentRuntimePort {
  private listeners = new Set<(event: TaskEventDto) => void>()

  constructor(private readonly getRepository: () => ProjectRepositoryPort) {}

  subscribe(listener: (event: TaskEventDto) => void): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  async startTask(input: StartTaskInputDto): Promise<StartTaskResultDto> {
    const repository = this.getRepository()
    const shell = await repository.loadWorkspaceShell()
    const header = buildHeader(input.surface, shell)
    const task: AgentTaskDto = {
      taskId: createId('task'),
      title: buildTaskTitle(input.surface, input.intent),
      summary: input.intent,
      status: 'queued',
      surface: input.surface,
      agentType:
        input.surface === 'home'
          ? 'project'
          : input.surface === 'writing'
            ? 'chapter'
            : input.surface === 'analysis'
              ? 'analysis'
            : input.surface === 'canon'
              ? 'canon'
              : input.surface === 'revision'
                ? 'revision'
                : 'publish'
    }

    await repository.upsertAgentTask(task)
    this.emit({
      type: 'task.updated',
      task,
      header
    })

    const runningTask: AgentTaskDto = {
      ...task,
      status: 'running'
    }
    await repository.upsertAgentTask(runningTask)
    this.emit({
      type: 'task.updated',
      task: runningTask,
      header
    })

    const artifacts =
      input.surface === 'writing'
        ? await buildWritingArtifacts(repository, shell, input, task)
        : input.surface === 'analysis'
          ? buildAnalysisArtifacts(shell, input, task)
        : input.surface === 'canon'
          ? await buildCanonArtifacts(repository, shell, input, task)
          : input.surface === 'revision'
            ? await buildRevisionArtifacts(repository, shell, input, task)
            : input.surface === 'publish'
              ? buildPublishArtifacts(shell, input, task)
              : buildHomeArtifacts(shell, task)

    for (const item of artifacts.feed) {
      await repository.appendAgentFeed(item)
      this.emit({
        type: 'feed.item',
        item,
        header
      })
    }

    const finalTask: AgentTaskDto = {
      ...task,
      summary: artifacts.finalSummary,
      status: artifacts.finalStatus
    }
    await repository.upsertAgentTask(finalTask)
    this.emit({
      type: 'task.updated',
      task: finalTask,
      header
    })

    return { task: finalTask }
  }

  private emit(event: TaskEventDto): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

export const createLocalAgentRuntime = (
  getRepository: () => ProjectRepositoryPort
): LocalAgentRuntime => new LocalAgentRuntime(getRepository)
