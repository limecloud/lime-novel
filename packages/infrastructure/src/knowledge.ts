import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative } from 'node:path'
import type {
  GenerateKnowledgeAnswerInputDto,
  KnowledgeDocumentDetailDto,
  KnowledgeDocumentDto,
  KnowledgeSummaryDto
} from '@lime-novel/application'

type ParsedFrontmatter = {
  attributes: Record<string, string | string[]>
  body: string
}

type KnowledgeScaffoldSceneConfig = {
  order: number
  title: string
  goal: string
}

type KnowledgeScaffoldChapterConfig = {
  chapterId: string
  file: string
  order: number
  title: string
  summary: string
  wordCount?: number
  objective: string
  lastEditedAt?: string
  scenes: KnowledgeScaffoldSceneConfig[]
}

type KnowledgeScaffoldProjectConfig = {
  projectId: string
  title: string
  subtitle: string
  status: string
  genre: string
  premise: string
  currentChapterId: string
  currentSurface: string
  chapters: KnowledgeScaffoldChapterConfig[]
  quickActions: Array<{
    label: string
  }>
}

const KNOWLEDGE_ALLOWED_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

const normalizeWorkspaceRelativePath = (workspaceRoot: string, filePath: string): string =>
  relative(workspaceRoot, filePath).replace(/\\/g, '/')

export const createKnowledgeDocumentId = (relativePath: string): string =>
  `knowledge-${relativePath.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')}`

const normalizeFrontmatterValue = (value: string): string => value.trim().replace(/^['"]|['"]$/g, '')

const toFrontmatterScalar = (value: string): string =>
  JSON.stringify(value.replace(/\r?\n/g, ' ').trim())

const sanitizeKnowledgeFileSegment = (value: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized || 'knowledge-document'
}

const parseFrontmatter = (content: string): ParsedFrontmatter => {
  const normalized = content.replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    return {
      attributes: {},
      body: normalized.trim()
    }
  }

  const closingIndex = normalized.indexOf('\n---\n', 4)

  if (closingIndex < 0) {
    return {
      attributes: {},
      body: normalized.trim()
    }
  }

  const rawFrontmatter = normalized.slice(4, closingIndex)
  const attributes: Record<string, string | string[]> = {}
  let activeListKey: string | null = null

  for (const line of rawFrontmatter.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    const listMatch = /^-\s+(.+)$/.exec(trimmed)

    if (listMatch && activeListKey) {
      const nextValue = normalizeFrontmatterValue(listMatch[1] ?? '')
      const currentValue = attributes[activeListKey]
      attributes[activeListKey] = Array.isArray(currentValue)
        ? [...currentValue, nextValue]
        : [nextValue]
      continue
    }

    const keyMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)

    if (!keyMatch) {
      activeListKey = null
      continue
    }

    const [, key, value] = keyMatch
    const normalizedValue = normalizeFrontmatterValue(value ?? '')

    if (normalizedValue) {
      attributes[key] = normalizedValue
      activeListKey = null
      continue
    }

    attributes[key] = []
    activeListKey = key
  }

  return {
    attributes,
    body: normalized.slice(closingIndex + 5).trim()
  }
}

const ensureFrontmatterArray = (value?: string | string[]): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean)
  }

  if (!value?.trim()) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const stripMarkdownSyntax = (value: string): string =>
  value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\r/g, '')
    .trim()

const createNarrativePreview = (value: string, fallbackLength = 84): string => {
  const normalized = value.replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return '当前还没有可预览的内容。'
  }

  return normalized.length <= fallbackLength ? normalized : `${normalized.slice(0, fallbackLength)}...`
}

export const createKnowledgeExcerpt = (value: string, fallbackLength = 84): string =>
  createNarrativePreview(stripMarkdownSyntax(value), fallbackLength)

const extractHeadingTitle = (content: string): string | undefined => {
  const match = content.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim()
}

const humanizeFileBasename = (filePath: string): string =>
  basename(filePath, extname(filePath))
    .replace(/[-_]+/g, ' ')
    .trim()

const extractMarkdownHintValue = (content: string, label: string): string | undefined => {
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${label}：\\s*(.+)$`, 'm')
  const match = content.match(pattern)
  return match?.[1]?.trim()
}

const inferKnowledgeBucket = (relativePath: string): KnowledgeDocumentDto['bucket'] => {
  const topLevel = relativePath.split('/')[0]

  if (topLevel === 'raw') {
    return 'raw'
  }

  if (topLevel === 'compiled') {
    return 'compiled'
  }

  if (topLevel === 'canon') {
    return 'canon'
  }

  return 'output'
}

const inferKnowledgeKind = (bucket: KnowledgeDocumentDto['bucket']): KnowledgeDocumentDto['kind'] => {
  if (bucket === 'raw') {
    return 'source'
  }

  if (bucket === 'canon') {
    return 'canon-card'
  }

  if (bucket === 'output') {
    return 'query-output'
  }

  return 'knowledge-page'
}

const inferKnowledgeType = (relativePath: string, bucket: KnowledgeDocumentDto['bucket']): string => {
  const segments = relativePath.split('/')

  if (bucket === 'canon') {
    return segments[1] ?? 'canon'
  }

  if (bucket === 'raw') {
    return segments[1] ?? 'source'
  }

  if (bucket === 'output') {
    return segments[1] ?? 'answer'
  }

  return segments[1] ?? 'knowledge-page'
}

const inferKnowledgeStatus = (
  bucket: KnowledgeDocumentDto['bucket'],
  rawStatus?: string
): KnowledgeDocumentDto['status'] => {
  const normalized = rawStatus?.trim()

  if (
    normalized === 'reference' ||
    normalized === 'candidate' ||
    normalized === 'confirmed' ||
    normalized === 'conflicted' ||
    normalized === 'stale' ||
    normalized === 'generated'
  ) {
    return normalized
  }

  if (bucket === 'raw') {
    return 'reference'
  }

  if (bucket === 'canon') {
    return 'confirmed'
  }

  if (bucket === 'output') {
    return 'generated'
  }

  return 'candidate'
}

const extractKnowledgeSummary = (body: string): string => {
  const hintSummary = extractMarkdownHintValue(body, '摘要')

  if (hintSummary) {
    return hintSummary
  }

  const normalized = stripMarkdownSyntax(body).replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return '当前知识页还没有补充更多内容。'
  }

  return normalized.length <= 88 ? normalized : `${normalized.slice(0, 88)}...`
}

const extractBodyParagraphs = (content: string): string[] =>
  content
    .trimEnd()
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !segment.startsWith('#'))

const listKnowledgeFiles = async (directory: string): Promise<string[]> => {
  if (!existsSync(directory)) {
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name)

      if (entry.isDirectory()) {
        return listKnowledgeFiles(entryPath)
      }

      if (entry.name === '.gitkeep' || !KNOWLEDGE_ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        return []
      }

      return [entryPath]
    })
  )

  return files.flat()
}

export const readKnowledgeDocumentDetail = async (
  workspaceRoot: string,
  relativePath: string
): Promise<KnowledgeDocumentDetailDto> => {
  const outputPath = join(workspaceRoot, relativePath)
  const rawContent = await readFile(outputPath, 'utf8')
  const parsed = parseFrontmatter(rawContent)
  const fileStats = await stat(outputPath)
  const bucket = inferKnowledgeBucket(relativePath)
  const type = typeof parsed.attributes.type === 'string' ? parsed.attributes.type : inferKnowledgeType(relativePath, bucket)
  const title =
    typeof parsed.attributes.title === 'string'
      ? parsed.attributes.title
      : extractHeadingTitle(parsed.body) ?? humanizeFileBasename(relativePath)
  const summary =
    typeof parsed.attributes.summary === 'string' ? parsed.attributes.summary : extractKnowledgeSummary(parsed.body)
  const sources = ensureFrontmatterArray(parsed.attributes.sources)
  const related = ensureFrontmatterArray(parsed.attributes.related)
  const excerpt = createKnowledgeExcerpt(parsed.body, 180)

  return {
    documentId:
      typeof parsed.attributes.id === 'string' ? parsed.attributes.id : createKnowledgeDocumentId(relativePath),
    title,
    kind: inferKnowledgeKind(bucket),
    bucket,
    type,
    status: inferKnowledgeStatus(bucket, typeof parsed.attributes.status === 'string' ? parsed.attributes.status : undefined),
    summary,
    excerpt,
    content: parsed.body || rawContent.trim(),
    relativePath,
    updatedAt:
      typeof parsed.attributes.updatedAt === 'string'
        ? parsed.attributes.updatedAt
        : fileStats.mtime.toISOString(),
    sources,
    related,
    sourceCount: sources.length,
    relatedCount: related.length
  }
}

export const toKnowledgeMetadata = (detail: KnowledgeDocumentDetailDto): KnowledgeDocumentDto => ({
  documentId: detail.documentId,
  title: detail.title,
  kind: detail.kind,
  bucket: detail.bucket,
  type: detail.type,
  status: detail.status,
  summary: detail.summary,
  relativePath: detail.relativePath,
  updatedAt: detail.updatedAt,
  sourceCount: detail.sourceCount,
  relatedCount: detail.relatedCount
})

export const compareKnowledgeUpdatedAt = (left?: string, right?: string): number => {
  const leftValue = left ? Date.parse(left) : 0
  const rightValue = right ? Date.parse(right) : 0
  return rightValue - leftValue
}

export const loadKnowledgeDocuments = async (workspaceRoot: string): Promise<KnowledgeDocumentDetailDto[]> => {
  const filePaths = (
    await Promise.all(
      ['raw', 'compiled', 'canon', 'outputs'].map((directory) => listKnowledgeFiles(join(workspaceRoot, directory)))
    )
  ).flat()
  const documents = await Promise.all(
    filePaths.map(async (filePath) => readKnowledgeDocumentDetail(workspaceRoot, normalizeWorkspaceRelativePath(workspaceRoot, filePath)))
  )
  const bucketOrder: Record<KnowledgeDocumentDto['bucket'], number> = {
    compiled: 0,
    canon: 1,
    output: 2,
    raw: 3
  }

  return documents.sort((left, right) => {
    const bucketDiff = bucketOrder[left.bucket] - bucketOrder[right.bucket]

    if (bucketDiff !== 0) {
      return bucketDiff
    }

    const timeDiff = compareKnowledgeUpdatedAt(left.updatedAt, right.updatedAt)

    if (timeDiff !== 0) {
      return timeDiff
    }

    return left.title.localeCompare(right.title, 'zh-CN')
  })
}

export const buildKnowledgeSummary = (documents: KnowledgeDocumentDto[]): KnowledgeSummaryDto => {
  const outputDocuments = documents.filter((document) => document.bucket === 'output')
  const latestOutput = [...outputDocuments].sort((left, right) => compareKnowledgeUpdatedAt(left.updatedAt, right.updatedAt))[0]

  return {
    totalDocuments: documents.length,
    rawDocuments: documents.filter((document) => document.bucket === 'raw').length,
    compiledDocuments: documents.filter((document) => document.bucket === 'compiled').length,
    canonDocuments: documents.filter((document) => document.bucket === 'canon').length,
    outputDocuments: outputDocuments.length,
    conflictedDocuments: documents.filter((document) => document.status === 'conflicted').length,
    staleDocuments: documents.filter((document) => document.status === 'stale').length,
    lastGeneratedAt: latestOutput?.updatedAt
  }
}

const formatKnowledgeFrontmatterList = (values: string[]): string =>
  values.length > 0 ? `\n${values.map((item) => `  - ${item}`).join('\n')}` : ' []'

const buildKnowledgeProjectBrief = (config: KnowledgeScaffoldProjectConfig): string => `---
id: ${config.projectId}-project-brief
type: source
title: 项目简介
status: reference
summary: ${toFrontmatterScalar(config.premise)}
updatedAt: ${new Date().toISOString()}
---

# 项目简介

## 作品概览

- 标题：${config.title}
- 副标题：${config.subtitle}
- 题材：${config.genre}
- 当前阶段：${config.status}

## 核心 premise

${config.premise}

## 当前推进焦点

- 当前章节：${config.currentChapterId}
- 当前工作面：${config.currentSurface}
- 当前快捷动作：${config.quickActions.map((item) => item.label).join('、') || '等待补充'}
`

const buildChapterKnowledgePage = (
  config: KnowledgeScaffoldProjectConfig,
  chapter: KnowledgeScaffoldChapterConfig,
  content: string
): string => {
  const excerpt = extractBodyParagraphs(content).slice(0, 3)

  return `---
id: compiled-${chapter.chapterId}
type: chapter-brief
title: ${toFrontmatterScalar(`第 ${chapter.order} 章 · ${chapter.title}`)}
status: candidate
summary: ${toFrontmatterScalar(chapter.summary)}
sources:${formatKnowledgeFrontmatterList([chapter.file])}
related:${formatKnowledgeFrontmatterList(
    config.chapters
      .filter((item) => item.chapterId !== chapter.chapterId)
      .slice(Math.max(0, chapter.order - 2), chapter.order + 1)
      .map((item) => item.file)
  )}
updatedAt: ${new Date().toISOString()}
---

# 第 ${chapter.order} 章 · ${chapter.title}

## 章节摘要

${chapter.summary}

## 当前目标

${chapter.objective}

## 场景清单

${chapter.scenes.map((scene) => `- ${scene.order}. ${scene.title}：${scene.goal}`).join('\n') || '- 等待补充场景'}

## 正文摘录

${excerpt.length > 0 ? excerpt.map((paragraph) => paragraph.trim()).join('\n\n') : '正文还比较短，后续保存时会自动同步更完整的章节摘录。'}
`
}

export const syncKnowledgeScaffoldFiles = async (
  workspaceRoot: string,
  config: KnowledgeScaffoldProjectConfig,
  chapter: KnowledgeScaffoldChapterConfig,
  content: string
): Promise<void> => {
  await Promise.all(
    ['raw/notes', 'compiled/chapters', 'outputs/answers', 'outputs/briefs'].map((directory) =>
      mkdir(join(workspaceRoot, directory), { recursive: true })
    )
  )

  await Promise.all([
    writeFile(join(workspaceRoot, 'raw/notes/project-brief.md'), `${buildKnowledgeProjectBrief(config).trim()}\n`, 'utf8'),
    writeFile(
      join(
        workspaceRoot,
        'compiled/chapters',
        `${String(chapter.order).padStart(3, '0')}-${sanitizeKnowledgeFileSegment(chapter.title)}.md`
      ),
      `${buildChapterKnowledgePage(config, chapter, content).trim()}\n`,
      'utf8'
    )
  ])
}

export const buildKnowledgeAnswerContent = (input: {
  projectTitle: string
  question: string
  format: GenerateKnowledgeAnswerInputDto['format']
  documents: KnowledgeDocumentDetailDto[]
  generatedAt: string
}): string => {
  const summary =
    input.documents.length > 0
      ? `围绕“${input.question}”最相关的项目知识主要集中在 ${input.documents
          .slice(0, 3)
          .map((document) => `《${document.title}》`)
          .join('、')}。`
      : `当前项目里还没有足够命中的知识页来回答“${input.question}”，建议先补原始资料或章节摘要。`
  const followUps =
    input.documents.length > 0
      ? [
          `继续追问：${input.question} 对第 ${input.documents[0]?.title ?? '当前章节'} 的写作节奏意味着什么？`,
          '继续追问：哪些事实已经足够确认，哪些还应该保留为候选结论？'
        ]
      : ['继续追问：应该先补哪类 raw 资料或 compiled 摘要，才能让问题更可回答？']

  return `---
id: ${createKnowledgeDocumentId(`${input.generatedAt}-${input.question}-${input.format}`)}
type: query-output
title: ${toFrontmatterScalar(input.question)}
status: generated
summary: ${toFrontmatterScalar(summary)}
sources:${formatKnowledgeFrontmatterList(input.documents.map((document) => document.relativePath))}
related:${formatKnowledgeFrontmatterList(input.documents.flatMap((document) => document.related).slice(0, 8))}
updatedAt: ${input.generatedAt}
---

# ${input.question}

> 生成时间：${input.generatedAt}
> 输出格式：${input.format === 'brief' ? 'brief' : 'report'}
> 项目：${input.projectTitle}

## 结论摘要

${summary}

## 命中文档

${input.documents.length > 0 ? input.documents
    .map(
      (document, index) => `${index + 1}. **${document.title}**
   - 类型：${document.type} / ${document.bucket}
   - 状态：${document.status}
   - 路径：${document.relativePath}
   - 摘要：${document.summary}`
    )
    .join('\n') : '1. 当前没有命中文档，建议先补充 raw/compiled 资料。'}

## 证据摘录

${input.documents.length > 0
    ? input.documents
        .slice(0, input.format === 'brief' ? 2 : 4)
        .map((document) => `### ${document.title}\n\n${document.excerpt}`)
        .join('\n\n')
    : '当前没有足够证据摘录。'}

## 下一步建议

${followUps.map((item) => `- ${item}`).join('\n')}
`
}
