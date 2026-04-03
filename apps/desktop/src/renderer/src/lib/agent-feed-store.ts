import { useSyncExternalStore } from 'react'
import type {
  AgentFeedItemDto,
  AgentHeaderDto,
  AgentTaskDiagnosticsDto,
  AgentTaskDto,
  TaskEventDto
} from '@lime-novel/application'
import { createId, nowIso } from '@lime-novel/shared-kernel'

type AgentFeedState = {
  header: AgentHeaderDto
  tasks: AgentTaskDto[]
  feed: AgentFeedItemDto[]
  diagnosticsByTaskId: Record<string, AgentTaskDiagnosticsDto>
}

type AgentFeedSnapshotInput = Omit<AgentFeedState, 'diagnosticsByTaskId'>

const fallbackHeader: AgentHeaderDto = {
  currentAgent: '项目总控代理',
  surface: 'home',
  memorySources: [],
  riskLevel: 'low'
}

const parseUpdatedAt = (value: string): number => {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

class AgentFeedStore {
  private state: AgentFeedState = {
    header: fallbackHeader,
    tasks: [],
    feed: [],
    diagnosticsByTaskId: {}
  }

  private listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): AgentFeedState => this.state

  hydrate(nextState: AgentFeedSnapshotInput): void {
    this.state = {
      ...nextState,
      diagnosticsByTaskId: {}
    }
    this.emit()
  }

  syncFromShell(nextState: AgentFeedSnapshotInput): void {
    const localFeed = this.state.feed.filter((item) => item.taskId === 'local')
    const mergedFeed = [...nextState.feed]
    const nextDiagnosticsByTaskId = { ...this.state.diagnosticsByTaskId }

    for (const item of localFeed) {
      if (!mergedFeed.some((existing) => existing.itemId === item.itemId)) {
        mergedFeed.unshift(item)
      }
    }

    const persistedTaskIds = new Set(nextState.tasks.map((task) => task.taskId))

    for (const taskId of Object.keys(nextDiagnosticsByTaskId)) {
      if (!persistedTaskIds.has(taskId)) {
        delete nextDiagnosticsByTaskId[taskId]
      }
    }

    this.state = {
      header: nextState.header,
      tasks: nextState.tasks,
      feed: mergedFeed,
      diagnosticsByTaskId: nextDiagnosticsByTaskId
    }
    this.emit()
  }

  mergeDiagnostics(diagnostics: AgentTaskDiagnosticsDto[]): void {
    if (diagnostics.length === 0) {
      return
    }

    const nextDiagnosticsByTaskId = { ...this.state.diagnosticsByTaskId }

    for (const diagnosticsItem of diagnostics) {
      const current = nextDiagnosticsByTaskId[diagnosticsItem.taskId]

      if (current && parseUpdatedAt(current.updatedAt) > parseUpdatedAt(diagnosticsItem.updatedAt)) {
        continue
      }

      nextDiagnosticsByTaskId[diagnosticsItem.taskId] = diagnosticsItem
    }

    this.state = {
      ...this.state,
      diagnosticsByTaskId: nextDiagnosticsByTaskId
    }
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

    if (event.type === 'task.diagnostics') {
      this.state = {
        ...this.state,
        header: event.header ?? this.state.header,
        diagnosticsByTaskId: {
          ...this.state.diagnosticsByTaskId,
          [event.diagnostics.taskId]: event.diagnostics
        }
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
