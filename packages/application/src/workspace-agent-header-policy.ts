import {
  resolveWorkspaceRuntimeSurface
} from '@lime-novel/domain-novel'
import type { FeatureToolId, NovelSurfaceId } from '@lime-novel/domain-novel'
import type { AgentHeaderDto } from './dto'

export const buildWorkspaceAgentHeader = (
  surface: NovelSurfaceId,
  featureTool?: FeatureToolId
): AgentHeaderDto => {
  const runtimeSurface = resolveWorkspaceRuntimeSurface({ surface, featureTool })

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

  if (surface === 'knowledge') {
    return {
      currentAgent: '知识代理',
      activeSubAgent: '知识编译子代理',
      surface,
      memorySources: ['raw 素材', 'compiled 知识页', 'canon 设定', 'outputs 查询产物'],
      riskLevel: 'medium'
    }
  }

  if (runtimeSurface === 'analysis') {
    return {
      currentAgent: '拆书代理',
      activeSubAgent: '样本建模子代理',
      surface: runtimeSurface,
      memorySources: ['样本文本', '题材词', '结构信号', '项目 premise'],
      riskLevel: 'medium'
    }
  }

  if (surface === 'feature-center') {
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
