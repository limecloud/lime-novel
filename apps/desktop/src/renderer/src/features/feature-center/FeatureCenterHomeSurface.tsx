import type { WorkspaceShellDto } from '@lime-novel/application'
import type { FeatureToolId } from '@lime-novel/domain-novel'
import { featureToolDefinitions } from './feature-center-model'

type FeatureCenterHomeSurfaceProps = {
  shell: WorkspaceShellDto
  onFeatureToolChange: (tool?: FeatureToolId) => void
}

export const FeatureCenterHomeSurface = ({
  shell,
  onFeatureToolChange
}: FeatureCenterHomeSurfaceProps) => {
  const analysisCount = shell.analysisSamples.length

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--feature-center">
        <div className="surface-hero__main">
          <span className="eyebrow">功能中心</span>
          <h1>把辅助能力集中收进一个独立入口</h1>
          <p>这里专门放插件式工具，不和首页、写作、设定、修订、发布混在一起。当前第一个功能就是拆书。</p>
          <div className="hero-metrics">
            <span>已启用功能 {featureToolDefinitions.length} 个</span>
            <span>拆书样本 {analysisCount}</span>
            <span>支持导入 TXT / Markdown</span>
          </div>
        </div>
      </section>

      <div className="surface-grid surface-grid--two">
        {featureToolDefinitions.map((tool) => (
          <button
            key={tool.id}
            className="surface-card surface-card--selectable feature-tool-card"
            onClick={() => onFeatureToolChange(tool.id)}
          >
            <div className="feature-tool-card__meta">
              <span className="eyebrow">第一个功能</span>
              <strong>{tool.label}</strong>
            </div>
            <p>{tool.description}</p>
            <div className="detail-list detail-list--compact">
              <div className="detail-list__item">
                <strong>当前状态</strong>
                <span>{analysisCount > 0 ? tool.activeStateSummary(analysisCount) : '等待首个样本文件'}</span>
              </div>
              <div className="detail-list__item">
                <strong>默认流程</strong>
                <span>{'导入文件 -> 自动建模 -> 选择性回写项目'}</span>
              </div>
            </div>
          </button>
        ))}

        <article className="surface-card">
          <span className="eyebrow">当前接入方式</span>
          <h2>直接导入文本文件</h2>
          <div className="detail-list">
            <div className="detail-list__item">
              <strong>支持格式</strong>
              <span>`.txt`、`.md`、`.markdown`</span>
            </div>
            <div className="detail-list__item">
              <strong>自动推断</strong>
              <span>标题、摘要和题材信号会从文件名与正文内容里自动生成。</span>
            </div>
            <div className="detail-list__item">
              <strong>回写策略</strong>
              <span>只把值得保留的结论回写到首页高亮、快捷动作和候选设定卡。</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
