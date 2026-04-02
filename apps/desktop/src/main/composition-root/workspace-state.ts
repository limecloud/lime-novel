import { existsSync } from 'node:fs'
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createNovelProjectWorkspace } from '@lime-novel/infrastructure'

type WorkspaceState = {
  lastWorkspacePath?: string
}

const isValidWorkspace = async (workspacePath: string): Promise<boolean> => {
  try {
    await access(join(workspacePath, 'novel.json'))
    return true
  } catch {
    return false
  }
}

const loadWorkspaceState = async (statePath: string): Promise<WorkspaceState> => {
  try {
    return JSON.parse(await readFile(statePath, 'utf8')) as WorkspaceState
  } catch {
    return {}
  }
}

const saveWorkspaceState = async (statePath: string, state: WorkspaceState): Promise<void> => {
  await mkdir(dirname(statePath), { recursive: true })
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

const findExistingWorkspace = async (projectsRoot: string): Promise<string | null> => {
  if (!existsSync(projectsRoot)) {
    return null
  }

  const entries = await readdir(projectsRoot, { withFileTypes: true })
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(projectsRoot, entry.name))
    .sort((left, right) => right.localeCompare(left))

  for (const directory of directories) {
    if (await isValidWorkspace(directory)) {
      return directory
    }
  }

  return null
}

export const createWorkspaceStateStore = (userDataPath: string, projectsRoot: string) => {
  const statePath = join(userDataPath, 'workspace-state.json')

  const rememberWorkspace = async (workspacePath: string): Promise<void> => {
    await saveWorkspaceState(statePath, { lastWorkspacePath: workspacePath })
  }

  const resolveInitialWorkspace = async (): Promise<string> => {
    const state = await loadWorkspaceState(statePath)

    if (state.lastWorkspacePath && (await isValidWorkspace(state.lastWorkspacePath))) {
      return state.lastWorkspacePath
    }

    const existingWorkspace = await findExistingWorkspace(projectsRoot)

    if (existingWorkspace) {
      await rememberWorkspace(existingWorkspace)
      return existingWorkspace
    }

    const created = await createNovelProjectWorkspace(projectsRoot, {
      title: '我的长篇项目',
      genre: '待定题材',
      premise: '请补充故事 premise，让工作台围绕主线持续协作。',
      template: 'blank'
    })

    await rememberWorkspace(created.workspacePath)
    return created.workspacePath
  }

  return {
    rememberWorkspace,
    resolveInitialWorkspace
  }
}
