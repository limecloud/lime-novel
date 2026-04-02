import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApiContract, TaskEventDto } from '@lime-novel/application'
import { CHANNELS } from '../main/ipc/channels'

const api: DesktopApiContract = {
  workspace: {
    loadShell: () => ipcRenderer.invoke(CHANNELS.workspace.loadShell),
    searchWorkspace: (input) => ipcRenderer.invoke(CHANNELS.workspace.searchWorkspace, input),
    updateContext: (input) => ipcRenderer.invoke(CHANNELS.workspace.updateContext, input),
    createProject: (input) => ipcRenderer.invoke(CHANNELS.workspace.createProject, input),
    openProjectDialog: () => ipcRenderer.invoke(CHANNELS.workspace.openProjectDialog)
  },
  chapter: {
    loadDocument: (chapterId: string) => ipcRenderer.invoke(CHANNELS.chapter.loadDocument, chapterId),
    saveDocument: (input) => ipcRenderer.invoke(CHANNELS.chapter.saveDocument, input),
    applyProposal: (proposalId: string) => ipcRenderer.invoke(CHANNELS.chapter.applyProposal, proposalId),
    rejectProposal: (proposalId: string) => ipcRenderer.invoke(CHANNELS.chapter.rejectProposal, proposalId)
  },
  analysis: {
    importSample: () => ipcRenderer.invoke(CHANNELS.analysis.importSample),
    applyStrategyProposal: (input) => ipcRenderer.invoke(CHANNELS.analysis.applyStrategyProposal, input)
  },
  canon: {
    commitCard: (input) => ipcRenderer.invoke(CHANNELS.canon.commitCard, input)
  },
  revision: {
    updateIssue: (input) => ipcRenderer.invoke(CHANNELS.revision.updateIssue, input),
    undoRecord: (recordId: string) => ipcRenderer.invoke(CHANNELS.revision.undoRecord, recordId)
  },
  publish: {
    createExportPackage: (input) => ipcRenderer.invoke(CHANNELS.publish.createExportPackage, input)
  },
  agent: {
    startTask: (input) => ipcRenderer.invoke(CHANNELS.agent.startTask, input),
    subscribeTaskEvents: (callback: (event: TaskEventDto) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: TaskEventDto) => {
        callback(payload)
      }

      ipcRenderer.on(CHANNELS.agent.taskEvent, listener)

      return () => {
        ipcRenderer.removeListener(CHANNELS.agent.taskEvent, listener)
      }
    }
  }
}

contextBridge.exposeInMainWorld('limeNovel', api)
