import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createInterface, type Interface as ReadlineInterface } from 'node:readline'
import type {
  AgentFeedItemDto,
  AgentTaskDiagnosticsDto,
  AgentTaskDto,
  AgentTraceEntryDto,
  AgentRuntimePort,
  ProjectRepositoryPort,
  StartTaskInputDto,
  StartTaskResultDto,
  TaskEventDto
} from '@lime-novel/application'
import { createId, nowIso } from '@lime-novel/shared-kernel'

type JsonRpcRequest = {
  id: number
  method: string
  params?: unknown
}

type JsonRpcNotification = {
  method: string
  params?: unknown
}

type JsonRpcResponse = {
  id: number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

type AppServerAgentEvent = {
  eventId: string
  sequence: number
  sessionId: string
  threadId?: string
  turnId?: string
  type: string
  timestamp: string
  payload?: unknown
}

type AppServerConnection = {
  child: ChildProcessWithoutNullStreams
  lines: ReadlineInterface
  pending: Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    method: string
  }>
  nextId: number
}

type AppServerRuntimeConfig = {
  binaryPath: string
  backendCommand: string
  backendArgs: string[]
  backendTimeoutMs?: number
  usesBuiltInBackend: boolean
}

type RunningTask = {
  task: AgentTaskDto
  input: StartTaskInputDto
  trace: AgentTraceEntryDto[]
  terminal: boolean
}

const METHOD_AGENT_SESSION_EVENT = 'agentSession/event'
const APP_SERVER_PROTOCOL_VERSION = 'appserver.v0'
const MAX_TRACE_ENTRIES = 80
const BUILT_IN_BACKEND_PATH_CANDIDATES = [
  fileURLToPath(new URL('./lime-novel-agent-backend.mjs', import.meta.url)),
  fileURLToPath(new URL('../app-server/lime-novel-agent-backend.mjs', import.meta.url))
]

const agentTypeBySurface: Record<StartTaskInputDto['surface'], AgentTaskDto['agentType']> = {
  home: 'project',
  writing: 'chapter',
  knowledge: 'knowledge',
  'feature-center': 'project',
  analysis: 'analysis',
  canon: 'canon',
  revision: 'revision',
  publish: 'publish'
}

const titleBySurface: Record<StartTaskInputDto['surface'], string> = {
  home: '项目代理',
  writing: '写作代理',
  knowledge: '知识代理',
  'feature-center': '项目代理',
  analysis: '拆书代理',
  canon: '设定代理',
  revision: '修订代理',
  publish: '发布代理'
}

const parseBackendArgs = (env: NodeJS.ProcessEnv): string[] => {
  const jsonInput = env.LIME_APP_SERVER_BACKEND_ARGS_JSON?.trim()

  if (jsonInput) {
    const parsed = JSON.parse(jsonInput)

    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error('LIME_APP_SERVER_BACKEND_ARGS_JSON 必须是字符串数组。')
    }

    return parsed
  }

  return []
}

const hasLiveModelConfig = (env: NodeJS.ProcessEnv): boolean => {
  const provider = env.LIME_NOVEL_AGENT_PROVIDER?.trim()
  const hasExplicitLiveProvider = provider === 'anthropic' || provider === 'openai-compatible'
  const hasLiveSignal = Boolean(env.LIME_NOVEL_AGENT_API_KEY?.trim() || env.LIME_NOVEL_AGENT_MODEL?.trim())

  return hasExplicitLiveProvider || (!provider && hasLiveSignal)
}

export const resolveAppServerRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): AppServerRuntimeConfig => {
  const binaryPath = env.LIME_APP_SERVER_BIN?.trim() || env.APP_SERVER_BIN?.trim()
  const configuredBackendCommand = env.LIME_APP_SERVER_BACKEND_COMMAND?.trim()
  const backendTimeoutMs = Number.parseInt(env.LIME_APP_SERVER_BACKEND_TIMEOUT_MS ?? '', 10)

  if (!binaryPath) {
    throw new Error('缺少 LIME_APP_SERVER_BIN 或 APP_SERVER_BIN，无法启动真实 Lime App Server。')
  }

  if (configuredBackendCommand) {
    return {
      binaryPath,
      backendCommand: configuredBackendCommand,
      backendArgs: parseBackendArgs(env),
      backendTimeoutMs: Number.isFinite(backendTimeoutMs) && backendTimeoutMs > 0 ? backendTimeoutMs : undefined,
      usesBuiltInBackend: false
    }
  }

  if (!hasLiveModelConfig(env)) {
    throw new Error('缺少真实模型配置或 LIME_APP_SERVER_BACKEND_COMMAND，已拒绝启动 mock/unavailable App Server backend。')
  }

  const builtInBackendPath = BUILT_IN_BACKEND_PATH_CANDIDATES.find((path) => existsSync(path))

  if (!builtInBackendPath) {
    throw new Error('找不到 Lime Novel 内置 App Server external backend 脚本。')
  }

  return {
    binaryPath,
    backendCommand: process.execPath,
    backendArgs: [builtInBackendPath],
    backendTimeoutMs: Number.isFinite(backendTimeoutMs) && backendTimeoutMs > 0 ? backendTimeoutMs : undefined,
    usesBuiltInBackend: true
  }
}

const sanitizeRuntimeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_')

const toObject = (value: unknown): Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const summarizePayload = (payload: unknown): string => {
  const value = toObject(payload)
  const preferred = ['summary', 'message', 'text', 'content', 'delta', 'detail', 'error']

  for (const key of preferred) {
    const field = value[key]

    if (typeof field === 'string' && field.trim()) {
      return field.trim()
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  return JSON.stringify(payload ?? {})
}

const resolveEventTitle = (event: AppServerAgentEvent): string => {
  const payload = toObject(event.payload)

  if (typeof payload.title === 'string' && payload.title.trim()) {
    return payload.title.trim()
  }

  if (event.type.includes('artifact')) {
    return 'App Server 产物已同步'
  }

  if (event.type.includes('action.required')) {
    return 'App Server 请求作者确认'
  }

  if (event.type.includes('failed') || event.type.includes('error')) {
    return 'App Server 执行失败'
  }

  return 'App Server 事件'
}

const isTerminalSuccessEvent = (eventType: string): boolean =>
  eventType === 'turn.completed' || eventType === 'turn.done' || eventType === 'turn.final_done'

const isTerminalFailureEvent = (eventType: string): boolean =>
  eventType === 'turn.failed' || eventType === 'runtime.error' || eventType.endsWith('.failed')

const shouldCreateFeedItem = (eventType: string): boolean =>
  eventType.includes('artifact') ||
  eventType === 'action.required' ||
  eventType.includes('evidence') ||
  isTerminalFailureEvent(eventType)

const buildTask = (input: StartTaskInputDto): AgentTaskDto => ({
  taskId: createId('task'),
  title: titleBySurface[input.surface] ?? 'Lime App Server 任务',
  summary: input.intent,
  status: 'queued',
  surface: input.surface === 'feature-center' ? 'home' : input.surface,
  agentType: agentTypeBySurface[input.surface] ?? 'project'
})

export class LimeAppServerRuntime implements AgentRuntimePort {
  private listeners = new Set<(event: TaskEventDto) => void>()
  private connectionPromise?: Promise<AppServerConnection>
  private readonly runningTasks = new Map<string, RunningTask>()
  private readonly diagnosticsByTaskId = new Map<string, AgentTaskDiagnosticsDto>()

  constructor(
    private readonly getRepository: () => ProjectRepositoryPort,
    private readonly env: NodeJS.ProcessEnv = process.env
  ) {}

  subscribe(listener: (event: TaskEventDto) => void): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  async loadTaskDiagnostics(): Promise<AgentTaskDiagnosticsDto[]> {
    const persisted = await this.getRepository().loadAgentTaskDiagnostics()
    const merged = new Map(persisted.map((diagnostics) => [diagnostics.taskId, diagnostics]))

    for (const diagnostics of this.diagnosticsByTaskId.values()) {
      merged.set(diagnostics.taskId, diagnostics)
    }

    return [...merged.values()]
  }

  async startTask(input: StartTaskInputDto): Promise<StartTaskResultDto> {
    const task = buildTask(input)
    await this.persistTask(task)

    void this.runTask(task, input)

    return { task }
  }

  async dispose(): Promise<void> {
    const connection = await this.connectionPromise?.catch(() => undefined)

    if (!connection) {
      return
    }

    connection.lines.close()
    connection.child.kill()
    this.connectionPromise = undefined
  }

  private async runTask(task: AgentTaskDto, input: StartTaskInputDto): Promise<void> {
    const sessionId = sanitizeRuntimeId(`lime_novel_${task.taskId}`)
    const turnId = sanitizeRuntimeId(`turn_${task.taskId}`)
    this.runningTasks.set(turnId, {
      task,
      input,
      trace: [],
      terminal: false
    })

    try {
      await this.updateTask(task.taskId, {
        status: 'running',
        summary: '正在连接 Lime App Server external backend。'
      })

      const shell = await this.getRepository().loadWorkspaceShell()
      const connection = await this.ensureConnection()
      const projectId = shell.project.projectId
      const metadata = toObject(input.runtimeOptions?.metadata)

      await this.sendRequest(connection, 'agentSession/start', {
        sessionId,
        threadId: `${sessionId}_thread`,
        appId: 'lime-novel',
        workspaceId: projectId,
        locale: 'zh-CN',
        businessObjectRef: {
          kind: input.chapterId ? 'chapter' : 'project',
          id: input.chapterId ?? projectId,
          title: input.chapterId ?? shell.project.title,
          metadata: {
            ...metadata,
            surface: input.surface,
            projectId
          }
        }
      })

      await this.sendRequest(connection, 'agentSession/turn/start', {
        sessionId,
        turnId,
        input: {
          text: input.intent,
          attachments: []
        },
        runtimeOptions: {
          capabilityId: 'agent.session',
          stream: true,
          eventName: METHOD_AGENT_SESSION_EVENT,
          metadata: {
            ...metadata,
            chapterId: input.chapterId,
            surface: input.surface,
            projectId
          }
        },
        queueIfBusy: true
      })

      const current = this.runningTasks.get(turnId)

      if (current && !current.terminal) {
        await this.failTask(turnId, 'Lime App Server turn 结束时没有返回 turn.completed / turn.failed 终止事件。')
      }
    } catch (error) {
      await this.failTask(turnId, error instanceof Error ? error.message : 'Lime App Server 任务启动失败。')
    }
  }

  private ensureConnection(): Promise<AppServerConnection> {
    if (!this.connectionPromise) {
      this.connectionPromise = this.connect()
    }

    return this.connectionPromise
  }

  private async connect(): Promise<AppServerConnection> {
    const config = resolveAppServerRuntimeConfig(this.env)
    const args = [
      '--stdio',
      '--backend',
      'external',
      '--backend-command',
      config.backendCommand,
      ...config.backendArgs.flatMap((arg) => ['--backend-arg', arg])
    ]

    if (config.backendTimeoutMs) {
      args.push('--backend-timeout-ms', String(config.backendTimeoutMs))
    }

    const childEnv = {
      ...this.env,
      ...(config.usesBuiltInBackend && process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {})
    }
    const child = spawn(config.binaryPath, args, {
      stdio: 'pipe',
      env: childEnv
    })
    const lines = createInterface({ input: child.stdout })
    const connection: AppServerConnection = {
      child,
      lines,
      pending: new Map(),
      nextId: 1
    }

    child.stderr.on('data', (chunk) => {
      const message = String(chunk).trim()

      if (message) {
        console.warn(`[lime-app-server] ${message}`)
      }
    })

    child.on('exit', (code, signal) => {
      const error = new Error(`Lime App Server 已退出：code=${code ?? 'null'} signal=${signal ?? 'null'}`)

      for (const pending of connection.pending.values()) {
        pending.reject(error)
      }

      connection.pending.clear()
      this.connectionPromise = undefined
    })

    lines.on('line', (line) => {
      this.handleLine(connection, line)
    })

    const initializeResult = toObject(
      await this.sendRequest(connection, 'initialize', {
        clientInfo: {
          name: 'lime-novel',
          title: 'Lime Novel',
          version: '0.5.0'
        },
        capabilities: {
          eventMethods: [METHOD_AGENT_SESSION_EVENT],
          experimental: false
        }
      })
    )
    const serverInfo = toObject(initializeResult.serverInfo)

    if (serverInfo.protocolVersion !== APP_SERVER_PROTOCOL_VERSION) {
      throw new Error(`Lime App Server 协议不兼容：${String(serverInfo.protocolVersion)}`)
    }

    this.sendNotification(connection, 'initialized', {})
    return connection
  }

  private handleLine(connection: AppServerConnection, line: string): void {
    if (!line.trim()) {
      return
    }

    let message: JsonRpcResponse | JsonRpcNotification

    try {
      message = JSON.parse(line) as JsonRpcResponse | JsonRpcNotification
    } catch (error) {
      console.warn('[lime-app-server] 无法解析 JSON-RPC 消息', error)
      return
    }

    if ('id' in message) {
      const pending = connection.pending.get(message.id)

      if (!pending) {
        return
      }

      connection.pending.delete(message.id)

      if (message.error) {
        pending.reject(new Error(`${pending.method} failed: ${message.error.message}`))
        return
      }

      pending.resolve(message.result)
      return
    }

    if (message.method === METHOD_AGENT_SESSION_EVENT) {
      void this.handleAgentSessionEvent(message)
    }
  }

  private sendRequest(connection: AppServerConnection, method: string, params: unknown): Promise<unknown> {
    const id = connection.nextId
    connection.nextId += 1
    const request: JsonRpcRequest = { id, method, params }

    return new Promise((resolve, reject) => {
      connection.pending.set(id, { resolve, reject, method })
      connection.child.stdin.write(`${JSON.stringify(request)}\n`)
    })
  }

  private sendNotification(connection: AppServerConnection, method: string, params: unknown): void {
    const notification: JsonRpcNotification = { method, params }
    connection.child.stdin.write(`${JSON.stringify(notification)}\n`)
  }

  private async handleAgentSessionEvent(notification: JsonRpcNotification): Promise<void> {
    const params = toObject(notification.params)
    const event = toObject(params.event) as Partial<AppServerAgentEvent>

    if (!event.turnId || !event.type) {
      return
    }

    const running = this.runningTasks.get(event.turnId)

    if (!running) {
      return
    }

    const appServerEvent = event as AppServerAgentEvent
    this.recordDiagnostics(running, appServerEvent)

    if (shouldCreateFeedItem(appServerEvent.type)) {
      await this.appendFeedItem(running.task, appServerEvent)
    }

    if (isTerminalSuccessEvent(appServerEvent.type)) {
      running.terminal = true
      await this.updateTask(running.task.taskId, {
        status: 'completed',
        summary: summarizePayload(appServerEvent.payload) || 'Lime App Server turn 已完成。'
      })
      return
    }

    if (isTerminalFailureEvent(appServerEvent.type)) {
      running.terminal = true
      await this.updateTask(running.task.taskId, {
        status: 'failed',
        summary: summarizePayload(appServerEvent.payload) || 'Lime App Server turn 执行失败。'
      })
      return
    }

    if (appServerEvent.type === 'turn.started' || appServerEvent.type === 'turn.accepted') {
      await this.updateTask(running.task.taskId, {
        status: 'running',
        summary: summarizePayload(appServerEvent.payload) || 'Lime App Server turn 正在执行。'
      })
    }
  }

  private recordDiagnostics(running: RunningTask, event: AppServerAgentEvent): void {
    running.trace.push({
      role: 'tool',
      turnIndex: event.sequence,
      toolName: event.type,
      content: summarizePayload(event.payload)
    })

    if (running.trace.length > MAX_TRACE_ENTRIES) {
      running.trace.splice(0, running.trace.length - MAX_TRACE_ENTRIES)
    }

    const diagnostics: AgentTaskDiagnosticsDto = {
      taskId: running.task.taskId,
      trace: running.trace,
      toolEvents: [],
      stats: {
        turnCount: Math.max(1, running.trace.length),
        usage: {
          inputTokens: 0,
          outputTokens: 0
        }
      },
      updatedAt: nowIso()
    }

    this.diagnosticsByTaskId.set(running.task.taskId, diagnostics)
    void this.getRepository().upsertAgentTaskDiagnostics(diagnostics).catch(() => undefined)
    this.emit({
      type: 'task.diagnostics',
      diagnostics
    })
  }

  private async appendFeedItem(task: AgentTaskDto, event: AppServerAgentEvent): Promise<void> {
    const isFailure = isTerminalFailureEvent(event.type)
    const item: AgentFeedItemDto = {
      itemId: createId('feed'),
      taskId: task.taskId,
      kind: isFailure ? 'issue' : event.type === 'action.required' ? 'approval' : 'evidence',
      title: resolveEventTitle(event),
      body: summarizePayload(event.payload),
      supportingLabel: `Lime App Server / ${event.type}`,
      severity: isFailure ? 'high' : undefined,
      createdAt: nowIso()
    }

    await this.getRepository().appendAgentFeed(item)
    this.emit({
      type: 'feed.item',
      item
    })
  }

  private async failTask(turnId: string, detail: string): Promise<void> {
    const running = this.runningTasks.get(turnId)

    if (!running || running.terminal) {
      return
    }

    running.terminal = true
    await this.appendFeedItem(running.task, {
      eventId: createId('evt'),
      sequence: running.trace.length + 1,
      sessionId: '',
      turnId,
      type: 'turn.failed',
      timestamp: nowIso(),
      payload: {
        summary: detail
      }
    })
    await this.updateTask(running.task.taskId, {
      status: 'failed',
      summary: detail
    })
  }

  private async updateTask(taskId: string, patch: Pick<AgentTaskDto, 'status' | 'summary'>): Promise<void> {
    const running = [...this.runningTasks.values()].find((item) => item.task.taskId === taskId)

    if (!running) {
      return
    }

    running.task = {
      ...running.task,
      ...patch
    }
    await this.persistTask(running.task)
  }

  private async persistTask(task: AgentTaskDto): Promise<void> {
    await this.getRepository().upsertAgentTask(task)
    this.emit({
      type: 'task.updated',
      task
    })
  }

  private emit(event: TaskEventDto): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

export const createLimeAppServerRuntime = (
  getRepository: () => ProjectRepositoryPort,
  env?: NodeJS.ProcessEnv
): LimeAppServerRuntime => new LimeAppServerRuntime(getRepository, env)
