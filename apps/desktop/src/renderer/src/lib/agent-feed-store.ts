import { useSyncExternalStore } from 'react'
import type { AgentFeedItemDto, AgentHeaderDto, AgentTaskDto, TaskEventDto } from '@lime-novel/application'
import { createId, nowIso } from '@lime-novel/shared-kernel'

type AgentFeedState = {
  header: AgentHeaderDto
  tasks: AgentTaskDto[]
  feed: AgentFeedItemDto[]
}

const fallbackHeader: AgentHeaderDto = {
  currentAgent: '项目总控代理',
  surface: 'home',
  memorySources: [],
  riskLevel: 'low'
}

class AgentFeedStore {
  private state: AgentFeedState = {
    header: fallbackHeader,
    tasks: [],
    feed: []
  }

  private listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): AgentFeedState => this.state

  hydrate(nextState: AgentFeedState): void {
    this.state = nextState
    this.emit()
  }

  applyEvent(event: TaskEventDto): void {
    if (event.type === 'task.updated') {
      const nextTasks = [...this.state.tasks]
      const taskIndex = nextTasks.findIndex((task) => task.taskId === event.task.taskId)

      if (taskIndex >= 0) {
        nextTasks[taskIndex] = event.task
      } else {
        nextTasks.unshift(event.task)
      }

      this.state = {
        ...this.state,
        header: event.header ?? this.state.header,
        tasks: nextTasks
      }
      this.emit()
      return
    }

    const alreadyExists = this.state.feed.some((item) => item.itemId === event.item.itemId)

    if (alreadyExists) {
      return
    }

    this.state = {
      ...this.state,
      header: event.header ?? this.state.header,
      feed: [event.item, ...this.state.feed]
    }
    this.emit()
  }

  addLocalStatus(title: string, body: string, supportingLabel?: string): void {
    this.state = {
      ...this.state,
      feed: [
        {
          itemId: createId('local-feed'),
          taskId: 'local',
          kind: 'status',
          title,
          body,
          supportingLabel,
          createdAt: nowIso()
        },
        ...this.state.feed
      ]
    }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export const agentFeedStore = new AgentFeedStore()

export const useAgentFeedState = (): AgentFeedState =>
  useSyncExternalStore(agentFeedStore.subscribe, agentFeedStore.getSnapshot)

