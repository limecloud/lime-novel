import { useEffect, useState } from 'react'
import type { AgentFeedItemDto, WorkspaceShellDto } from '@lime-novel/application'
import { selectPendingRevisionProposal, sortVisibleRevisionRecords } from './revision-model'

export type RevisionWorkbenchState = {
  selectedIssueId?: string
  selectedIssue?: WorkspaceShellDto['revisionIssues'][number]
  selectedProposal?: AgentFeedItemDto
  visibleRevisionRecords: WorkspaceShellDto['revisionRecords']
  onSelectIssue: (issueId: string) => void
}

export const useRevisionWorkbenchState = (
  shell: WorkspaceShellDto,
  feed: AgentFeedItemDto[]
): RevisionWorkbenchState => {
  const [selectedIssueId, setSelectedIssueId] = useState(shell.revisionIssues[0]?.issueId)

  useEffect(() => {
    if (!shell.revisionIssues.some((issue) => issue.issueId === selectedIssueId)) {
      setSelectedIssueId(shell.revisionIssues[0]?.issueId)
    }
  }, [selectedIssueId, shell.revisionIssues])

  const selectedIssue =
    shell.revisionIssues.find((issue) => issue.issueId === selectedIssueId) ?? shell.revisionIssues[0]

  return {
    selectedIssueId,
    selectedIssue,
    selectedProposal: selectPendingRevisionProposal(feed, selectedIssue),
    visibleRevisionRecords: sortVisibleRevisionRecords(shell.revisionRecords, selectedIssue),
    onSelectIssue: setSelectedIssueId
  }
}
