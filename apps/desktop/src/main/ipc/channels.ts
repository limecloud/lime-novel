export const CHANNELS = {
  workspace: {
    loadShell: 'workspace:load-shell',
    searchWorkspace: 'workspace:search-workspace',
    updateContext: 'workspace:update-context',
    createProject: 'workspace:create-project',
    openProjectDialog: 'workspace:open-project-dialog'
  },
  knowledge: {
    loadDocument: 'knowledge:load-document',
    generateAnswer: 'knowledge:generate-answer'
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
    loadSettings: 'agent:load-settings',
    saveSettings: 'agent:save-settings',
    testSettings: 'agent:test-settings',
    startTask: 'agent:start-task',
    loadTaskDiagnostics: 'agent:load-task-diagnostics',
    taskEvent: 'agent:task-event'
  }
} as const
