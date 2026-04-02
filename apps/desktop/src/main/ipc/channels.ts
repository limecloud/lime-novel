export const CHANNELS = {
  workspace: {
    loadShell: 'workspace:load-shell',
    updateContext: 'workspace:update-context',
    createProject: 'workspace:create-project',
    openProjectDialog: 'workspace:open-project-dialog'
  },
  chapter: {
    loadDocument: 'chapter:load-document',
    saveDocument: 'chapter:save-document',
    applyProposal: 'chapter:apply-proposal'
  },
  canon: {
    commitCard: 'canon:commit-card'
  },
  revision: {
    updateIssue: 'revision:update-issue'
  },
  publish: {
    createExportPackage: 'publish:create-export-package'
  },
  agent: {
    startTask: 'agent:start-task',
    taskEvent: 'agent:task-event'
  }
} as const
