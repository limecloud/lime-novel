import type { WorkspaceShellDto } from '@lime-novel/application'

type PublishStructurePanelProps = {
  shell: WorkspaceShellDto
  selectedPresetId?: string
  onSelectPreset: (presetId: string) => void
}

export const PublishStructurePanel = ({
  shell,
  selectedPresetId,
  onSelectPreset
}: PublishStructurePanelProps) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">发布结构</span>
      {shell.exportPresets.map((preset) => (
        <button
          key={preset.presetId}
          className={preset.presetId === selectedPresetId ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
          onClick={() => onSelectPreset(preset.presetId)}
        >
          <strong>{preset.title}</strong>
          <span>{preset.summary}</span>
        </button>
      ))}
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">本次范围</span>
      <div className="panel-note">
        <strong>{shell.chapterTree[0]?.volumeLabel ?? '当前卷册'}</strong>
        <span>第 {shell.chapterTree[0]?.order ?? 1} 章 - 第 {shell.chapterTree.at(-1)?.order ?? 1} 章</span>
      </div>
      <div className="panel-note">
        <strong>版本</strong>
        <span>{new Date().toLocaleString('zh-CN', { hour12: false })}</span>
      </div>
      <div className="panel-note">
        <strong>最近资产</strong>
        <span>
          {shell.recentExports[0]
            ? `${shell.recentExports[0].fileCount} 个产物 · ${shell.recentExports[0].versionTag}`
            : '等待首次正式导出'}
        </span>
      </div>
    </div>
  </div>
)
