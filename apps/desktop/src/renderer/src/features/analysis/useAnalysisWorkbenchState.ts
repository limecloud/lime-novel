import { useEffect, useState } from 'react'
import type { WorkspaceShellDto } from '@lime-novel/application'

export type AnalysisWorkbenchState = {
  selectedSampleId?: string
  selectedSample?: WorkspaceShellDto['analysisSamples'][number]
  onSelectSample: (sampleId: string) => void
}

export const useAnalysisWorkbenchState = (shell: WorkspaceShellDto): AnalysisWorkbenchState => {
  const [selectedSampleId, setSelectedSampleId] = useState(shell.analysisSamples[0]?.sampleId)

  useEffect(() => {
    if (!shell.analysisSamples.some((sample) => sample.sampleId === selectedSampleId)) {
      setSelectedSampleId(shell.analysisSamples[0]?.sampleId)
    }
  }, [selectedSampleId, shell.analysisSamples])

  return {
    selectedSampleId,
    selectedSample: shell.analysisSamples.find((sample) => sample.sampleId === selectedSampleId) ?? shell.analysisSamples[0],
    onSelectSample: setSelectedSampleId
  }
}
