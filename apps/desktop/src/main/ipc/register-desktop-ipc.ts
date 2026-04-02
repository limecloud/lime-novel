import { ipcMain, type BrowserWindow } from 'electron'
import type {
  CommitCanonCardInputDto,
  CreateProjectInputDto,
  CreateExportPackageInputDto,
  SaveChapterInputDto,
  StartTaskInputDto,
  UpdateRevisionIssueInputDto,
  UpdateWorkspaceContextInputDto
} from '@lime-novel/application'
import type { DesktopServices } from '../composition-root/create-desktop-services'
import { CHANNELS } from './channels'

const removeHandler = (channel: string): void => {
  try {
    ipcMain.removeHandler(channel)
  } catch {
    // Electron 在首次注册前会抛错，这里可以安全忽略。
  }
}

export const registerDesktopIpc = (mainWindow: BrowserWindow, services: DesktopServices): (() => void) => {
  removeHandler(CHANNELS.workspace.loadShell)
  removeHandler(CHANNELS.workspace.updateContext)
  removeHandler(CHANNELS.workspace.createProject)
  removeHandler(CHANNELS.workspace.openProjectDialog)
  removeHandler(CHANNELS.chapter.loadDocument)
  removeHandler(CHANNELS.chapter.saveDocument)
  removeHandler(CHANNELS.chapter.applyProposal)
  removeHandler(CHANNELS.canon.commitCard)
  removeHandler(CHANNELS.revision.updateIssue)
  removeHandler(CHANNELS.publish.createExportPackage)
  removeHandler(CHANNELS.agent.startTask)

  ipcMain.handle(CHANNELS.workspace.loadShell, async () => services.loadWorkspaceShell())
  ipcMain.handle(CHANNELS.workspace.updateContext, async (_event, input: UpdateWorkspaceContextInputDto) =>
    services.updateWorkspaceContext(input)
  )
  ipcMain.handle(CHANNELS.workspace.createProject, async (_event, input: CreateProjectInputDto) =>
    services.createProject(input)
  )
  ipcMain.handle(CHANNELS.workspace.openProjectDialog, async () => services.openProjectDialog())
  ipcMain.handle(CHANNELS.chapter.loadDocument, async (_event, chapterId: string) =>
    services.loadChapterDocument(chapterId)
  )
  ipcMain.handle(CHANNELS.chapter.saveDocument, async (_event, input: SaveChapterInputDto) =>
    services.saveChapterDocument(input)
  )
  ipcMain.handle(CHANNELS.chapter.applyProposal, async (_event, proposalId: string) =>
    services.applyProposal(proposalId)
  )
  ipcMain.handle(CHANNELS.canon.commitCard, async (_event, input: CommitCanonCardInputDto) =>
    services.commitCanonCard(input)
  )
  ipcMain.handle(CHANNELS.revision.updateIssue, async (_event, input: UpdateRevisionIssueInputDto) =>
    services.updateRevisionIssue(input)
  )
  ipcMain.handle(CHANNELS.publish.createExportPackage, async (_event, input: CreateExportPackageInputDto) =>
    services.createExportPackage(input)
  )
  ipcMain.handle(CHANNELS.agent.startTask, async (_event, input: StartTaskInputDto) =>
    services.startAgentTask(input)
  )

  const unsubscribe = services.agentRuntime.subscribe((event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(CHANNELS.agent.taskEvent, event)
    }
  })

  return unsubscribe
}
