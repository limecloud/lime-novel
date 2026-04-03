import { app, dialog } from 'electron'
import { access } from 'node:fs/promises'
import {
  createApplyProjectStrategyProposalUseCase,
  createApplyProposalUseCase,
  createCommitCanonCardUseCase,
  createCreateProjectWorkspaceUseCase,
  createCreateExportPackageUseCase,
  createGenerateKnowledgeAnswerUseCase,
  createImportAnalysisSampleUseCase,
  createLoadKnowledgeDocumentUseCase,
  createLoadChapterDocumentUseCase,
  createLoadWorkspaceShellUseCase,
  createRejectProposalUseCase,
  createSaveChapterDocumentUseCase,
  createSearchWorkspaceUseCase,
  createUndoRevisionRecordUseCase,
  createUpdateRevisionIssueUseCase,
  createUpdateWorkspaceContextUseCase
} from '@lime-novel/application'
import { createLocalAgentRuntime } from '@lime-novel/agent-runtime'
import { createFileSystemNovelRepository, createNovelProjectWorkspace } from '@lime-novel/infrastructure'
import { join } from 'node:path'
import { createWorkspaceStateStore } from './workspace-state'

export const createDesktopServices = async () => {
  const projectsRoot = join(app.getPath('documents'), 'Lime Novel Projects')
  const workspaceStateStore = createWorkspaceStateStore(app.getPath('userData'), projectsRoot)
  let repository = createFileSystemNovelRepository(await workspaceStateStore.resolveInitialWorkspace())
  const agentRuntime = createLocalAgentRuntime(() => repository)

  const switchWorkspace = async (workspacePath: string) => {
    await access(join(workspacePath, 'novel.json'))
    repository = createFileSystemNovelRepository(workspacePath)
    await workspaceStateStore.rememberWorkspace(workspacePath)
    const shell = await repository.loadWorkspaceShell()

    return {
      workspacePath: shell.workspacePath,
      projectId: shell.project.projectId,
      title: shell.project.title
    }
  }

  return {
    agentRuntime,
    loadWorkspaceShell: () => createLoadWorkspaceShellUseCase(repository)(),
    searchWorkspace: (input: Parameters<ReturnType<typeof createSearchWorkspaceUseCase>>[0]) =>
      createSearchWorkspaceUseCase(repository)(input),
    loadKnowledgeDocument: (relativePath: string) => createLoadKnowledgeDocumentUseCase(repository)(relativePath),
    generateKnowledgeAnswer: (input: Parameters<ReturnType<typeof createGenerateKnowledgeAnswerUseCase>>[0]) =>
      createGenerateKnowledgeAnswerUseCase(repository)(input),
    updateWorkspaceContext: (input: Parameters<ReturnType<typeof createUpdateWorkspaceContextUseCase>>[0]) =>
      createUpdateWorkspaceContextUseCase(repository)(input),
    createProject: async (input: Parameters<ReturnType<typeof createCreateProjectWorkspaceUseCase>>[0]) => {
      const project = await createCreateProjectWorkspaceUseCase({
        createProject: (payload) => createNovelProjectWorkspace(projectsRoot, payload)
      })(input)

      await switchWorkspace(project.workspacePath)

      return project
    },
    openProjectDialog: async () => {
      const result = await dialog.showOpenDialog({
        title: '打开小说项目',
        properties: ['openDirectory'],
        buttonLabel: '打开项目目录'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      try {
        return await switchWorkspace(result.filePaths[0])
      } catch {
        await dialog.showMessageBox({
          type: 'error',
          title: '无法打开项目',
          message: '所选目录不是有效的 Lime Novel 项目。',
          detail: '请确认目录下包含 novel.json 配置文件。'
        })

        return null
      }
    },
    loadChapterDocument: (chapterId: string) => createLoadChapterDocumentUseCase(repository)(chapterId),
    saveChapterDocument: (input: Parameters<ReturnType<typeof createSaveChapterDocumentUseCase>>[0]) =>
      createSaveChapterDocumentUseCase(repository)(input),
    applyProposal: (proposalId: string) => createApplyProposalUseCase(repository)(proposalId),
    rejectProposal: (proposalId: string) => createRejectProposalUseCase(repository)(proposalId),
    importAnalysisSample: async () => {
      const result = await dialog.showOpenDialog({
        title: '导入拆书样本',
        properties: ['openFile'],
        buttonLabel: '导入样本文件',
        filters: [
          {
            name: '文本文件',
            extensions: ['txt', 'md', 'markdown']
          }
        ]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return createImportAnalysisSampleUseCase(repository)({
        filePath: result.filePaths[0]
      })
    },
    applyProjectStrategyProposal: (
      input: Parameters<ReturnType<typeof createApplyProjectStrategyProposalUseCase>>[0]
    ) => createApplyProjectStrategyProposalUseCase(repository)(input),
    commitCanonCard: (input: Parameters<ReturnType<typeof createCommitCanonCardUseCase>>[0]) =>
      createCommitCanonCardUseCase(repository)(input),
    updateRevisionIssue: (input: Parameters<ReturnType<typeof createUpdateRevisionIssueUseCase>>[0]) =>
      createUpdateRevisionIssueUseCase(repository)(input),
    undoRevisionRecord: (recordId: string) => createUndoRevisionRecordUseCase(repository)(recordId),
    createExportPackage: (input: Parameters<ReturnType<typeof createCreateExportPackageUseCase>>[0]) =>
      createCreateExportPackageUseCase(repository)(input),
    startAgentTask: (input: Parameters<typeof agentRuntime.startTask>[0]) => agentRuntime.startTask(input),
    loadAgentTaskDiagnostics: () => agentRuntime.loadTaskDiagnostics()
  }
}

export type DesktopServices = Awaited<ReturnType<typeof createDesktopServices>>
