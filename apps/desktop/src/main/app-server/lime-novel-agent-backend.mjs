#!/usr/bin/env node

import { createInterface } from 'node:readline'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini'
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_VERSION = '2023-06-01'

const readStdinLine = async () => {
  const readline = createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  })

  for await (const line of readline) {
    const trimmed = line.trim()

    if (trimmed) {
      readline.close()
      return trimmed
    }
  }

  return ''
}

const emitEvent = (type, payload = {}) => {
  process.stdout.write(`${JSON.stringify({ type, payload })}\n`)
}

const emitFailure = (summary) => {
  emitEvent('turn.failed', {
    summary
  })
}

const normalizeProvider = () => {
  const explicit = process.env.LIME_NOVEL_AGENT_PROVIDER?.trim()

  if (explicit === 'anthropic' || explicit === 'openai-compatible') {
    return explicit
  }

  if (explicit === 'legacy') {
    return 'legacy'
  }

  const baseUrl = process.env.LIME_NOVEL_AGENT_BASE_URL?.toLowerCase()
  const model = process.env.LIME_NOVEL_AGENT_MODEL?.toLowerCase()

  if (baseUrl?.includes('anthropic') || model?.includes('claude')) {
    return 'anthropic'
  }

  if (process.env.LIME_NOVEL_AGENT_API_KEY || process.env.LIME_NOVEL_AGENT_MODEL || process.env.LIME_NOVEL_AGENT_BASE_URL) {
    return 'openai-compatible'
  }

  return 'legacy'
}

const resolveConfig = () => {
  const provider = normalizeProvider()

  if (provider === 'legacy') {
    throw new Error('真实 App Server backend 需要 live provider，当前配置仍是 legacy。')
  }

  const apiKey = process.env.LIME_NOVEL_AGENT_API_KEY?.trim()

  if (!apiKey && provider === 'anthropic') {
    throw new Error('缺少 LIME_NOVEL_AGENT_API_KEY，无法执行真实模型 turn。')
  }

  if (!apiKey && provider === 'openai-compatible' && !process.env.LIME_NOVEL_AGENT_BASE_URL?.trim()) {
    throw new Error('缺少 LIME_NOVEL_AGENT_API_KEY 或 LIME_NOVEL_AGENT_BASE_URL，无法执行真实模型 turn。')
  }

  return {
    provider,
    apiKey,
    model:
      process.env.LIME_NOVEL_AGENT_MODEL?.trim() ||
      (provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL),
    baseUrl:
      process.env.LIME_NOVEL_AGENT_BASE_URL?.trim() ||
      (provider === 'anthropic' ? DEFAULT_ANTHROPIC_BASE_URL : DEFAULT_OPENAI_BASE_URL),
    temperature: Number.parseFloat(process.env.LIME_NOVEL_AGENT_TEMPERATURE ?? '0.2')
  }
}

const extractRequestText = (request) => {
  const text = request?.request?.input?.text

  if (typeof text === 'string' && text.trim()) {
    return text.trim()
  }

  throw new Error('App Server external backend request 缺少 input.text。')
}

const buildSystemPrompt = () => [
  '你是 Lime Novel 的真实执行 Agent backend。',
  '你必须使用简体中文。',
  '你正在通过 Lime App Server external backend 执行 turn，不允许声称自己使用了 mock 或本地规则。',
  '请基于用户输入给出可落地、可审阅的结果。如果需要作者确认，请明确列出确认点。',
  '不要声称已经直接改写仓库文件；如需改动，只输出建议、依据和待确认动作。'
].join('\n')

const completeOpenAICompatible = async (config, text) => {
  const headers = {
    'content-type': 'application/json'
  }

  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      temperature: Number.isFinite(config.temperature) ? config.temperature : 0.2,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt()
        },
        {
          role: 'user',
          content: text
        }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI Compatible 请求失败：${response.status} ${await response.text()}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI Compatible 返回缺少正文。')
  }

  return content.trim()
}

const extractAnthropicText = (content) => {
  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

const completeAnthropic = async (config, text) => {
  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      temperature: Number.isFinite(config.temperature) ? config.temperature : 0.2,
      max_tokens: Number.parseInt(process.env.LIME_NOVEL_AGENT_MAX_OUTPUT_TOKENS ?? '8192', 10),
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: text
        }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(`Anthropic 请求失败：${response.status} ${await response.text()}`)
  }

  const payload = await response.json()
  const content = extractAnthropicText(payload?.content)

  if (!content) {
    throw new Error('Anthropic 返回缺少正文。')
  }

  return content
}

const run = async () => {
  const line = await readStdinLine()
  const request = JSON.parse(line)

  if (request.kind !== 'turnStart') {
    emitFailure(`暂不支持的 App Server backend 请求：${request.kind}`)
    return
  }

  const config = resolveConfig()
  const text = extractRequestText(request)

  emitEvent('turn.started', {
    summary: `Lime App Server external backend 已连接 ${config.provider} / ${config.model}。`
  })

  const output =
    config.provider === 'anthropic'
      ? await completeAnthropic(config, text)
      : await completeOpenAICompatible(config, text)

  emitEvent('artifact.snapshot', {
    kind: 'agent-result',
    title: '真实 Agent 结果',
    summary: output,
    content: output,
    model: config.model,
    provider: config.provider
  })
  emitEvent('turn.completed', {
    summary: '真实 Lime App Server Agent turn 已完成。'
  })
}

run().catch((error) => {
  emitFailure(error instanceof Error ? error.message : '真实 Agent backend 执行失败。')
})
