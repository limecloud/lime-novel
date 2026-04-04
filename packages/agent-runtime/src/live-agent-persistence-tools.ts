import type {
  CanonCandidateDto,
  RevisionIssueDto
} from '@lime-novel/application'
import { createId } from '@lime-novel/shared-kernel'
import {
  saveRuntimeCanonCandidate,
  saveRuntimeGeneratedProposal,
  saveRuntimeRevisionIssue
} from './agent-runtime-repository'
import {
  expectObject,
  objectSchema,
  readOptionalString,
  readRequiredString,
  stringSchema
} from './live-agent-tool-schema'
import type { AgentTool, AgentToolContext } from './live-agent-types'

export const createLivePersistenceTools = (
  context: AgentToolContext
)=>
  [
  {
    name: 'save_proposal_draft',
    description:
      '把一版可应用的正文提议保存到提议仓储，并返回 proposalId，供最终结果引用。',
    inputSchema: objectSchema(
      {
        content: stringSchema('提议后的完整正文内容。'),
        chapterId: stringSchema('可选。目标章节 ID。'),
        linkedIssueId: stringSchema(
          '可选。若这版提议属于某个修订问题，请传对应 issueId。'
        )
      },
      ['content']
    ),
    parse: (input) => {
      const value = expectObject(input, 'save_proposal_draft')
      return {
        content: readRequiredString(value, 'content'),
        chapterId: readOptionalString(value, 'chapterId'),
        linkedIssueId: readOptionalString(value, 'linkedIssueId')
      }
    },
    execute: async (input: {
      content: string
      chapterId?: string
      linkedIssueId?: string
    }) => {
      const proposalId = createId('proposal')

      return saveRuntimeGeneratedProposal({
        repository: context.repository,
        proposalId,
        currentChapterId: context.shell.project.currentChapterId,
        chapterId: input.chapterId ?? context.input.chapterId,
        fullContent: input.content,
        sourceSurface: context.input.surface,
        sourceIntent: context.input.intent,
        linkedIssueId: input.linkedIssueId
      })
    },
    isConcurrencySafe: () => false,
    getProgressLabel: () => '保存正文提议草案'
  },
  {
    name: 'upsert_canon_candidate',
    description: '写入或更新一张候选设定卡。',
    inputSchema: objectSchema(
      {
        cardId: stringSchema('可选。已有卡片 ID。为空则自动创建。'),
        name: stringSchema('设定卡名称。'),
        kind: stringSchema(
          '卡片类型，如 character/location/rule/item/timeline-event。'
        ),
        summary: stringSchema('设定摘要。'),
        visibility: stringSchema(
          'candidate、confirmed 或 archived。',
          ['candidate', 'confirmed', 'archived']
        ),
        evidence: stringSchema('证据片段或来源说明。')
      },
      ['name', 'kind', 'summary', 'visibility', 'evidence']
    ),
    parse: (input) => {
      const value = expectObject(input, 'upsert_canon_candidate')
      return {
        cardId: readOptionalString(value, 'cardId') ?? createId('canon'),
        name: readRequiredString(value, 'name'),
        kind: readRequiredString(value, 'kind'),
        summary: readRequiredString(value, 'summary'),
        visibility: readRequiredString(value, 'visibility') as
          | 'candidate'
          | 'confirmed'
          | 'archived',
        evidence: readRequiredString(value, 'evidence')
      }
    },
    execute: async (input: CanonCandidateDto) => {
      await saveRuntimeCanonCandidate(context.repository, input)
      return {
        cardId: input.cardId,
        visibility: input.visibility
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: (input: CanonCandidateDto) => `写入设定卡：${input.name}`
  },
  {
    name: 'upsert_revision_issue',
    description: '写入或更新一个修订问题，让问题队列可见。',
    inputSchema: objectSchema(
      {
        issueId: stringSchema('可选。已有 issueId。为空则自动创建。'),
        chapterId: stringSchema('可选。目标章节 ID，不传时默认当前章节。'),
        title: stringSchema('问题标题。'),
        summary: stringSchema('问题摘要。'),
        severity: stringSchema('low、medium 或 high。', [
          'low',
          'medium',
          'high'
        ]),
        status: stringSchema('open、deferred 或 resolved。', [
          'open',
          'deferred',
          'resolved'
        ])
      },
      ['title', 'summary', 'severity', 'status']
    ),
    parse: (input) => {
      const value = expectObject(input, 'upsert_revision_issue')
      return {
        issueId: readOptionalString(value, 'issueId') ?? createId('issue'),
        chapterId:
          readOptionalString(value, 'chapterId') ??
          context.input.chapterId ??
          context.shell.project.currentChapterId,
        title: readRequiredString(value, 'title'),
        summary: readRequiredString(value, 'summary'),
        severity: readRequiredString(value, 'severity') as
          | 'low'
          | 'medium'
          | 'high',
        status: readRequiredString(value, 'status') as
          | 'open'
          | 'deferred'
          | 'resolved'
      }
    },
    execute: async (input: RevisionIssueDto) => {
      await saveRuntimeRevisionIssue(context.repository, input)
      return {
        issueId: input.issueId,
        chapterId: input.chapterId,
        status: input.status
      }
    },
    isConcurrencySafe: () => false,
    getProgressLabel: (input: RevisionIssueDto) => `写入修订问题：${input.title}`
  }
] as AgentTool<unknown, unknown>[]
