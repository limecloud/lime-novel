import { app, dialog } from 'electron'
import { access } from 'node:fs/promises'
import {
  createApplyProposalUseCase,
  createCommitCanonCardUseCase,
  createCreateProjectWorkspaceUseCase,
  createCreateExportPackageUseCase,
  createLoadChapterDocumentUseCase,
  createLoadWorkspaceShellUseCase,
  createSaveChapterDocumentUseCase,
  createStartAgentTaskUseCase,
  createUpdateRevisionIssueUseCase,
  createUpdateWorkspaceContextUseCase
} from '@lime-novel/application'
import { createMockAgentRuntime } from '@lime-novel/agent-runtime'
import { createFileSystemNovelRepository, createNovelProjectWorkspace } from '@lime-novel/infrastructure'
import { join, resolve } from 'node:path'

export const createDesktopServices = () => {
  let repository = createFileSystemNovelRepository(resolve(process.cwd(), 'playground/demo-project'))
  const agentRuntime = createMockAgentRuntime()

  const switchWorkspace = async (workspacePath: string) => {
    await access(resolve(workspacePath, 'novel.json'))
    repository = createFileSystemNovelRepository(workspacePath)
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
    updateWorkspaceContext: (input: Parameters<ReturnType<typeof createUpdateWorkspaceContextUseCase>>[0]) =>
      createUpdateWorkspaceContextUseCase(repository)(input),
    createProject: async (input: Parameters<ReturnType<typeof createCreateProjectWorkspaceUseCase>>[0]) => {
      const projectsRoot = join(app.getPath('documents'), 'Lime Novel Projects')
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
    commitCanonCard: (input: Parameters<ReturnType<typeof createCommitCanonCardUseCase>>[0]) =>
      createCommitCanonCardUseCase(repository)(input),
    updateRevisionIssue: (input: Parameters<ReturnType<typeof createUpdateRevisionIssueUseCase>>[0]) =>
      createUpdateRevisionIssueUseCase(repository)(input),
    createExportPackage: (input: Parameters<ReturnType<typeof createCreateExportPackageUseCase>>[0]) =>
      createCreateExportPackageUseCase(repository)(input),
    startAgentTask: createStartAgentTaskUseCase(agentRuntime)
  }
}

export type DesktopServices = ReturnType<typeof createDesktopServices>
