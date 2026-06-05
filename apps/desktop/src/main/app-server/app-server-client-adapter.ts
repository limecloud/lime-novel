type SerializableMetadata = Record<string, unknown>

type RuntimeOptionsWithMetadata = {
  metadata?: SerializableMetadata
  [key: string]: unknown
}

type StartTaskCompatInput = {
  surface: string
  chapterId?: string
  runtimeOptions?: RuntimeOptionsWithMetadata
}

type AppServerRuntimeContext = {
  projectId: string
}

const APP_SERVER_CURRENT_METADATA: SerializableMetadata = {
  source: 'desktop-main',
  current: 'lime-app-server',
  requiresLive: true,
  appServer: {
    mode: 'current',
    current: true,
    transport: 'desktop-agent-runtime'
  }
}

const toMetadataRecord = (value: unknown): SerializableMetadata =>
  value != null && typeof value === 'object' && !Array.isArray(value) ? (value as SerializableMetadata) : {}

const buildTargetMetadata = (
  input: StartTaskCompatInput,
  context: AppServerRuntimeContext
): SerializableMetadata => {
  if (input.chapterId) {
    return {
      kind: 'chapter',
      id: input.chapterId,
      projectId: context.projectId,
      surface: input.surface
    }
  }

  return {
    kind: 'project',
    id: context.projectId,
    projectId: context.projectId,
    surface: input.surface
  }
}

const buildCommandMetadata = (existingMetadata: SerializableMetadata): SerializableMetadata => {
  const existingCommand = toMetadataRecord(existingMetadata.command)

  return {
    ...existingCommand,
    kind: typeof existingCommand.kind === 'string' ? existingCommand.kind : 'agent-runtime.start-task'
  }
}

const buildAppServerMetadata = (existingMetadata: SerializableMetadata): SerializableMetadata => {
  const existingAppServer = toMetadataRecord(existingMetadata.appServer)

  return {
    ...existingAppServer,
    mode: 'current',
    current: true,
    transport:
      typeof existingAppServer.transport === 'string'
        ? existingAppServer.transport
        : APP_SERVER_CURRENT_METADATA.appServer && typeof APP_SERVER_CURRENT_METADATA.appServer === 'object'
          ? (APP_SERVER_CURRENT_METADATA.appServer as SerializableMetadata).transport
          : 'desktop-agent-runtime'
  }
}

export const enrichAppServerRuntimeMetadata = <TInput extends StartTaskCompatInput>(
  input: TInput,
  context: AppServerRuntimeContext
): TInput & { runtimeOptions: RuntimeOptionsWithMetadata } => {
  const runtimeOptions = input.runtimeOptions ?? {}
  const existingMetadata = toMetadataRecord(runtimeOptions.metadata)
  const targetMetadata = buildTargetMetadata(input, context)
  const existingTarget = toMetadataRecord(existingMetadata.target)
  const existingBusinessObjectRef = toMetadataRecord(existingMetadata.businessObjectRef)

  return {
    ...input,
    runtimeOptions: {
      ...runtimeOptions,
      metadata: {
        ...existingMetadata,
        source: existingMetadata.source ?? APP_SERVER_CURRENT_METADATA.source,
        current: existingMetadata.current ?? APP_SERVER_CURRENT_METADATA.current,
        requiresLive: existingMetadata.requiresLive ?? APP_SERVER_CURRENT_METADATA.requiresLive,
        projectId: existingMetadata.projectId ?? context.projectId,
        target: {
          ...targetMetadata,
          ...existingTarget,
          kind: typeof existingTarget.kind === 'string' ? existingTarget.kind : targetMetadata.kind
        },
        businessObjectRef: {
          ...targetMetadata,
          ...existingBusinessObjectRef,
          kind:
            typeof existingBusinessObjectRef.kind === 'string'
              ? existingBusinessObjectRef.kind
              : targetMetadata.kind
        },
        command: buildCommandMetadata(existingMetadata),
        appServer: buildAppServerMetadata(existingMetadata)
      }
    }
  }
}
