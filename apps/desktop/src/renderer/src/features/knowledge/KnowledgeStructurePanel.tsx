import type { WorkspaceShellDto } from '@lime-novel/application'
import { formatCount } from '../workbench/workbench-format'
import {
  knowledgeBucketDefinitions,
  knowledgeBucketLabel,
  knowledgeStatusLabel,
  type KnowledgeBucketFilterId
} from './knowledge-model'

type KnowledgeStructurePanelProps = {
  shell: WorkspaceShellDto
  selectedBucket: KnowledgeBucketFilterId
  selectedDocumentPath?: string
  visibleDocuments: WorkspaceShellDto['knowledgeDocuments']
  onBucketChange: (bucket: KnowledgeBucketFilterId) => void
  onSelectDocument: (relativePath: string) => void
}

export const KnowledgeStructurePanel = ({
  shell,
  selectedBucket,
  selectedDocumentPath,
  visibleDocuments,
  onBucketChange,
  onSelectDocument
}: KnowledgeStructurePanelProps) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">知识概览</span>
      <div className="panel-note">
        <strong>{formatCount(shell.knowledgeSummary.totalDocuments)} 份项目知识</strong>
        <span>
          compiled {shell.knowledgeSummary.compiledDocuments} / canon {shell.knowledgeSummary.canonDocuments} / outputs{' '}
          {shell.knowledgeSummary.outputDocuments}
        </span>
      </div>
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">知识分层</span>
      {knowledgeBucketDefinitions.map((bucket) => {
        const count = shell.knowledgeDocuments.filter((document) => bucket.match(document)).length

        return (
          <button
            key={bucket.id}
            className={bucket.id === selectedBucket ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
            onClick={() => onBucketChange(bucket.id)}
          >
            <strong>{bucket.label}</strong>
            <span>{count} 份文档</span>
          </button>
        )
      })}
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">当前范围</span>
      {visibleDocuments.length > 0 ? (
        visibleDocuments.slice(0, 8).map((document) => (
          <button
            key={document.relativePath}
            className={
              document.relativePath === selectedDocumentPath ? 'panel-list-button panel-list-button--active' : 'panel-list-button'
            }
            onClick={() => onSelectDocument(document.relativePath)}
          >
            <strong>{document.title}</strong>
            <span>
              {knowledgeBucketLabel[document.bucket]} · {knowledgeStatusLabel[document.status]}
            </span>
          </button>
        ))
      ) : (
        <div className="panel-note">
          <strong>当前范围为空</strong>
          <span>可以先保存章节、导入资料，或者生成第一份知识问答产物。</span>
        </div>
      )}
    </div>
  </div>
)
