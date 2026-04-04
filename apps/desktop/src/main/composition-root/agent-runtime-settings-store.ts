import type {
  AgentRuntimeProviderDto,
  AgentRuntimeSettingsDto
} from '@lime-novel/application'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const defaultAgentRuntimeSettings: AgentRuntimeSettingsDto = {
  provider: 'legacy',
  baseUrl: '',
  apiKey: '',
  model: ''
}

const normalizeProvider = (value: unknown): AgentRuntimeProviderDto => {
  if (value === 'legacy' || value === 'anthropic' || value === 'openai-compatible') {
    return value
  }

  return defaultAgentRuntimeSettings.provider
}

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const normalizeSettings = (value: unknown): AgentRuntimeSettingsDto => {
  if (!value || typeof value !== 'object') {
    return defaultAgentRuntimeSettings
  }

  const nextValue = value as Partial<AgentRuntimeSettingsDto>

  return {
    provider: normalizeProvider(nextValue.provider),
    baseUrl: normalizeText(nextValue.baseUrl),
    apiKey: normalizeText(nextValue.apiKey),
    model: normalizeText(nextValue.model)
  }
}

export const createAgentRuntimeSettingsStore = (
  userDataPath: string,
  fallbackSettings: AgentRuntimeSettingsDto = defaultAgentRuntimeSettings
) => {
  const statePath = join(userDataPath, 'agent-runtime-settings.json')
  let cachedSettings: AgentRuntimeSettingsDto | null = null

  const load = async (): Promise<AgentRuntimeSettingsDto> => {
    if (cachedSettings) {
      return cachedSettings
    }

    try {
      const fileContent = await readFile(statePath, 'utf8')
      cachedSettings = normalizeSettings(JSON.parse(fileContent))
    } catch {
      cachedSettings = normalizeSettings(fallbackSettings)
    }

    return cachedSettings
  }

  const save = async (settings: AgentRuntimeSettingsDto): Promise<AgentRuntimeSettingsDto> => {
    const normalized = normalizeSettings(settings)
    await mkdir(dirname(statePath), { recursive: true })
    await writeFile(statePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
    cachedSettings = normalized
    return normalized
  }

  return {
    load,
    save
  }
}
