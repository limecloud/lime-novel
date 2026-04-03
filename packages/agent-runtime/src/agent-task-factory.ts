import { createId } from '@lime-novel/shared-kernel'
import type {
  AgentHeaderDto,
  AgentTaskDto,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'

const normalizeRuntimeSurface = (surface: NovelSurfaceId): Exclude<NovelSurfaceId, 'feature-center'> =>
  surface === 'feature-center' ? 'analysis' : surface

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
  if (surface === 'feature-center') {
    return {
      currentAgent: '功能中心',
      activeSubAgent: '拆书代理',
      surface,
      memorySources: [
        `${shell.analysisOverview.sampleCount} 个已导入样本`,
        shell.analysisOverview.dominantTags[0] ?? shell.project.genre,
        shell.analysisOverview.projectAngles[0] ?? shell.project.premise,
        'TXT / Markdown 样本导入'
      ],
      riskLevel: shell.analysisOverview.cautionSignals.length > 1 ? 'medium' : 'low'
    }
  }

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

  if (surface === 'knowledge') {
    return {
      currentAgent: '知识代理',
      activeSubAgent: '查询整理子代理',
      surface,
      memorySources: [
        `${shell.knowledgeSummary.totalDocuments} 份知识资产`,
        `${shell.knowledgeSummary.compiledDocuments} 页 compiled`,
        `${shell.knowledgeSummary.outputDocuments} 份 outputs`,
        shell.knowledgeDocuments[0]?.title ?? shell.project.premise
      ],
      riskLevel: shell.knowledgeSummary.conflictedDocuments > 0 ? 'high' : 'medium'
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

const buildAnalysisTaskTitle = (intent: string): string => {
  if (/(立项|策略|启发|对标)/u.test(intent)) {
    return '立项启发'
  }

  if (/(比较|对比|样本)/u.test(intent)) {
    return '样本对比'
  }

  return '拆书分析'
}

const buildTaskTitle = (surface: NovelSurfaceId, intent: string): string => {
  if (surface === 'feature-center' || surface === 'analysis') {
    return buildAnalysisTaskTitle(intent)
  }

  if (surface === 'writing') {
    return intent.includes('改') ? '章节改写' : '章节推进'
  }

  if (surface === 'knowledge') {
    if (/(报告|简报|问答|整理)/u.test(intent)) {
      return '知识问答'
    }

    return '知识整理'
  }

  if (surface === 'canon') {
    return '设定提取'
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

const resolveAgentType = (
  surface: Exclude<NovelSurfaceId, 'feature-center'>
): AgentTaskDto['agentType'] => {
  if (surface === 'home') {
    return 'project'
  }

  if (surface === 'writing') {
    return 'chapter'
  }

  if (surface === 'knowledge') {
    return 'knowledge'
  }

  if (surface === 'analysis') {
    return 'analysis'
  }

  if (surface === 'canon') {
    return 'canon'
  }

  if (surface === 'revision') {
    return 'revision'
  }

  return 'publish'
}

export const createAgentTaskSessionSeed = (
  input: StartTaskInputDto,
  shell: WorkspaceShellDto
): {
  header: AgentHeaderDto
  task: AgentTaskDto
} => {
  const effectiveSurface = normalizeRuntimeSurface(input.surface)

  return {
    header: buildHeader(input.surface, shell),
    task: {
      taskId: createId('task'),
      title: buildTaskTitle(input.surface, input.intent),
      summary: input.intent,
      status: 'queued',
      surface: input.surface,
      agentType: resolveAgentType(effectiveSurface)
    }
  }
}
