import type { WorkspaceShellDto } from '@lime-novel/application'
import type { FeatureToolId } from '@lime-novel/domain-novel'
import { featureToolDefinitions } from './feature-center-model'

type FeatureCenterStructurePanelProps = {
  shell: WorkspaceShellDto
  activeFeatureTool?: FeatureToolId
  onFeatureToolChange: (tool?: FeatureToolId) => void
}

export const FeatureCenterStructurePanel = ({
  shell,
  activeFeatureTool,
  onFeatureToolChange
}: FeatureCenterStructurePanelProps) => {
  const analysisCount = shell.analysisSamples.length

  return (
    <div className="structure-panel__content">
      <div className="structure-panel__section">
        <span className="eyebrow">功能列表</span>
        {featureToolDefinitions.map((tool) => (
          <button
            key={tool.id}
            className={activeFeatureTool === tool.id ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
            onClick={() => onFeatureToolChange(tool.id)}
          >
            <strong>{tool.label}</strong>
            <span>{analysisCount > 0 ? tool.activeStateSummary(analysisCount) : tool.emptyStateSummary}</span>
          </button>
        ))}
      </div>

      <div className="structure-panel__section">
        <span className="eyebrow">接入方式</span>
        <div className="panel-note">
          <strong>文件直接导入</strong>
          <span>不需要手填标题、作者和评论，导入后会从文件名和正文自动推断样本信息。</span>
        </div>
        <div className="panel-note">
          <strong>支持格式</strong>
          <span>`.txt`、`.md`、`.markdown`</span>
        </div>
      </div>
    </div>
  )
}
