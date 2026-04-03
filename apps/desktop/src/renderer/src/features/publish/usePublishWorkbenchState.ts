import { useEffect, useState } from 'react'
import type { AgentFeedItemDto, WorkspaceShellDto } from '@lime-novel/application'
import {
  buildDefaultPublishNotes,
  buildDefaultPublishSynopsis,
  isPublishConfirmSuggestionItem,
  isPublishNotesDraftItem,
  isPublishSynopsisDraftItem,
  suggestNextPublishVersion
} from './publish-model'

export type PublishWorkbenchState = {
  selectedPresetId?: string
  selectedPreset?: WorkspaceShellDto['exportPresets'][number]
  synopsis: string
  synopsisDraft?: AgentFeedItemDto
  notesDraft?: AgentFeedItemDto
  confirmSuggestion?: AgentFeedItemDto
  versionTag: string
  notes: string
  exportSplit: string
  isConfirmOpen: boolean
  onSelectPreset: (presetId: string) => void
  onSynopsisChange: (value: string) => void
  onApplySynopsisDraft: (value: string) => void
  onVersionTagChange: (value: string) => void
  onNotesChange: (value: string) => void
  onApplyNotesDraft: (value: string) => void
  onExportSplitChange: (value: string) => void
  onConfirmOpenChange: (open: boolean) => void
  onOpenConfirm: () => void
}

export const usePublishWorkbenchState = (
  shell: WorkspaceShellDto,
  feed: AgentFeedItemDto[]
): PublishWorkbenchState => {
  const [selectedPresetId, setSelectedPresetId] = useState(shell.exportPresets[0]?.presetId)
  const [isConfirmOpen, setConfirmOpen] = useState(false)
  const [synopsis, setSynopsis] = useState(buildDefaultPublishSynopsis(shell))
  const [exportSplit, setExportSplit] = useState('3')
  const [versionTag, setVersionTag] = useState(suggestNextPublishVersion(shell))
  const [notes, setNotes] = useState(buildDefaultPublishNotes(shell))

  useEffect(() => {
    if (!shell.exportPresets.some((preset) => preset.presetId === selectedPresetId)) {
      setSelectedPresetId(shell.exportPresets[0]?.presetId)
    }
  }, [selectedPresetId, shell.exportPresets])

  useEffect(() => {
    setSynopsis(buildDefaultPublishSynopsis(shell))
  }, [shell.project.title, shell.workspacePath])

  useEffect(() => {
    setVersionTag(suggestNextPublishVersion(shell))
    setNotes(buildDefaultPublishNotes(shell))
  }, [shell.project.title, shell.workspacePath, shell.recentExports[0]?.exportId])

  useEffect(() => {
    setConfirmOpen(false)
  }, [shell.workspacePath, shell.recentExports[0]?.exportId])

  return {
    selectedPresetId,
    selectedPreset: shell.exportPresets.find((preset) => preset.presetId === selectedPresetId) ?? shell.exportPresets[0],
    synopsis,
    synopsisDraft: feed.find(isPublishSynopsisDraftItem),
    notesDraft: feed.find(isPublishNotesDraftItem),
    confirmSuggestion: feed.find(isPublishConfirmSuggestionItem),
    versionTag,
    notes,
    exportSplit,
    isConfirmOpen,
    onSelectPreset: setSelectedPresetId,
    onSynopsisChange: setSynopsis,
    onApplySynopsisDraft: setSynopsis,
    onVersionTagChange: setVersionTag,
    onNotesChange: setNotes,
    onApplyNotesDraft: setNotes,
    onExportSplitChange: setExportSplit,
    onConfirmOpenChange: setConfirmOpen,
    onOpenConfirm: () => setConfirmOpen(true)
  }
}
