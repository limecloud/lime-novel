import type { WorkspaceShellDto } from '@lime-novel/application'
import { canonCategoryDefinitions, type CanonCategoryId } from './canon-model'

type CanonStructurePanelProps = {
  shell: WorkspaceShellDto
  selectedCategory: CanonCategoryId
  onCategoryChange: (category: CanonCategoryId) => void
  onStartTask: (intent: string) => void
}

export const CanonStructurePanel = ({
  shell,
  selectedCategory,
  onCategoryChange,
  onStartTask
}: CanonStructurePanelProps) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">设定分类</span>
      <button
        className="structure-button structure-button--primary"
        onClick={() => onStartTask('请按当前项目世界观，为我创建一张新的设定卡草案。')}
      >
        + 新建卡片
      </button>
    </div>

    <div className="structure-panel__section">
      {canonCategoryDefinitions.slice(1).map((category) => {
        const count = shell.canonCandidates.filter((card) => category.match(card)).length

        return (
          <button
            key={category.id}
            className={category.id === selectedCategory ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
            onClick={() => onCategoryChange(category.id)}
          >
            <strong>{category.label}</strong>
            <span>{count} 张卡片</span>
          </button>
        )
      })}
    </div>
  </div>
)
