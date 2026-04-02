export const CHANNELS = {
  workspace: {
    loadShell: 'workspace:load-shell',
    searchWorkspace: 'workspace:search-workspace',
    updateContext: 'workspace:update-context',
    createProject: 'workspace:create-project',
    openProjectDialog: 'workspace:open-project-dialog'
  },
  chapter: {
    loadDocument: 'chapter:load-document',
    saveDocument: 'chapter:save-document',
    applyProposal: 'chapter:apply-proposal',
    rejectProposal: 'chapter:reject-proposal'
  },
  analysis: {
    importSample: 'analysis:import-sample',
    applyStrategyProposal: 'analysis:apply-strategy-proposal'
  },
  canon: {
    commitCard: 'canon:commit-card'
  },
  revision: {
    updateIssue: 'revision:update-issue',
    undoRecord: 'revision:undo-record'
  },
  publish: {
    createExportPackage: 'publish:create-export-package'
  },
  agent: {
    startTask: 'agent:start-task',
    taskEvent: 'agent:task-event'
  }
} as const
