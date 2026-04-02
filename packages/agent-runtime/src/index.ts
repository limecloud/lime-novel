import { createId, nowIso } from '@lime-novel/shared-kernel'
import type {
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentTaskDto,
  AgentRuntimePort,
  StartTaskInputDto,
  StartTaskResultDto,
  TaskEventDto
} from '@lime-novel/application'

const buildHeader = (surface: StartTaskInputDto['surface']): AgentHeaderDto => {
  const mapping = {
    home: '项目总控代理',
    writing: '章节代理',
    canon: '设定代理',
    revision: '修订代理',
    publish: '发布代理'
  } as const

  return {
    currentAgent: mapping[surface],
    activeSubAgent: surface === 'writing' ? '设定扫描子代理' : undefined,
    surface,
    memorySources:
      surface === 'writing'
        ? ['本章目标', '相邻章节摘要', '人物状态', '伏笔清单']
        : ['项目摘要', '最近任务', '跨章线索'],
    riskLevel: surface === 'revision' ? 'high' : 'medium'
  }
}

const buildFeedItems = (task: AgentTaskDto, intent: string): AgentFeedItemDto[] => {
  const commonBody = `已读取 "${intent}" 的上下文，并按 ${task.title} 的主链开始组织证据与提议。`

  if (task.surface === 'writing') {
    return [
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'status',
        title: '章节上下文已装配',
        body: commonBody,
        supportingLabel: '章节记忆 + 设定命中',
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'evidence',
        title: '命中角色卡与当前悬念',
        body: '当前段落已经把“钟楼钥匙”与林清远的动机放进同一场景，适合补强心理推进而不是直接加新事件。',
        supportingLabel: '第 12 章 / 人物卡 / 伏笔清单',
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'proposal',
        title: '更克制的一版续写提议',
        body: '先用一段内心犹疑承接，再让动作落到门锁和旧铜味上，避免直接揭示答案。',
        supportingLabel: '可应用到当前章节',
        proposalId: 'proposal-rewrite-opening',
        diffPreview: {
          before: '她把钥匙按进锁孔，门还是没有开。',
          after: '她把钥匙按进锁孔，金属先发出一声潮湿的轻响，像某段迟迟不肯说破的旧事在门后换气。'
        },
        actions: [
          {
            id: createId('action'),
            label: '应用提议',
            kind: 'apply-proposal',
            proposalId: 'proposal-rewrite-opening'
          }
        ],
        createdAt: nowIso()
      }
    ]
  }

  if (task.surface === 'revision') {
    return [
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'status',
        title: '修订扫描启动',
        body: commonBody,
        supportingLabel: '跨章一致性检查',
        createdAt: nowIso()
      },
      {
        itemId: createId('feed'),
        taskId: task.taskId,
        kind: 'issue',
        title: '视角焦点短暂漂移',
        body: '段落中出现了只有反派已知的信息，建议改回女主可感知范围。',
        supportingLabel: '第 12 章 / 第 13 章',
        severity: 'high',
        createdAt: nowIso()
      }
    ]
  }

  return [
    {
      itemId: createId('feed'),
      taskId: task.taskId,
      kind: 'status',
      title: '后台任务已接管',
      body: commonBody,
      supportingLabel: '结果会同步回右栏',
      createdAt: nowIso()
    }
  ]
}

export class MockAgentRuntime implements AgentRuntimePort {
  private listeners = new Set<(event: TaskEventDto) => void>()

  subscribe(listener: (event: TaskEventDto) => void): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  async startTask(input: StartTaskInputDto): Promise<StartTaskResultDto> {
    const task: AgentTaskDto = {
      taskId: createId('task'),
      title:
        input.surface === 'writing'
          ? '章节推进'
          : input.surface === 'revision'
            ? '修订检查'
            : input.surface === 'canon'
              ? '设定提取'
              : input.surface === 'publish'
                ? '发布预检'
                : '项目恢复',
      summary: input.intent,
      status: 'queued',
      surface: input.surface,
      agentType:
        input.surface === 'home'
          ? 'project'
          : input.surface === 'writing'
            ? 'chapter'
            : input.surface === 'canon'
              ? 'canon'
              : input.surface === 'revision'
                ? 'revision'
                : 'publish'
    }

    const queuedHeader = buildHeader(input.surface)
    const feedItems = buildFeedItems(task, input.intent)

    this.emit({
      type: 'task.updated',
      task,
      header: queuedHeader
    })

    setTimeout(() => {
      this.emit({
        type: 'task.updated',
        task: {
          ...task,
          status: 'running'
        },
        header: queuedHeader
      })
    }, 180)

    feedItems.forEach((item, index) => {
      setTimeout(() => {
        this.emit({
          type: 'feed.item',
          item,
          header: queuedHeader
        })
      }, 360 + index * 220)
    })

    setTimeout(() => {
      this.emit({
        type: 'task.updated',
        task: {
          ...task,
          status: feedItems.some((item) => item.kind === 'proposal') ? 'waiting_approval' : 'completed'
        },
        header: queuedHeader
      })
    }, 960)

    return { task }
  }

  private emit(event: TaskEventDto): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

export const createMockAgentRuntime = (): MockAgentRuntime => new MockAgentRuntime()

