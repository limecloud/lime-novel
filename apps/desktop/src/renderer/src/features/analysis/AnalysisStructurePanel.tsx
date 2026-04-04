import type { AnalysisOverviewDto, AnalysisSampleDto } from '@lime-novel/application'

type AnalysisStructurePanelProps = {
  overview: AnalysisOverviewDto
  samples: AnalysisSampleDto[]
  selectedSampleId?: string
  onSelectSample: (sampleId: string) => void
  onCreateSampleRequest: () => void
  isImporting: boolean
}

export const AnalysisStructurePanel = ({
  overview,
  samples,
  selectedSampleId,
  onSelectSample,
  onCreateSampleRequest,
  isImporting
}: AnalysisStructurePanelProps) => (
  <div className="structure-panel__content">
    <div className="structure-panel__section">
      <span className="eyebrow">拆书样本</span>
      <button className="structure-button structure-button--primary" onClick={onCreateSampleRequest} disabled={isImporting}>
        + 导入 TXT / Markdown
      </button>
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">样本列表</span>
      {samples.length > 0 ? (
        samples.map((sample) => (
          <button
            key={sample.sampleId}
            className={sample.sampleId === selectedSampleId ? 'panel-list-button panel-list-button--active' : 'panel-list-button'}
            onClick={() => onSelectSample(sample.sampleId)}
          >
            <strong>{sample.title}</strong>
            <span>{sample.tags.slice(0, 2).join(' / ') || sample.sourceLabel} · {sample.comments.length} 条评论</span>
          </button>
        ))
      ) : (
        <div className="panel-note">
          <strong>还没有拆书样本</strong>
          <span>先导入一个 `.txt` 或 `.md` 文件，工作台才会开始建立参考模型。</span>
        </div>
      )}
    </div>

    <div className="structure-panel__section">
      <span className="eyebrow">聚合趋势</span>
      <div className="panel-note">
        <strong>{overview.sampleCount} 个样本</strong>
        <span>{overview.dominantTags.join(' / ') || '等待首个题材标签'}</span>
      </div>
      <div className="panel-note">
        <strong>当前启发</strong>
        <span>{overview.projectAngles[0] ?? '导入后会自动生成立项启发。'}</span>
      </div>
    </div>
  </div>
)
