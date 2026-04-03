import type { KnowledgeDocumentDto, KnowledgeSummaryDto } from '@lime-novel/application'

export type KnowledgeBucketFilterId = 'all' | KnowledgeDocumentDto['bucket']

const knowledgeStatusTone: Record<KnowledgeDocumentDto['status'], 'muted' | 'active' | 'warning' | 'critical'> = {
  reference: 'muted',
  candidate: 'muted',
  confirmed: 'active',
  conflicted: 'critical',
  stale: 'warning',
  generated: 'active'
}

export const knowledgeBucketLabel: Record<KnowledgeDocumentDto['bucket'], string> = {
  raw: '原始素材',
  compiled: '知识页',
  canon: '正式设定',
  output: '查询产物'
}

export const knowledgeStatusLabel: Record<KnowledgeDocumentDto['status'], string> = {
  reference: '资料',
  candidate: '候选',
  confirmed: '确认',
  conflicted: '冲突',
  stale: '待刷新',
  generated: '已生成'
}

export const knowledgeBucketDefinitions: Array<{
  id: KnowledgeBucketFilterId
  label: string
  match: (document: KnowledgeDocumentDto) => boolean
}> = [
  {
    id: 'all',
    label: '全部',
    match: () => true
  },
  {
    id: 'compiled',
    label: '知识页',
    match: (document) => document.bucket === 'compiled'
  },
  {
    id: 'canon',
    label: '正式设定',
    match: (document) => document.bucket === 'canon'
  },
  {
    id: 'output',
    label: '查询产物',
    match: (document) => document.bucket === 'output'
  },
  {
    id: 'raw',
    label: '原始素材',
    match: (document) => document.bucket === 'raw'
  }
]

export const buildKnowledgeHealthLabel = (summary: KnowledgeSummaryDto): string => {
  const denominator = Math.max(1, summary.totalDocuments)
  const stableScore = Math.max(
    0,
    Math.min(100, Math.round(((denominator - summary.conflictedDocuments - summary.staleDocuments) / denominator) * 100))
  )

  return `${stableScore}%`
}

export const resolveKnowledgeStatusChipClass = (status: KnowledgeDocumentDto['status']): string => {
  if (knowledgeStatusTone[status] === 'critical') {
    return 'severity-badge severity-badge--high'
  }

  if (knowledgeStatusTone[status] === 'warning') {
    return 'severity-badge severity-badge--medium'
  }

  return knowledgeStatusTone[status] === 'active' ? 'status-chip' : 'status-chip status-chip--muted'
}
