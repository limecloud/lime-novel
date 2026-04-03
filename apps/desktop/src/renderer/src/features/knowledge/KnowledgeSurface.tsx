import { useEffect, useState } from 'react'
import type {
  GenerateKnowledgeAnswerInputDto,
  GenerateKnowledgeAnswerResultDto,
  KnowledgeDocumentDetailDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import type { NovelSurfaceId } from '@lime-novel/domain-novel'
import { formatCount, formatDateTime } from '../workbench/workbench-format'
import {
  buildKnowledgeHealthLabel,
  knowledgeBucketDefinitions,
  knowledgeBucketLabel,
  knowledgeStatusLabel,
  resolveKnowledgeStatusChipClass,
  type KnowledgeBucketFilterId
} from './knowledge-model'

type KnowledgeSurfaceProps = {
  shell: WorkspaceShellDto
  visibleDocuments: WorkspaceShellDto['knowledgeDocuments']
  selectedBucket: KnowledgeBucketFilterId
  selectedDocumentPath?: string
  selectedDocumentMetadata?: WorkspaceShellDto['knowledgeDocuments'][number]
  selectedDocument?: KnowledgeDocumentDetailDto
  isDocumentLoading: boolean
  documentError?: string | null
  onBucketChange: (bucket: KnowledgeBucketFilterId) => void
  onSelectDocument: (relativePath: string) => void
  onStartTask: (intent: string, surface?: NovelSurfaceId) => void
  onCreateKnowledgeAnswer: (input: GenerateKnowledgeAnswerInputDto) => Promise<GenerateKnowledgeAnswerResultDto>
  isGeneratingAnswer: boolean
}

export const KnowledgeSurface = ({
  shell,
  visibleDocuments,
  selectedBucket,
  selectedDocumentPath,
  selectedDocumentMetadata,
  selectedDocument,
  isDocumentLoading,
  documentError,
  onBucketChange,
  onSelectDocument,
  onStartTask,
  onCreateKnowledgeAnswer,
  isGeneratingAnswer
}: KnowledgeSurfaceProps) => {
  const [queryDraft, setQueryDraft] = useState(`第 12 章前，林清远当前知道什么，又误判了什么？`)
  const [queryFormat, setQueryFormat] = useState<GenerateKnowledgeAnswerInputDto['format']>('report')
  const healthLabel = buildKnowledgeHealthLabel(shell.knowledgeSummary)

  useEffect(() => {
    setQueryDraft(`第 12 章前，${shell.project.title} 当前最值得确认的信息差是什么？`)
  }, [shell.project.title, shell.workspacePath])

  const handleGenerateAnswer = async (): Promise<void> => {
    const question = queryDraft.trim()

    if (!question) {
      return
    }

    const result = await onCreateKnowledgeAnswer({
      question,
      format: queryFormat
    })

    onSelectDocument(result.relativePath)
  }

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--knowledge">
        <div className="surface-hero__main">
          <span className="eyebrow">本地知识编译层</span>
          <h1>知识页、证据与问答产物</h1>
          <p>这一层接住 raw 素材、compiled 页面、正式 canon 和 outputs 结果，让每次提问都能继续沉淀回项目。</p>
          <div className="hero-metrics">
            <span>知识资产 {formatCount(shell.knowledgeSummary.totalDocuments)}</span>
            <span>健康度 {healthLabel}</span>
            <span>冲突 {shell.knowledgeSummary.conflictedDocuments}</span>
            <span>待刷新 {shell.knowledgeSummary.staleDocuments}</span>
            <span>最近输出 {shell.knowledgeRecentOutputs.length}</span>
          </div>
        </div>
      </section>

      <section className="filter-bar">
        {knowledgeBucketDefinitions.map((bucket) => {
          const count = shell.knowledgeDocuments.filter((document) => bucket.match(document)).length

          return (
            <button
              key={bucket.id}
              className={bucket.id === selectedBucket ? 'filter-chip filter-chip--active' : 'filter-chip'}
              onClick={() => onBucketChange(bucket.id)}
            >
              {bucket.label}
              <span>{count}</span>
            </button>
          )
        })}
      </section>

      <div className="surface-grid surface-grid--two-large">
        <article className="surface-card surface-card--focus">
          <div className="surface-card__header">
            <div>
              <span className="eyebrow">当前知识页</span>
              <h2>{selectedDocumentMetadata?.title ?? '还没有可展示的知识页'}</h2>
            </div>
            {selectedDocumentMetadata ? (
              <span className={resolveKnowledgeStatusChipClass(selectedDocumentMetadata.status)}>
                {knowledgeStatusLabel[selectedDocumentMetadata.status]}
              </span>
            ) : null}
          </div>

          {isDocumentLoading ? (
            <div className="empty-state">
              <strong>正在加载知识页</strong>
              <span>稍等一下，当前文档的正文和证据正在读取。</span>
            </div>
          ) : documentError ? (
            <div className="callout callout--issue">当前知识页读取失败：{documentError}</div>
          ) : selectedDocument ? (
            <div className="knowledge-document">
              <div className="detail-list detail-list--compact">
                <div className="detail-list__item">
                  <strong>路径</strong>
                  <span>{selectedDocument.relativePath}</span>
                </div>
                <div className="detail-list__item">
                  <strong>类型与分层</strong>
                  <span>
                    {selectedDocument.type} · {knowledgeBucketLabel[selectedDocument.bucket]}
                  </span>
                </div>
                <div className="detail-list__item">
                  <strong>更新时间</strong>
                  <span>{selectedDocument.updatedAt ? formatDateTime(selectedDocument.updatedAt) : '未知'}</span>
                </div>
              </div>

              <div className="stacked-note">
                <strong>摘要</strong>
                <p>{selectedDocument.summary}</p>
              </div>

              {selectedDocument.sources.length > 0 ? (
                <div className="knowledge-chip-row">
                  {selectedDocument.sources.map((item) => (
                    <span key={item} className="memory-chip">
                      来源：{item}
                    </span>
                  ))}
                </div>
              ) : null}

              {selectedDocument.related.length > 0 ? (
                <div className="knowledge-chip-row">
                  {selectedDocument.related.map((item) => (
                    <span key={item} className="memory-chip">
                      关联：{item}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="knowledge-document__body">
                {selectedDocument.content.split(/\n{2,}/).map((block) => (
                  <p key={block}>{block}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <strong>当前范围还没有知识页</strong>
              <span>先保存章节、导入资料，或者生成第一份问答结果，知识工作面就会开始变得有内容。</span>
            </div>
          )}
        </article>

        <article className="surface-card">
          <div className="surface-card__header">
            <div>
              <span className="eyebrow">知识问答</span>
              <h2>把问题写成项目文件</h2>
            </div>
            <button
              className="inline-link"
              onClick={() =>
                onStartTask(
                  `请基于知识工作面里的资料继续深挖这个问题：${queryDraft.trim() || '当前项目最值得确认的信息差是什么？'}`,
                  'knowledge'
                )
              }
            >
              交给代理继续追问
            </button>
          </div>

          <label className="field-stack">
            <span>问题</span>
            <textarea
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="例如：第 12 章前，林清远到底知道什么，又误判了什么？"
            />
          </label>

          <div className="segmented-switch">
            <button
              className={queryFormat === 'report' ? 'pill-button pill-button--active' : 'pill-button'}
              onClick={() => setQueryFormat('report')}
            >
              report.md
            </button>
            <button
              className={queryFormat === 'brief' ? 'pill-button pill-button--active' : 'pill-button'}
              onClick={() => setQueryFormat('brief')}
            >
              brief.md
            </button>
          </div>

          <div className="stacked-notes">
            <div className="stacked-note">
              <strong>生成策略</strong>
              <p>第一版会基于项目内已有知识页、正式设定、查询产物和章节摘要自动汇总，并写入 `outputs/`。</p>
            </div>
            <div className="stacked-note">
              <strong>当前提示</strong>
              <p>如果结果太空，通常说明 raw 或 compiled 资料还不够，需要先补料而不是继续硬问。</p>
            </div>
          </div>

          <div className="hero-actions">
            <button className="primary-button" onClick={() => void handleGenerateAnswer()} disabled={isGeneratingAnswer || !queryDraft.trim()}>
              {isGeneratingAnswer ? '正在生成...' : '生成到项目'}
            </button>
            <button
              className="ghost-button"
              onClick={() =>
                setQueryDraft(`围绕 ${selectedDocumentMetadata?.title ?? '当前项目'}，还有哪些事实证据不足或互相冲突？`)
              }
            >
              生成冲突检查问题
            </button>
          </div>
        </article>
      </div>

      <div className="surface-grid surface-grid--two">
        <article className="surface-card">
          <div className="surface-card__header">
            <div>
              <span className="eyebrow">最近输出</span>
              <h3>已经写回项目的知识产物</h3>
            </div>
            <span className="status-chip status-chip--muted">{shell.knowledgeRecentOutputs.length} 份</span>
          </div>

          {shell.knowledgeRecentOutputs.length > 0 ? (
            <div className="stacked-notes">
              {shell.knowledgeRecentOutputs.map((document) => (
                <button
                  key={document.relativePath}
                  className="surface-card surface-card--selectable knowledge-output-card"
                  onClick={() => onSelectDocument(document.relativePath)}
                >
                  <span className="eyebrow">{document.type}</span>
                  <h3>{document.title}</h3>
                  <p>{document.summary}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>还没有知识输出</strong>
              <span>先在右侧输入一个问题，结果就会被写到 `outputs/answers` 或 `outputs/briefs`。</span>
            </div>
          )}
        </article>

        <article className="surface-card">
          <div className="surface-card__header">
            <div>
              <span className="eyebrow">当前范围</span>
              <h3>可继续阅读的知识页</h3>
            </div>
            <span className="status-chip status-chip--muted">{visibleDocuments.length} 份</span>
          </div>

          {visibleDocuments.length > 0 ? (
            <div className="knowledge-document-list">
              {visibleDocuments.slice(0, 8).map((document) => (
                <button
                  key={document.relativePath}
                  className={
                    document.relativePath === selectedDocumentPath
                      ? 'surface-card surface-card--selectable is-active'
                      : 'surface-card surface-card--selectable'
                  }
                  onClick={() => onSelectDocument(document.relativePath)}
                >
                  <div className="surface-card__header">
                    <span className="eyebrow">{knowledgeBucketLabel[document.bucket]}</span>
                    <span className={resolveKnowledgeStatusChipClass(document.status)}>
                      {knowledgeStatusLabel[document.status]}
                    </span>
                  </div>
                  <h3>{document.title}</h3>
                  <p>{document.summary}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>当前范围为空</strong>
              <span>这个分层还没有收进项目知识，可以先导入资料或从正文继续编译。</span>
            </div>
          )}
        </article>
      </div>
    </div>
  )
}
