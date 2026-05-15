import type {
  DiagnosticReportDto,
  HarnessSeverityDto,
  HarnessTargetRefDto,
  ImpactAnalysisDto,
  IntentPlanDto,
  ReaderFeedbackDto,
  TimelineIterationDto
} from '@lime-novel/application'
import { createId, nowIso } from '@lime-novel/shared-kernel'
import {
  expectObject,
  objectSchema,
  readOptionalSeverity,
  readOptionalString,
  readRequiredString,
  stringSchema
} from './live-agent-tool-schema'
import type { AgentTool, AgentToolContext } from './live-agent-types'

const resolveCurrentChapterRef = (context: AgentToolContext): HarnessTargetRefDto => {
  const chapterId = context.input.chapterId ?? context.shell.project.currentChapterId
  const chapter = context.shell.chapterTree.find((item) => item.chapterId === chapterId)

  return {
    refId: chapterId,
    kind: 'chapter',
    label: chapter ? `第 ${chapter.order} 章 · ${chapter.title}` : chapterId
  }
}

const resolveProjectMode = (context: AgentToolContext): DiagnosticReportDto['mode'] =>
  context.shell.project.lifecycleMode ?? context.shell.harnessProfile.mode

const readRiskLevel = (
  value: Record<string, unknown>,
  key: string,
  fallback: HarnessSeverityDto
): HarnessSeverityDto => {
  const field = value[key]

  if (field === 'blocking') {
    return 'blocking'
  }

  return readOptionalSeverity(value, key) ?? fallback
}

const createTargetRefs = (context: AgentToolContext): HarnessTargetRefDto[] => [
  {
    refId: context.shell.project.projectId,
    kind: 'project',
    label: context.shell.project.title
  },
  resolveCurrentChapterRef(context)
]

export const createLiveHarnessTools = (context: AgentToolContext): AgentTool<unknown, unknown>[] => [
  {
    name: 'generate_diagnostic_report',
    description:
      '生成并保存小说体检报告，适合全书/单章/黄金三章/伏笔/人物弧光/发布前阻断项诊断。',
    inputSchema: objectSchema({
      scope: stringSchema('诊断范围：chapter、project 或 golden-three。', ['chapter', 'project', 'golden-three']),
      summary: stringSchema('报告摘要。'),
      area: stringSchema('问题领域，如 structure、pacing、character、foreshadowing、golden-three。'),
      severity: stringSchema('low、medium、high 或 blocking。', ['low', 'medium', 'high', 'blocking']),
      diagnosis: stringSchema('诊断结论。'),
      recommendation: stringSchema('建议动作。'),
      evidence: stringSchema('证据摘要。')
    }, ['summary', 'diagnosis', 'recommendation']),
    parse: (input) => {
      const value = expectObject(input, 'generate_diagnostic_report')
      return {
        scope: readOptionalString(value, 'scope') ?? 'chapter',
        summary: readRequiredString(value, 'summary'),
        area: readOptionalString(value, 'area') ?? 'structure',
        severity: readRiskLevel(value, 'severity', 'medium'),
        diagnosis: readRequiredString(value, 'diagnosis'),
        recommendation: readRequiredString(value, 'recommendation'),
        evidence: readOptionalString(value, 'evidence') ?? context.input.intent
      }
    },
    execute: async (input) => {
      const value = input as {
        scope: DiagnosticReportDto['scope']['kind']
        summary: string
        area: DiagnosticReportDto['findings'][number]['area']
        severity: HarnessSeverityDto
        diagnosis: string
        recommendation: string
        evidence: string
      }
      const report: DiagnosticReportDto = {
        reportId: createId('report'),
        projectId: context.shell.project.projectId,
        mode: resolveProjectMode(context),
        scope: {
          kind: value.scope,
          targetRefs: createTargetRefs(context).map((ref) => ref.refId)
        },
        summary: value.summary,
        generatedAt: nowIso(),
        findings: [
          {
            findingId: createId('finding'),
            area: value.area,
            harnessLayer: value.area === 'character' ? 'character' : value.area === 'reader-risk' || value.area === 'golden-three' ? 'reader' : 'story',
            severity: value.severity,
            targetRefs: createTargetRefs(context).map((ref) => ref.refId),
            evidence: [value.evidence],
            diagnosis: value.diagnosis,
            recommendation: value.recommendation
          }
        ]
      }

      await context.repository.upsertDiagnosticReport(report)
      return {
        reportId: report.reportId,
        findingIds: report.findings.map((finding) => finding.findingId),
        severity: value.severity
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: () => '生成小说体检报告'
  },
  {
    name: 'simulate_impact',
    description: '保存一次结构改动冲击波分析，用于预测章节、人物、伏笔、读者体验和发布边界影响。',
    inputSchema: objectSchema({
      authorIntent: stringSchema('作者修改意图。'),
      sourceChange: stringSchema('拟议改动。'),
      riskLevel: stringSchema('low、medium、high 或 blocking。', ['low', 'medium', 'high', 'blocking']),
      impact: stringSchema('影响范围摘要。'),
      recommendation: stringSchema('建议执行方式。')
    }, ['authorIntent', 'sourceChange', 'impact', 'recommendation']),
    parse: (input) => {
      const value = expectObject(input, 'simulate_impact')
      return {
        authorIntent: readRequiredString(value, 'authorIntent'),
        sourceChange: readRequiredString(value, 'sourceChange'),
        riskLevel: readRiskLevel(value, 'riskLevel', 'high'),
        impact: readRequiredString(value, 'impact'),
        recommendation: readRequiredString(value, 'recommendation')
      }
    },
    execute: async (input) => {
      const value = input as {
        authorIntent: string
        sourceChange: string
        riskLevel: HarnessSeverityDto
        impact: string
        recommendation: string
      }
      const targetRef = resolveCurrentChapterRef(context)
      const analysis: ImpactAnalysisDto = {
        impactId: createId('impact'),
        projectId: context.shell.project.projectId,
        mode: resolveProjectMode(context),
        authorIntent: value.authorIntent,
        sourceChange: value.sourceChange,
        riskLevel: value.riskLevel,
        affectedRefs: [
          {
            ref: targetRef.refId,
            kind: targetRef.kind,
            impact: value.impact,
            requiredAction: value.recommendation
          }
        ],
        risks: [value.impact],
        recommendations: [value.recommendation],
        createdAt: nowIso()
      }

      await context.repository.upsertImpactAnalysis(analysis)
      return {
        impactId: analysis.impactId,
        riskLevel: analysis.riskLevel,
        affectedCount: analysis.affectedRefs.length
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: () => '保存冲击波分析'
  },
  {
    name: 'create_intent_plan',
    description: '把作者意图保存为 A/B/C 候选方案，供作者选择后再进入 proposal/apply。',
    inputSchema: objectSchema({
      authorIntent: stringSchema('作者原始意图。'),
      optionA: stringSchema('方案 A 摘要。'),
      optionB: stringSchema('方案 B 摘要。'),
      optionC: stringSchema('方案 C 摘要，可选。'),
      risk: stringSchema('共同风险。')
    }, ['authorIntent', 'optionA', 'optionB']),
    parse: (input) => {
      const value = expectObject(input, 'create_intent_plan')
      return {
        authorIntent: readRequiredString(value, 'authorIntent'),
        optionA: readRequiredString(value, 'optionA'),
        optionB: readRequiredString(value, 'optionB'),
        optionC: readOptionalString(value, 'optionC'),
        risk: readOptionalString(value, 'risk') ?? '需要作者确认后才能进入正文修改。'
      }
    },
    execute: async (input) => {
      const value = input as {
        authorIntent: string
        optionA: string
        optionB: string
        optionC?: string
        risk: string
      }
      const options = [value.optionA, value.optionB, value.optionC].filter((item): item is string => Boolean(item))
      const plan: IntentPlanDto = {
        planId: createId('plan'),
        projectId: context.shell.project.projectId,
        mode: resolveProjectMode(context),
        authorIntent: value.authorIntent,
        createdAt: nowIso(),
        options: options.map((summary, index) => ({
          optionId: createId('option'),
          label: `方案 ${String.fromCharCode(65 + index)}`,
          summary,
          edits: [resolveCurrentChapterRef(context).label],
          benefits: ['贴近作者原始意图，并保持可控改动边界。'],
          costs: ['需要作者确认后再生成正文 proposal。'],
          risks: [value.risk]
        }))
      }

      await context.repository.upsertIntentPlan(plan)
      return {
        planId: plan.planId,
        optionCount: plan.options.length
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: () => '保存 A/B/C 候选方案'
  },
  {
    name: 'map_reader_feedback',
    description: '将读者反馈聚合并映射到章节、人物、节奏、设定、伏笔或发布风险。',
    inputSchema: objectSchema({
      source: stringSchema('反馈来源。'),
      summary: stringSchema('反馈聚合摘要。'),
      category: stringSchema('chapter、character、pacing、canon、foreshadowing、expectation 或 publish。'),
      recommendedAction: stringSchema('建议动作。')
    }, ['source', 'summary', 'recommendedAction']),
    parse: (input) => {
      const value = expectObject(input, 'map_reader_feedback')
      return {
        source: readRequiredString(value, 'source'),
        summary: readRequiredString(value, 'summary'),
        category: readOptionalString(value, 'category') ?? 'expectation',
        recommendedAction: readRequiredString(value, 'recommendedAction')
      }
    },
    execute: async (input) => {
      const value = input as {
        source: string
        summary: string
        category: ReaderFeedbackDto['mappings'][number]['category']
        recommendedAction: string
      }
      const feedback: ReaderFeedbackDto = {
        feedbackId: createId('feedback'),
        projectId: context.shell.project.projectId,
        source: value.source,
        items: [
          {
            itemId: createId('feedback-item'),
            summary: value.summary,
            sentiment: 'mixed',
            sourceRef: value.source
          }
        ],
        collectedAt: nowIso(),
        mappings: [
          {
            category: value.category,
            targetRefs: createTargetRefs(context).map((ref) => ref.refId),
            confidence: 0.72,
            interpretation: value.summary,
            recommendedAction: value.recommendedAction
          }
        ]
      }

      await context.repository.upsertReaderFeedback(feedback)
      return {
        feedbackId: feedback.feedbackId,
        mappingCount: feedback.mappings.length
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: () => '映射读者反馈'
  },
  {
    name: 'plan_timeline_iteration',
    description: '在 timeline 模式或发布后修复场景下，保存未来章节追加式修复计划。',
    inputSchema: objectSchema({
      trigger: stringSchema('触发原因或反馈。'),
      strategy: stringSchema('retroactive-echo、future-bridge、foreshadowing-recovery、character-reframing 或 reader-expectation-reset。'),
      readerExperienceRisk: stringSchema('读者体验风险。'),
      retconRisk: stringSchema('none、low、medium 或 high。', ['none', 'low', 'medium', 'high'])
    }, ['trigger', 'strategy', 'readerExperienceRisk']),
    parse: (input) => {
      const value = expectObject(input, 'plan_timeline_iteration')
      return {
        trigger: readRequiredString(value, 'trigger'),
        strategy: readRequiredString(value, 'strategy') as TimelineIterationDto['strategy'],
        readerExperienceRisk: readRequiredString(value, 'readerExperienceRisk'),
        retconRisk: (readOptionalString(value, 'retconRisk') ?? 'medium') as TimelineIterationDto['retconRisk']
      }
    },
    execute: async (input) => {
      const value = input as {
        trigger: string
        strategy: TimelineIterationDto['strategy']
        readerExperienceRisk: string
        retconRisk: TimelineIterationDto['retconRisk']
      }
      const chapterRef = resolveCurrentChapterRef(context)
      const iteration: TimelineIterationDto = {
        iterationId: createId('timeline'),
        projectId: context.shell.project.projectId,
        trigger: value.trigger,
        strategy: value.strategy,
        targetFutureRefs: [chapterRef.refId],
        readOnlyPublishedRefs: context.shell.chapterTree
          .filter((chapter) => chapter.status === 'published')
          .map((chapter) => chapter.chapterId),
        readerExperienceRisk: value.readerExperienceRisk,
        retconRisk: value.retconRisk,
        createdAt: nowIso()
      }

      await context.repository.upsertTimelineIteration(iteration)
      return {
        iterationId: iteration.iterationId,
        strategy: iteration.strategy,
        readOnlyPublishedCount: iteration.readOnlyPublishedRefs.length
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: () => '保存时间线迭代计划'
  }
]
