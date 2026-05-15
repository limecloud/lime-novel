import type {
  DiagnosticFindingDto,
  DiagnosticReportDto,
  HarnessSeverityDto,
  ImpactAnalysisDto,
  IntentPlanDto,
  ReaderFeedbackDto,
  RevisionIssueDto,
  TimelineIterationDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import { createId, nowIso } from '@lime-novel/shared-kernel'
import { buildProjectSurfaceSupportingLabel } from './agent-surface-policy'
import type { LegacyAgentResultBuilderContext } from './legacy-agent-result-builder-context'
import {
  loadLegacyTargetChapter,
  saveLegacyRevisionIssue
} from './legacy-agent-repository'
import { extractBodyParagraphs } from './legacy-agent-text-utils'
import type { SubmittedTaskArtifact, SubmittedTaskResult } from './live-agent-types'

type LegacyHarnessKind = 'diagnostic' | 'impact' | 'intent-plan' | 'reader-feedback' | 'timeline-iteration'

type ChapterRef = {
  ref: string
  label: string
}

const detectLegacyHarnessKind = (intent: string): LegacyHarnessKind | undefined => {
  if (/(时间线|回潮|未来章节|发布后|只读|追加式|retcon|回改)/iu.test(intent)) {
    return 'timeline-iteration'
  }

  if (/(读者反馈|评论|吐槽|弃读|反馈映射|读者信号)/u.test(intent)) {
    return 'reader-feedback'
  }

  if (/(冲击波|影响范围|模拟影响|牵连|改一章|崩全书)/u.test(intent)) {
    return 'impact'
  }

  if (/(A\/B\/C|ABC|候选方案|多方案|意图到方案|比较方案|方案)/iu.test(intent)) {
    return 'intent-plan'
  }

  if (/(体检|诊断|黄金三章|伏笔链|人物弧光|结构扫描|读者风险|全本检查)/u.test(intent)) {
    return 'diagnostic'
  }

  return undefined
}

const resolveChapterRef = (shell: WorkspaceShellDto, chapterId: string): ChapterRef => {
  const chapter = shell.chapterTree.find((item) => item.chapterId === chapterId)

  return {
    ref: chapterId,
    label: chapter ? `第 ${chapter.order} 章 · ${chapter.title}` : chapterId
  }
}

const resolveScopeKind = (intent: string): DiagnosticReportDto['scope']['kind'] => {
  if (/(黄金三章|前三章)/u.test(intent)) {
    return 'golden-three'
  }

  if (/(全书|全本|项目|整本)/u.test(intent)) {
    return 'project'
  }

  return 'chapter'
}

const resolveReportTargetRefs = (
  shell: WorkspaceShellDto,
  chapterId: string,
  scopeKind: DiagnosticReportDto['scope']['kind']
): string[] => {
  if (scopeKind === 'project') {
    return [shell.project.projectId]
  }

  if (scopeKind === 'golden-three') {
    const goldenThreeRefs = shell.chapterTree.slice(0, 3).map((chapter) => chapter.chapterId)
    return goldenThreeRefs.length > 0 ? goldenThreeRefs : [chapterId]
  }

  return [chapterId]
}

const resolveSeverity = (intent: string, fallback: HarnessSeverityDto = 'high'): HarnessSeverityDto => {
  if (/(阻断|不可发布|锁定失败|崩|不可逆)/u.test(intent)) {
    return 'blocking'
  }

  if (/(轻微|低风险|微调)/u.test(intent)) {
    return 'low'
  }

  if (/(中等|可控|局部)/u.test(intent)) {
    return 'medium'
  }

  return fallback
}

const toFeedSeverity = (severity: HarnessSeverityDto): SubmittedTaskArtifact['severity'] =>
  severity === 'blocking' ? 'high' : severity

const pickEvidence = (content: string, fallback: string): string => {
  const paragraphs = extractBodyParagraphs(content)
  const firstParagraph = paragraphs[0]?.replace(/\s+/g, ' ').trim()

  if (!firstParagraph) {
    return fallback
  }

  return firstParagraph.length > 96 ? `${firstParagraph.slice(0, 96)}...` : firstParagraph
}

const buildDiagnosticFindings = (input: {
  shell: WorkspaceShellDto
  chapterRef: ChapterRef
  chapterContent: string
  scopeKind: DiagnosticReportDto['scope']['kind']
  severity: HarnessSeverityDto
  intent: string
}): DiagnosticFindingDto[] => {
  const sceneGoal = input.shell.sceneList[0]?.goal ?? '当前场景还没有明确目标。'
  const evidence = pickEvidence(input.chapterContent, sceneGoal)
  const targetRefs = input.scopeKind === 'project'
    ? [input.shell.project.projectId]
    : input.scopeKind === 'golden-three'
      ? input.shell.chapterTree.slice(0, 3).map((chapter) => chapter.chapterId)
      : [input.chapterRef.ref]

  const findings: DiagnosticFindingDto[] = [
    {
      findingId: createId('finding'),
      area: input.scopeKind === 'golden-three' ? 'golden-three' : 'structure',
      harnessLayer: 'story',
      severity: input.severity,
      targetRefs,
      evidence: [evidence],
      diagnosis:
        input.scopeKind === 'golden-three'
          ? '黄金三章需要同时立住钩子、主角欲望、异常承诺和第三章继续阅读动机，当前应优先检查开篇承诺是否足够具体。'
          : '章节功能必须服务主线承诺、场景目标和信息释放；当前诊断将其作为结构风险进入修订队列。',
      recommendation:
        input.scopeKind === 'golden-three'
          ? '先列出前三章各自的钩子、压迫、释放和尾钩，再决定是否重排或补强。'
          : '先生成冲击波分析，再把改动拆成可审批 proposal，避免直接覆盖正文。'
    },
    {
      findingId: createId('finding'),
      area: 'character',
      harnessLayer: 'character',
      severity: input.severity === 'blocking' ? 'high' : 'medium',
      targetRefs: [input.chapterRef.ref],
      evidence: [sceneGoal],
      diagnosis: '人物状态变化需要能追溯到场景事件；如果只给情绪结论，会削弱人物弧光可信度。',
      recommendation: '为关键人物补一条“目标 -> 行动 -> 代价 -> 新状态”的状态机记录。'
    },
    {
      findingId: createId('finding'),
      area: 'reader-risk',
      harnessLayer: 'reader',
      severity: input.severity === 'blocking' ? 'high' : input.severity,
      targetRefs,
      evidence: [`作者意图：${input.intent}`],
      diagnosis: '读者风险应被当作证据输入，而不是命令；需要标出风险落点和可选修复路径。',
      recommendation: '把风险拆成 issue、intent plan 或 timeline iteration，由作者选择后再执行。'
    }
  ]

  return findings
}

const buildLegacyDiagnosticResult = async (
  context: LegacyAgentResultBuilderContext
): Promise<SubmittedTaskResult> => {
  const { repository, shell, input } = context
  const { chapterId, chapter } = await loadLegacyTargetChapter(context)
  const scopeKind = resolveScopeKind(input.intent)
  const targetRefs = resolveReportTargetRefs(shell, chapterId, scopeKind)
  const severity = resolveSeverity(input.intent)
  const chapterRef = resolveChapterRef(shell, chapterId)
  const findings = buildDiagnosticFindings({
    shell,
    chapterRef,
    chapterContent: chapter.content,
    scopeKind,
    severity,
    intent: input.intent
  })
  const report: DiagnosticReportDto = {
    reportId: createId('report'),
    projectId: shell.project.projectId,
    mode: shell.project.lifecycleMode,
    scope: {
      kind: scopeKind,
      targetRefs
    },
    generatedAt: nowIso(),
    summary: `已按 ${shell.project.lifecycleMode} 模式完成${scopeKind === 'golden-three' ? '黄金三章' : scopeKind === 'project' ? '全书' : chapter.title}小说体检。`,
    goldenThree:
      scopeKind === 'golden-three'
        ? {
            hook: '开篇钩子必须在第一章形成具体压力。',
            empathy: '主角欲望和困境需要早于设定说明出现。',
            momentum: '第三章结尾必须留下可追的下一步问题。'
          }
        : undefined,
    findings,
    metadata: {
      standard: 'agentnovel@0.1.2',
      harness: 'Novel Harness Engine',
      sourceIntent: input.intent
    }
  }

  await repository.upsertDiagnosticReport(report)

  const leadingFinding = findings[0]
  const issue: RevisionIssueDto = {
    issueId: createId('issue'),
    chapterId,
    title: leadingFinding.area === 'golden-three' ? '黄金三章留存风险' : 'Harness 结构体检风险',
    summary: leadingFinding.diagnosis,
    severity: toFeedSeverity(leadingFinding.severity) ?? 'high',
    status: 'open'
  }
  await saveLegacyRevisionIssue(repository, issue)

  return {
    status: severity === 'blocking' ? 'waiting_approval' : 'completed',
    summary: `小说体检报告 ${report.reportId} 已保存，并投影为修订 issue。`,
    artifacts: [
      {
        kind: 'evidence',
        title: '小说体检报告已保存',
        body: `${report.summary}\n报告编号：${report.reportId}\n发现数量：${report.findings.length}`,
        supportingLabel: buildProjectSurfaceSupportingLabel(shell.project.title, input.surface),
        severity: toFeedSeverity(severity)
      },
      {
        kind: 'issue',
        title: issue.title,
        body: `${issue.summary}\n建议：${leadingFinding.recommendation}`,
        supportingLabel: `${chapterRef.label} / ${report.scope.kind}`,
        severity: issue.severity,
        linkedIssueId: issue.issueId
      }
    ]
  }
}

const buildImpactAnalysis = (input: {
  shell: WorkspaceShellDto
  chapterRef: ChapterRef
  authorIntent: string
  sourceChange: string
  riskLevel: HarnessSeverityDto
}): ImpactAnalysisDto => ({
  impactId: createId('impact'),
  projectId: input.shell.project.projectId,
  mode: input.shell.project.lifecycleMode,
  authorIntent: input.authorIntent,
  sourceChange: input.sourceChange,
  riskLevel: input.riskLevel,
  affectedRefs: [
    {
      ref: input.chapterRef.ref,
      kind: 'chapter',
      impact: '会改变当前章节的信息释放、人物状态和尾钩承诺。',
      requiredAction: '执行前先确认章节目标和场景目标是否同步更新。'
    },
    {
      ref: input.shell.project.projectId,
      kind: 'project',
      impact: '会牵动主线承诺、伏笔链和读者对后续章节的预期。',
      requiredAction: '将影响拆成 issue 或 proposal，避免一次性静默改稿。'
    }
  ],
  risks: [
    '如果先改正文再评估，会丢失作者决策依据。',
    input.shell.project.lifecycleMode === 'timeline'
      ? 'timeline 模式下已发布章节只能作为只读历史引用。'
      : 'sandbox 模式可重构，但仍要保留 proposal/apply 审批链。'
  ],
  recommendations: [
    '先保存冲击波分析，再进入 A/B/C 方案比较。',
    '对 confirmed canon、已发布章节或关键伏笔的改动必须单独审批。'
  ],
  createdAt: nowIso(),
  metadata: {
    standard: 'agentnovel@0.1.2',
    source: 'legacy-runtime'
  }
})

const buildLegacyImpactResult = async (
  context: LegacyAgentResultBuilderContext
): Promise<SubmittedTaskResult> => {
  const { repository, shell, input } = context
  const { chapterId } = await loadLegacyTargetChapter(context)
  const chapterRef = resolveChapterRef(shell, chapterId)
  const riskLevel = resolveSeverity(input.intent, 'high')
  const analysis = buildImpactAnalysis({
    shell,
    chapterRef,
    authorIntent: input.intent,
    sourceChange: input.intent,
    riskLevel
  })

  await repository.upsertImpactAnalysis(analysis)

  return {
    status: riskLevel === 'blocking' ? 'waiting_approval' : 'completed',
    summary: `冲击波分析 ${analysis.impactId} 已保存。`,
    artifacts: [
      {
        kind: riskLevel === 'blocking' ? 'issue' : 'evidence',
        title: '结构改动冲击波已保存',
        body: `影响对象：${analysis.affectedRefs.map((ref) => ref.ref).join(' / ')}\n建议：${analysis.recommendations.join('；')}`,
        supportingLabel: `${chapterRef.label} / ${analysis.mode}`,
        severity: toFeedSeverity(riskLevel)
      }
    ]
  }
}

const buildLegacyIntentPlanResult = async (
  context: LegacyAgentResultBuilderContext
): Promise<SubmittedTaskResult> => {
  const { repository, shell, input } = context
  const { chapterId } = await loadLegacyTargetChapter(context)
  const chapterRef = resolveChapterRef(shell, chapterId)
  const impact = buildImpactAnalysis({
    shell,
    chapterRef,
    authorIntent: input.intent,
    sourceChange: '作者要求先比较方案，不直接改正文。',
    riskLevel: 'medium'
  })
  const plan: IntentPlanDto = {
    planId: createId('plan'),
    projectId: shell.project.projectId,
    mode: shell.project.lifecycleMode,
    authorIntent: input.intent,
    options: [
      {
        optionId: createId('option'),
        label: '方案 A',
        summary: '最小改动：保留当前章节顺序，只补强当前场景的异常承诺和人物反应。',
        edits: [chapterRef.label],
        benefits: ['改动边界小，最容易通过 proposal/apply 审批。'],
        costs: ['结构提升有限，可能无法解决全书级节奏问题。'],
        risks: ['如果核心伏笔位置错误，局部补强会变成补丁。'],
        impactRef: impact.impactId
      },
      {
        optionId: createId('option'),
        label: '方案 B',
        summary: '结构重排：先调整信息释放顺序，再重写关键场景目标。',
        edits: [chapterRef.label, '伏笔链 / 信息差'],
        benefits: ['能更系统地修复读者预期和伏笔回收。'],
        costs: ['需要同步检查前后章节连续性。'],
        risks: ['改动范围扩大，必须先完成冲击波分析。'],
        impactRef: impact.impactId
      },
      {
        optionId: createId('option'),
        label: '方案 C',
        summary: '人物弧光优先：不先动事件顺序，先重建关键人物的目标、代价和状态转折。',
        edits: [chapterRef.label, '人物状态机'],
        benefits: ['能提升角色选择可信度，适合人物争议大于结构争议时使用。'],
        costs: ['需要额外补状态机和关系证据。'],
        risks: ['如果主线钩子不足，人物补强不会自动提高留存。'],
        impactRef: impact.impactId
      }
    ],
    createdAt: nowIso(),
    metadata: {
      standard: 'agentnovel@0.1.2',
      source: 'legacy-runtime'
    }
  }

  await repository.upsertImpactAnalysis(impact)
  await repository.upsertIntentPlan(plan)

  return {
    status: 'waiting_approval',
    summary: `A/B/C 意图方案 ${plan.planId} 已保存，等待作者选择。`,
    artifacts: [
      {
        kind: 'proposal',
        title: '作者意图已拆成 A/B/C 方案',
        body: plan.options.map((option) => `${option.label}：${option.summary}`).join('\n'),
        supportingLabel: `${chapterRef.label} / 方案比较`,
        severity: 'medium'
      },
      {
        kind: 'approval',
        title: '方案选择等待作者确认',
        body: '这些方案不会直接改正文。请选择方向后，再生成可应用 proposal。',
        supportingLabel: `${shell.project.title} / Harness 决策边界`
      }
    ]
  }
}

const resolveFeedbackCategory = (intent: string): ReaderFeedbackDto['mappings'][number]['category'] => {
  if (/(人物|角色|主角|女主|男主)/u.test(intent)) {
    return 'character'
  }

  if (/(节奏|拖|水|慢|爽点)/u.test(intent)) {
    return 'pacing'
  }

  if (/(设定|世界观|规则)/u.test(intent)) {
    return 'canon'
  }

  if (/(伏笔|线索|坑)/u.test(intent)) {
    return 'foreshadowing'
  }

  if (/(发布|平台|榜单)/u.test(intent)) {
    return 'publish'
  }

  return 'expectation'
}

const buildLegacyReaderFeedbackResult = async (
  context: LegacyAgentResultBuilderContext
): Promise<SubmittedTaskResult> => {
  const { repository, shell, input } = context
  const { chapterId } = await loadLegacyTargetChapter(context)
  const chapterRef = resolveChapterRef(shell, chapterId)
  const category = resolveFeedbackCategory(input.intent)
  const feedback: ReaderFeedbackDto = {
    feedbackId: createId('feedback'),
    projectId: shell.project.projectId,
    source: 'manual-agent-intent',
    collectedAt: nowIso(),
    items: [
      {
        itemId: createId('feedback-item'),
        summary: input.intent,
        sentiment: /(喜欢|好看|上头|期待)/u.test(input.intent) ? 'positive' : 'mixed',
        sourceRef: 'agent-task-intent'
      }
    ],
    mappings: [
      {
        category,
        targetRefs: [chapterRef.ref],
        confidence: 0.74,
        interpretation: '该反馈被映射为结构证据，需要结合章节、人物状态和读者预期判断，不应直接服从。',
        recommendedAction:
          shell.project.lifecycleMode === 'timeline'
            ? '如涉及已发布事实，转入 timeline iteration，用未来章节补强。'
            : '先生成 issue 或 intent plan，再由作者决定是否进入 proposal。'
      }
    ],
    metadata: {
      standard: 'agentnovel@0.1.2',
      source: 'legacy-runtime'
    }
  }

  await repository.upsertReaderFeedback(feedback)

  return {
    status: 'completed',
    summary: `读者反馈映射 ${feedback.feedbackId} 已保存。`,
    artifacts: [
      {
        kind: category === 'expectation' || category === 'pacing' ? 'issue' : 'evidence',
        title: '读者反馈已映射为结构证据',
        body: `${feedback.mappings[0].interpretation}\n建议：${feedback.mappings[0].recommendedAction}`,
        supportingLabel: `${chapterRef.label} / ${category}`,
        severity: category === 'pacing' || category === 'expectation' ? 'high' : 'medium'
      }
    ]
  }
}

const resolveTimelineStrategy = (intent: string): TimelineIterationDto['strategy'] => {
  if (/(未来桥|未来章节|补强)/u.test(intent)) {
    return 'future-bridge'
  }

  if (/(伏笔|线索|坑)/u.test(intent)) {
    return 'foreshadowing-recovery'
  }

  if (/(人物|角色|动机|洗白|黑化)/u.test(intent)) {
    return 'character-reframing'
  }

  if (/(预期|误读|争议|期待)/u.test(intent)) {
    return 'reader-expectation-reset'
  }

  return 'retroactive-echo'
}

const resolveTimelineTarget = (shell: WorkspaceShellDto, currentChapterId: string): ChapterRef => {
  const current = shell.chapterTree.find((chapter) => chapter.chapterId === currentChapterId)

  if (current?.status !== 'published') {
    return resolveChapterRef(shell, currentChapterId)
  }

  const futureChapter = shell.chapterTree.find((chapter) => chapter.status !== 'published')
  return resolveChapterRef(shell, futureChapter?.chapterId ?? currentChapterId)
}

const buildLegacyTimelineIterationResult = async (
  context: LegacyAgentResultBuilderContext
): Promise<SubmittedTaskResult> => {
  const { repository, shell, input } = context
  const { chapterId } = await loadLegacyTargetChapter(context)
  const targetRef = resolveTimelineTarget(shell, chapterId)
  const readOnlyPublishedRefs = shell.chapterTree
    .filter((chapter) => chapter.status === 'published')
    .map((chapter) => chapter.chapterId)
  const iteration: TimelineIterationDto = {
    iterationId: createId('timeline'),
    projectId: shell.project.projectId,
    trigger: input.intent,
    strategy: resolveTimelineStrategy(input.intent),
    targetFutureRefs: [targetRef.ref],
    readOnlyPublishedRefs,
    readerExperienceRisk: '如果直接回改已发布章节，会破坏读者时间线；应把回应落在未来章节或发布备注中。',
    retconRisk: readOnlyPublishedRefs.length > 0 ? 'medium' : 'low',
    createdAt: nowIso(),
    metadata: {
      standard: 'agentnovel@0.1.2',
      mode: shell.project.lifecycleMode,
      source: 'legacy-runtime'
    }
  }

  await repository.upsertTimelineIteration(iteration)

  return {
    status: 'waiting_approval',
    summary: `时间线迭代计划 ${iteration.iterationId} 已保存。`,
    artifacts: [
      {
        kind: 'proposal',
        title: '未来章节追加式修复计划已生成',
        body: `策略：${iteration.strategy}\n承载章节：${iteration.targetFutureRefs.join(' / ')}\n只读章节：${iteration.readOnlyPublishedRefs.join(' / ') || '当前没有已发布章节'}`,
        supportingLabel: `${targetRef.label} / timeline iteration`,
        severity: iteration.retconRisk === 'high' ? 'high' : 'medium'
      },
      {
        kind: 'approval',
        title: '时间线修复等待确认',
        body: iteration.readerExperienceRisk,
        supportingLabel: `${shell.project.title} / 已发布历史不可静默改写`
      }
    ]
  }
}

export const buildLegacyHarnessSubmittedResultIfMatched = async (
  context: LegacyAgentResultBuilderContext
): Promise<SubmittedTaskResult | undefined> => {
  const kind = detectLegacyHarnessKind(context.input.intent)

  if (kind === 'diagnostic') {
    return buildLegacyDiagnosticResult(context)
  }

  if (kind === 'impact') {
    return buildLegacyImpactResult(context)
  }

  if (kind === 'intent-plan') {
    return buildLegacyIntentPlanResult(context)
  }

  if (kind === 'reader-feedback') {
    return buildLegacyReaderFeedbackResult(context)
  }

  if (kind === 'timeline-iteration') {
    return buildLegacyTimelineIterationResult(context)
  }

  return undefined
}
