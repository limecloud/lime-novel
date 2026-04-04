import type { RevisionIssueDto } from '@lime-novel/application'
import { issueSeverityLabel } from './revision-model'

type RevisionStructurePanelProps = {
  issues: RevisionIssueDto[]
  selectedIssueId?: string
  onSelectIssue: (issueId: string) => void
}

export const RevisionStructurePanel = ({
  issues,
  selectedIssueId,
  onSelectIssue
}: RevisionStructurePanelProps) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">问题队列</span>
      {issues.map((issue) => (
        <button
          key={issue.issueId}
          className={issue.issueId === selectedIssueId ? 'panel-list-button panel-list-button--active panel-list-button--issue' : 'panel-list-button panel-list-button--issue'}
          onClick={() => onSelectIssue(issue.issueId)}
        >
          <strong>{issueSeverityLabel[issue.severity]} · {issue.title}</strong>
          <span>
            {issue.summary}
            {issue.status === 'deferred' ? ' · 已稍后处理' : ''}
          </span>
        </button>
      ))}
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">筛选</span>
      <div className="panel-note">
        <strong>范围</strong>
        <span>当前章 / 当前卷 / 全书</span>
      </div>
      <div className="panel-note">
        <strong>类型</strong>
        <span>人物 / 节奏 / POV / 语言</span>
      </div>
      <div className="panel-note">
        <strong>来源</strong>
        <span>自动诊断 / 手动标记 / 反馈导入</span>
      </div>
    </div>
  </div>
)
