import type { AgentFeedItemDto, RevisionIssueDto, RevisionRecordDto } from '@lime-novel/application'

export const issueSeverityLabel: Record<RevisionIssueDto['severity'], string> = {
  low: '低优先',
  medium: '中优先',
  high: '高优先'
}

export const issueSeverityTone: Record<RevisionIssueDto['severity'], string> = {
  low: 'low',
  medium: 'medium',
  high: 'high'
}

export const buildIssueEvidence = (issue: RevisionIssueDto): string[] => {
  if (issue.title.includes('视角')) {
    return [
      '第 5 章：林清远第一次听见钟声时会出现耳鸣和短暂停顿。',
      '第 8 章：她在高处会先摸口袋里的旧硬币稳定情绪。',
      '因此当前段落至少应补一层身体反应或压抑反应。'
    ]
  }

  if (issue.title.includes('节奏')) {
    return [
      '第 12 章前两段已经完成环境铺垫，再往后应更快落到动作。',
      '相邻章节的悬念推进更依赖“选择发生”而不是继续解释。',
      '建议压缩环境句，并把动作落点提前到门锁和旧铜味。'
    ]
  }

  return [
    '当前问题已命中跨章事实冲突，需要先锁定章节顺序和时间标记。',
    '建议先以最小修订消除冲突，再决定是否扩大改动范围。',
    '所有修订都应保留证据片段，避免后续再次回滚。'
  ]
}

export const buildRevisionPlans = (issue: RevisionIssueDto): string[] => {
  if (issue.title.includes('视角')) {
    return [
      '方案 A：补耳鸣与握拳动作，改动最小、人物气质最稳。',
      '方案 B：补一小段旧钟声回忆，解释更强但节奏更慢。'
    ]
  }

  if (issue.title.includes('节奏')) {
    return [
      '方案 A：压缩环境句并提前门锁动作，优先保悬念推进。',
      '方案 B：把心理描写拆进后两段，让节奏更平缓。'
    ]
  }

  return [
    '方案 A：只修正冲突事实，确保改动范围局限在当前章。',
    '方案 B：顺带调整相邻章节表述，换取更完整的一致性。'
  ]
}

export const selectPendingRevisionProposal = (
  feed: AgentFeedItemDto[],
  issue?: RevisionIssueDto
): AgentFeedItemDto | undefined =>
  feed.find(
    (item) =>
      item.kind === 'proposal' &&
      Boolean(item.proposalId) &&
      item.linkedIssueId === issue?.issueId &&
      item.approvalStatus === 'pending'
  ) ??
  feed.find(
    (item) =>
      item.kind === 'proposal' &&
      Boolean(item.proposalId) &&
      item.approvalStatus === 'pending'
  )

export const sortVisibleRevisionRecords = (
  revisionRecords: RevisionRecordDto[],
  issue?: RevisionIssueDto
): RevisionRecordDto[] =>
  [...revisionRecords].sort((left, right) => {
    const score = (item: RevisionRecordDto): number => {
      if (item.linkedIssueId && item.linkedIssueId === issue?.issueId) {
        return 0
      }

      if (item.chapterId === issue?.chapterId) {
        return 1
      }

      return 2
    }

    return score(left) - score(right)
  })
