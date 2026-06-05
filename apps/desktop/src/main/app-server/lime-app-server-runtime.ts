import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createInterface, type Interface as ReadlineInterface } from 'node:readline'
import { resolve } from 'node:path'
import type {
  AgentFeedItemDto,
  AgentTaskDiagnosticsDto,
  AgentTaskDto,
  AgentTraceEntryDto,
  AgentRuntimePort,
  HarnessActionDto,
  HarnessArtifactDto,
  HarnessEvidenceDto,
  HarnessTargetRefDto,
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

type AppServerAgentTurnStartResponse = {
  turn?: {
    sessionId?: string
    threadId?: string
    turnId?: string
    status?: string
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

type AppServerArtifactSummary = {
  artifactRef?: string
  eventId?: string
  sequence?: number
  turnId?: string
  artifactId?: string
  path?: string
  title?: string
  kind?: string
  status?: string
  content?: string
  contentStatus?: string
}

type AppServerEvidencePackArtifact = {
  kind?: string
  title?: string
  relativePath?: string
  absolutePath?: string
  bytes?: number
}

type AppServerEvidencePackSummary = {
  packRelativeRoot?: string
  packAbsoluteRoot?: string
  exportedAt?: string
  threadStatus?: string
  latestTurnStatus?: string
  turnCount?: number
  itemCount?: number
  pendingRequestCount?: number
  queuedTurnCount?: number
  recentArtifactCount?: number
  knownGaps?: string[]
  artifacts?: AppServerEvidencePackArtifact[]
}

type AppServerEvidenceExportResponse = {
  events?: AppServerAgentEvent[]
  artifacts?: AppServerArtifactSummary[]
  exportedAt?: string
  evidencePack?: AppServerEvidencePackSummary
}

type AppServerConnection = {
  child: ChildProcessWithoutNullStreams
  lines: ReadlineInterface
  envKey: string
  pending: Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    method: string
  }>
  nextId: number
}

type RuntimeEnvResolver = () => NodeJS.ProcessEnv | Promise<NodeJS.ProcessEnv>

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
const DEFAULT_TURN_COMPLETION_GRACE_MS = 500
const APP_SERVER_BINARY_NAME = process.platform === 'win32' ? 'app-server.exe' : 'app-server'
const APP_SERVER_PLATFORM_DIR = `${process.platform}-${process.arch}`
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
  const apiKey = env.LIME_NOVEL_AGENT_API_KEY?.trim()
  const baseUrl = env.LIME_NOVEL_AGENT_BASE_URL?.trim()
  const model = env.LIME_NOVEL_AGENT_MODEL?.trim()

  if (provider === 'anthropic') {
    return Boolean(apiKey)
  }

  if (provider === 'openai-compatible') {
    return Boolean(apiKey || baseUrl)
  }

  return Boolean(apiKey || (baseUrl && model))
}

const resolveAppServerBinaryPath = (env: NodeJS.ProcessEnv): string | undefined => {
  const explicitPath = env.LIME_APP_SERVER_BIN?.trim() || env.APP_SERVER_BIN?.trim()

  if (explicitPath) {
    return explicitPath
  }

  const resourceRoots = [
    env.LIME_APP_SERVER_RESOURCE_ROOT?.trim(),
    env.APP_SERVER_RESOURCE_ROOT?.trim(),
    process.resourcesPath,
    resolve(process.cwd(), 'dist-electron'),
    resolve(process.cwd(), 'apps/desktop/dist-electron'),
    resolve(process.cwd(), '..', 'lime', 'dist-electron'),
    resolve(process.cwd(), '..', '..', 'aiclientproxy', 'lime', 'dist-electron'),
    resolve(process.cwd(), '..', 'aiclientproxy', 'lime', 'dist-electron')
  ].filter((path): path is string => Boolean(path))

  for (const resourceRoot of resourceRoots) {
    const candidate = resolve(resourceRoot, 'app-server', APP_SERVER_PLATFORM_DIR, APP_SERVER_BINARY_NAME)

    if (existsSync(candidate)) {
      return candidate
    }
  }

  return undefined
}

const buildConnectionEnvKey = (env: NodeJS.ProcessEnv): string =>
  JSON.stringify({
    binaryPath: resolveAppServerBinaryPath(env),
    backendCommand: env.LIME_APP_SERVER_BACKEND_COMMAND?.trim() ?? '',
    backendArgs: env.LIME_APP_SERVER_BACKEND_ARGS_JSON?.trim() ?? '',
    backendTimeoutMs: env.LIME_APP_SERVER_BACKEND_TIMEOUT_MS?.trim() ?? '',
    provider: env.LIME_NOVEL_AGENT_PROVIDER?.trim() ?? '',
    baseUrl: env.LIME_NOVEL_AGENT_BASE_URL?.trim() ?? '',
    apiKey: env.LIME_NOVEL_AGENT_API_KEY?.trim() ?? '',
    model: env.LIME_NOVEL_AGENT_MODEL?.trim() ?? ''
  })

const resolveTurnCompletionGraceMs = (env: NodeJS.ProcessEnv): number => {
  const configured = Number.parseInt(env.LIME_APP_SERVER_TURN_COMPLETION_GRACE_MS ?? '', 10)
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_TURN_COMPLETION_GRACE_MS
}

export const resolveAppServerRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): AppServerRuntimeConfig => {
  const binaryPath = resolveAppServerBinaryPath(env)
  const configuredBackendCommand = env.LIME_APP_SERVER_BACKEND_COMMAND?.trim()
  const backendTimeoutMs = Number.parseInt(env.LIME_APP_SERVER_BACKEND_TIMEOUT_MS ?? '', 10)

  if (!binaryPath) {
    throw new Error('缺少 LIME_APP_SERVER_BIN / APP_SERVER_BIN，且未发现可用 App Server sidecar。')
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

const resolveEventRefId = (event: AppServerAgentEvent, fallbackPrefix: string): string => {
  const payload = toObject(event.payload)
  const candidates = ['artifactId', 'artifactRef', 'evidenceId', 'actionId', 'id']

  for (const key of candidates) {
    const value = payload[key]

    if (typeof value === 'string' && value.trim()) {
      return sanitizeRuntimeId(value.trim())
    }
  }

  return sanitizeRuntimeId(`${fallbackPrefix}_${event.eventId}`)
}

const buildTargetRef = (running: RunningTask, event: AppServerAgentEvent): HarnessTargetRefDto => {
  const payload = toObject(event.payload)
  const metadata = toObject(running.input.runtimeOptions?.metadata)
  const target = toObject(metadata.target)
  const businessObjectRef = toObject(metadata.businessObjectRef)
  const refId =
    typeof target.id === 'string'
      ? target.id
      : typeof businessObjectRef.id === 'string'
        ? businessObjectRef.id
        : running.input.chapterId ?? running.task.surface
  const label =
    typeof target.label === 'string'
      ? target.label
      : typeof businessObjectRef.title === 'string'
        ? businessObjectRef.title
        : typeof payload.title === 'string'
          ? payload.title
          : running.task.title

  return {
    refId: sanitizeRuntimeId(refId),
    kind: running.input.chapterId ? 'chapter' : 'project',
    label
  }
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

const supportedHarnessArtifactKinds = new Set<HarnessArtifactDto['kind']>([
  'context-bundle',
  'character-state',
  'foreshadowing-state',
  'impact-analysis',
  'platform-risk',
  'reader-feedback',
  'change-set',
  'sync-summary'
])

const resolveHarnessArtifactKindValue = (
  kindValue: unknown,
  eventType = ''
): HarnessArtifactDto['kind'] => {
  const kind = typeof kindValue === 'string' ? kindValue : ''

  if (supportedHarnessArtifactKinds.has(kind as HarnessArtifactDto['kind'])) {
    return kind as HarnessArtifactDto['kind']
  }

  if (isTerminalSuccessEvent(eventType) || isTerminalFailureEvent(eventType)) {
    return 'sync-summary'
  }

  if (eventType.includes('impact')) {
    return 'impact-analysis'
  }

  if (eventType.includes('risk')) {
    return 'platform-risk'
  }

  if (eventType.includes('feedback')) {
    return 'reader-feedback'
  }

  return 'sync-summary'
}

const resolveHarnessArtifactKind = (event: AppServerAgentEvent): HarnessArtifactDto['kind'] =>
  resolveHarnessArtifactKindValue(toObject(event.payload).kind, event.type)

const getExportEvidencePackId = (event: AppServerAgentEvent): string =>
  sanitizeRuntimeId(`app_server_evidence_pack_${event.sessionId}_${event.turnId ?? 'turn'}`)

const getExportEventLogEvidenceId = (event: AppServerAgentEvent): string =>
  sanitizeRuntimeId(`app_server_event_log_${event.sessionId}_${event.turnId ?? 'turn'}`)

const getExportEvidenceIds = (event: AppServerAgentEvent, exportResult: AppServerEvidenceExportResponse): string[] => {
  const evidenceIds: string[] = []

  if (exportResult.evidencePack) {
    evidenceIds.push(getExportEvidencePackId(event))
  }

  if ((exportResult.events?.length ?? 0) > 0) {
    evidenceIds.push(getExportEventLogEvidenceId(event))
  }

  return evidenceIds
}

const summarizeExportedArtifact = (artifact: AppServerArtifactSummary): string => {
  const parts = [
    artifact.status ? `status=${artifact.status}` : undefined,
    artifact.path ? `path=${artifact.path}` : undefined,
    artifact.contentStatus ? `content=${artifact.contentStatus}` : undefined
  ].filter((part): part is string => Boolean(part))

  if (artifact.content?.trim()) {
    parts.push(artifact.content.trim().slice(0, 180))
  }

  return parts.join('；') || artifact.artifactRef || artifact.artifactId || 'App Server exported artifact'
}

const summarizeEvidencePack = (pack: AppServerEvidencePackSummary): string => {
  const parts = [
    pack.threadStatus ? `thread=${pack.threadStatus}` : undefined,
    pack.latestTurnStatus ? `turn=${pack.latestTurnStatus}` : undefined,
    typeof pack.turnCount === 'number' ? `turns=${pack.turnCount}` : undefined,
    typeof pack.itemCount === 'number' ? `items=${pack.itemCount}` : undefined,
    typeof pack.recentArtifactCount === 'number' ? `artifacts=${pack.recentArtifactCount}` : undefined,
    pack.knownGaps?.length ? `gaps=${pack.knownGaps.join(',')}` : undefined
  ].filter((part): part is string => Boolean(part))

  return parts.join('；') || 'App Server evidence pack exported'
}

const summarizeExportedEvents = (events: AppServerAgentEvent[]): string => {
  const eventTypes = [...new Set(events.map((event) => event.type).filter(Boolean))]
  return `App Server exported ${events.length} events${eventTypes.length > 0 ? `：${eventTypes.join(', ')}` : ''}`
}

const describeEvidencePackArtifacts = (pack: AppServerEvidencePackSummary): string => {
  const artifacts = pack.artifacts ?? []

  if (artifacts.length === 0) {
    return summarizeEvidencePack(pack)
  }

  const artifactLines = artifacts
    .slice(0, 6)
    .map((artifact) => {
      const path = artifact.relativePath ?? artifact.absolutePath ?? ''
      const bytes = typeof artifact.bytes === 'number' ? ` (${artifact.bytes} bytes)` : ''
      return `${artifact.kind ?? 'artifact'} ${artifact.title ?? path}${path ? ` @ ${path}` : ''}${bytes}`
    })

  return `${summarizeEvidencePack(pack)}\n${artifactLines.join('\n')}`
}

const buildSyntheticTurnCompletedEvent = (
  turnStartResult: AppServerAgentTurnStartResponse,
  sessionId: string,
  threadId: string,
  turnId: string
): AppServerAgentEvent => ({
  eventId: sanitizeRuntimeId(`turn_completed_${sessionId}_${turnId}`),
  sequence: 0,
  sessionId: turnStartResult.turn?.sessionId ?? sessionId,
  threadId: turnStartResult.turn?.threadId ?? threadId,
  turnId: turnStartResult.turn?.turnId ?? turnId,
  type: 'turn.completed',
  timestamp: nowIso(),
  payload: {
    summary: 'Lime App Server turn 已返回，正在同步 evidence/export。',
    status: turnStartResult.turn?.status ?? 'accepted'
  }
})

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
  private connectionPromises = new Map<string, Promise<AppServerConnection>>()
  private readonly runningTasks = new Map<string, RunningTask>()
  private readonly diagnosticsByTaskId = new Map<string, AgentTaskDiagnosticsDto>()

  constructor(
    private readonly getRepository: () => ProjectRepositoryPort,
    private readonly resolveRuntimeEnv: RuntimeEnvResolver = () => process.env
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
    const connections = await Promise.all([...this.connectionPromises.values()].map((promise) => promise.catch(() => undefined)))
    this.connectionPromises.clear()

    for (const connection of connections) {
      connection?.lines.close()
      connection?.child.kill()
    }
  }

  private async runTask(task: AgentTaskDto, input: StartTaskInputDto): Promise<void> {
    const sessionId = sanitizeRuntimeId(`lime_novel_${task.taskId}`)
    const threadId = `${sessionId}_thread`
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
      const runtimeEnv = await this.resolveRuntimeEnv()
      const connection = await this.ensureConnection(runtimeEnv)
      const projectId = shell.project.projectId
      const metadata = toObject(input.runtimeOptions?.metadata)

      await this.sendRequest(connection, 'agentSession/start', {
        sessionId,
        threadId,
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

      const turnStartResult = toObject(await this.sendRequest(connection, 'agentSession/turn/start', {
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
      })) as AppServerAgentTurnStartResponse

      if (!(await this.waitForTerminal(turnId, resolveTurnCompletionGraceMs(runtimeEnv)))) {
        const current = this.runningTasks.get(turnId)

        if (current && !current.terminal) {
          const completedEvent = buildSyntheticTurnCompletedEvent(turnStartResult, sessionId, threadId, turnId)
          current.terminal = true
          await this.exportTurnEvidence(connection, current, completedEvent)
          await this.upsertRuntimeArtifact(current, completedEvent)
          await this.updateTask(task.taskId, {
            status: 'completed',
            summary: summarizePayload(completedEvent.payload)
          })
        }
      }
    } catch (error) {
      await this.failTask(turnId, error instanceof Error ? error.message : 'Lime App Server 任务启动失败。')
    }
  }

  private async waitForTerminal(turnId: string, timeoutMs: number): Promise<boolean> {
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
      const running = this.runningTasks.get(turnId)

      if (!running || running.terminal) {
        return true
      }

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
    }

    return this.runningTasks.get(turnId)?.terminal === true
  }

  private ensureConnection(env: NodeJS.ProcessEnv): Promise<AppServerConnection> {
    const envKey = buildConnectionEnvKey(env)
    const existingConnection = this.connectionPromises.get(envKey)

    if (existingConnection) {
      return existingConnection
    }

    const nextConnection = this.connect(env, envKey).catch((error) => {
      this.connectionPromises.delete(envKey)
      throw error
    })
    this.connectionPromises.set(envKey, nextConnection)
    return nextConnection
  }

  private async connect(env: NodeJS.ProcessEnv, envKey: string): Promise<AppServerConnection> {
    const config = resolveAppServerRuntimeConfig(env)
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
      ...env,
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
      envKey,
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
      this.connectionPromises.delete(connection.envKey)
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
      void this.handleAgentSessionEvent(connection, message)
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

  private async handleAgentSessionEvent(connection: AppServerConnection, notification: JsonRpcNotification): Promise<void> {
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
    const isSuccess = isTerminalSuccessEvent(appServerEvent.type)
    const isFailure = isTerminalFailureEvent(appServerEvent.type)

    if (isSuccess || isFailure) {
      running.terminal = true
    }

    this.recordDiagnostics(running, appServerEvent)
    await this.projectHarnessEvent(running, appServerEvent)

    if (shouldCreateFeedItem(appServerEvent.type)) {
      await this.appendFeedItem(running.task, appServerEvent)
    }

    if (isSuccess || isFailure) {
      await this.exportTurnEvidence(connection, running, appServerEvent)
    }

    if (isSuccess) {
      await this.updateTask(running.task.taskId, {
        status: 'completed',
        summary: summarizePayload(appServerEvent.payload) || 'Lime App Server turn 已完成。'
      })
      return
    }

    if (isFailure) {
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

  private async exportTurnEvidence(
    connection: AppServerConnection,
    running: RunningTask,
    terminalEvent: AppServerAgentEvent
  ): Promise<void> {
    try {
      const exportResult = toObject(
        await this.sendRequest(connection, 'evidence/export', {
          sessionId: terminalEvent.sessionId,
          turnId: terminalEvent.turnId,
          includeEvents: true,
          includeArtifacts: true,
          includeEvidencePack: true
        })
      ) as AppServerEvidenceExportResponse

      await this.projectEvidenceExport(running, terminalEvent, exportResult)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'App Server evidence/export 失败。'
      const failedExportEvent: AppServerAgentEvent = {
        eventId: createId('evt'),
        sequence: terminalEvent.sequence + 1,
        sessionId: terminalEvent.sessionId,
        threadId: terminalEvent.threadId,
        turnId: terminalEvent.turnId,
        type: 'evidence.export.failed',
        timestamp: nowIso(),
        payload: {
          summary: message
        }
      }

      this.recordDiagnostics(running, failedExportEvent)
      await this.upsertRuntimeEvidence(running, failedExportEvent)
      await this.appendFeedItem(running.task, failedExportEvent)
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

  private async projectHarnessEvent(running: RunningTask, event: AppServerAgentEvent): Promise<void> {
    if (event.type === 'action.required') {
      await this.upsertRuntimeAction(running, event)
      return
    }

    if (event.type.includes('evidence')) {
      await this.upsertRuntimeEvidence(running, event)
      return
    }

    if (event.type.includes('artifact') || isTerminalSuccessEvent(event.type) || isTerminalFailureEvent(event.type)) {
      await this.upsertRuntimeArtifact(running, event)
    }
  }

  private async projectEvidenceExport(
    running: RunningTask,
    terminalEvent: AppServerAgentEvent,
    exportResult: AppServerEvidenceExportResponse
  ): Promise<void> {
    const evidenceIds = getExportEvidenceIds(terminalEvent, exportResult)

    if (exportResult.evidencePack) {
      await this.upsertExportedEvidencePack(running, terminalEvent, exportResult.evidencePack)
    }

    if (exportResult.events?.length) {
      await this.upsertExportedEventLog(running, terminalEvent, exportResult.events, exportResult.exportedAt)
    }

    for (const artifact of exportResult.artifacts ?? []) {
      await this.upsertExportedArtifact(running, terminalEvent, artifact, evidenceIds)
    }
  }

  private async upsertRuntimeAction(running: RunningTask, event: AppServerAgentEvent): Promise<void> {
    const action: HarnessActionDto = {
      actionId: resolveEventRefId(event, 'runtime_action'),
      taskId: running.task.taskId,
      actionType: 'create-change-set',
      targetRef: buildTargetRef(running, event),
      decision: 'requires-confirmation',
      status: 'pending',
      summary: summarizePayload(event.payload),
      riskLevel: 'medium',
      createdAt: event.timestamp
    }

    await this.getRepository().upsertHarnessAction(action)
  }

  private async upsertRuntimeArtifact(running: RunningTask, event: AppServerAgentEvent): Promise<void> {
    const artifact: HarnessArtifactDto = {
      artifactId: resolveEventRefId(event, 'runtime_artifact'),
      taskId: running.task.taskId,
      kind: resolveHarnessArtifactKind(event),
      title: resolveEventTitle(event),
      summary: summarizePayload(event.payload),
      evidenceIds: [],
      refId: event.eventId,
      createdAt: event.timestamp
    }

    await this.getRepository().upsertHarnessArtifact(artifact)
  }

  private async upsertExportedArtifact(
    running: RunningTask,
    terminalEvent: AppServerAgentEvent,
    artifactSummary: AppServerArtifactSummary,
    evidenceIds: string[]
  ): Promise<void> {
    const artifactRef = artifactSummary.artifactRef ?? artifactSummary.artifactId ?? artifactSummary.eventId

    if (!artifactRef) {
      return
    }

    const artifact: HarnessArtifactDto = {
      artifactId: sanitizeRuntimeId(`app_server_artifact_${terminalEvent.sessionId}_${artifactRef}`),
      taskId: running.task.taskId,
      kind: resolveHarnessArtifactKindValue(artifactSummary.kind, 'artifact.snapshot'),
      title: artifactSummary.title ?? artifactSummary.artifactId ?? artifactSummary.artifactRef ?? 'App Server 产物',
      summary: summarizeExportedArtifact(artifactSummary),
      evidenceIds,
      refId: artifactSummary.path ?? artifactSummary.artifactRef ?? artifactSummary.artifactId,
      createdAt: terminalEvent.timestamp
    }

    await this.getRepository().upsertHarnessArtifact(artifact)
  }

  private async upsertRuntimeEvidence(running: RunningTask, event: AppServerAgentEvent): Promise<void> {
    const evidence: HarnessEvidenceDto = {
      evidenceId: resolveEventRefId(event, 'runtime_evidence'),
      sourceRef: buildTargetRef(running, event),
      summary: summarizePayload(event.payload),
      locator: `app-server:${event.type}:${event.sequence}`,
      excerpt: summarizePayload(event.payload).slice(0, 240),
      createdAt: event.timestamp
    }

    await this.getRepository().upsertHarnessEvidence(evidence)
  }

  private async upsertExportedEvidencePack(
    running: RunningTask,
    terminalEvent: AppServerAgentEvent,
    evidencePack: AppServerEvidencePackSummary
  ): Promise<void> {
    const root = evidencePack.packRelativeRoot ?? evidencePack.packAbsoluteRoot
    const evidence: HarnessEvidenceDto = {
      evidenceId: getExportEvidencePackId(terminalEvent),
      sourceRef: buildTargetRef(running, terminalEvent),
      summary: summarizeEvidencePack(evidencePack),
      locator: root ? `app-server:evidence-pack:${root}` : `app-server:evidence-pack:${terminalEvent.sessionId}`,
      excerpt: describeEvidencePackArtifacts(evidencePack).slice(0, 240),
      createdAt: evidencePack.exportedAt ?? terminalEvent.timestamp
    }

    await this.getRepository().upsertHarnessEvidence(evidence)
  }

  private async upsertExportedEventLog(
    running: RunningTask,
    terminalEvent: AppServerAgentEvent,
    events: AppServerAgentEvent[],
    exportedAt?: string
  ): Promise<void> {
    const evidence: HarnessEvidenceDto = {
      evidenceId: getExportEventLogEvidenceId(terminalEvent),
      sourceRef: buildTargetRef(running, terminalEvent),
      summary: summarizeExportedEvents(events),
      locator: `app-server:event-log:${terminalEvent.sessionId}:${terminalEvent.turnId ?? 'turn'}`,
      excerpt: events
        .slice(0, 6)
        .map((event) => `${event.sequence}:${event.type}:${summarizePayload(event.payload)}`)
        .join('\n')
        .slice(0, 240),
      createdAt: exportedAt ?? terminalEvent.timestamp
    }

    await this.getRepository().upsertHarnessEvidence(evidence)
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
  env?: NodeJS.ProcessEnv | RuntimeEnvResolver
): LimeAppServerRuntime =>
  new LimeAppServerRuntime(getRepository, typeof env === 'function' ? env : () => env ?? process.env)
