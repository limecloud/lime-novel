import type { CreateExportPackageInputDto, WorkspaceShellDto } from '@lime-novel/application'
import { formatDateTime, formatSignedDelta, summarizePath } from '../workbench/workbench-format'
import {
  buildExpectedPublishAssets,
  buildPublishChecklist,
  buildPublishComparisonNotes,
  exportStatusLabel,
  riskLevelLabel,
  suggestNextPublishVersion
} from './publish-model'
import type { PublishWorkbenchState } from './usePublishWorkbenchState'

type PublishSurfaceProps = {
  shell: WorkspaceShellDto
  publish: PublishWorkbenchState
  isExporting: boolean
  onStartTask: (intent: string) => void
  onCreateExportPackage: (input: CreateExportPackageInputDto) => void
}

export const PublishSurface = ({
  shell,
  publish,
  isExporting,
  onStartTask,
  onCreateExportPackage
}: PublishSurfaceProps) => {
  const preset = publish.selectedPreset
  const synopsisDraft = publish.synopsisDraft
  const notesDraft = publish.notesDraft
  const confirmSuggestion = publish.confirmSuggestion
  const checklist = preset ? buildPublishChecklist(preset, shell) : []
  const presetTitleById = new Map(shell.exportPresets.map((item) => [item.presetId, item.title]))
  const splitValue = Number.parseInt(publish.exportSplit, 10) || 3
  const latestExport = shell.recentExports[0]
  const latestExportComparison = shell.latestExportComparison
  const expectedAssets = buildExpectedPublishAssets(preset)
  const comparisonNotes = buildPublishComparisonNotes(shell, {
    versionTag: publish.versionTag.trim() || suggestNextPublishVersion(shell),
    synopsis: publish.synopsis,
    splitChapters: splitValue,
    notes: publish.notes
  })
  const canConfirmExport = Boolean(preset && publish.synopsis.trim() && publish.versionTag.trim())
  const isSynopsisDraftApplied = synopsisDraft?.body.trim() === publish.synopsis.trim()
  const isNotesDraftApplied = notesDraft?.body.trim() === publish.notes.trim()

  return (
    <div className="surface-stack">
      <section className="surface-hero surface-hero--publish">
        <div className="surface-hero__meta-bar">
          <span>当前版本：{shell.project.releaseVersion}</span>
          <span>建议版本：{suggestNextPublishVersion(shell)}</span>
          <span>{latestExport ? `最近导出：${latestExport.versionTag}` : '最近导出：暂无'}</span>
        </div>
        <div className="surface-hero__main">
          <span className="eyebrow">结果工作面</span>
          <h1>导出预览与发布准备</h1>
          <p>发布仍属于小说主流程，因为简介、章节范围、元数据和版本都依赖项目记忆。</p>
        </div>
        <div className="hero-actions">
          {shell.exportPresets.map((item) => (
            <button
              key={item.presetId}
              className={item.presetId === preset?.presetId ? 'pill-button pill-button--active' : 'pill-button'}
              onClick={() => publish.onSelectPreset(item.presetId)}
            >
              {item.title}
            </button>
          ))}
        </div>
      </section>

      <div className="surface-grid surface-grid--two-large">
        <article className="surface-card surface-card--preview">
          <div className="surface-card__header">
            <span className="eyebrow">导出预览</span>
            <span className="status-chip">{preset ? exportStatusLabel[preset.status] : '等待预设'}</span>
          </div>
          <div className="preview-sheet">
            <div className="preview-sheet__header">
              <strong>{shell.project.title}</strong>
              <span>{preset ? `${preset.title} · ${preset.format.toUpperCase()}` : '尚未选择预设'}</span>
            </div>
            <h2>{shell.chapterTree[1]?.title ? `第 ${shell.chapterTree[1].order} 章《${shell.chapterTree[1].title}》` : '导出预览'}</h2>
            <p>{publish.synopsis}</p>
            <div className="detail-list">
              <div className="detail-list__item">
                <strong>导出范围</strong>
                <span>第 {shell.chapterTree[0]?.order ?? 1} 章 - 第 {shell.chapterTree.at(-1)?.order ?? 1} 章</span>
              </div>
              <div className="detail-list__item">
                <strong>目标版本</strong>
                <span>{publish.versionTag.trim() || suggestNextPublishVersion(shell)}</span>
              </div>
              <div className="detail-list__item">
                <strong>平台拆分</strong>
                <span>{splitValue} 个平台章节</span>
              </div>
              <div className="detail-list__item">
                <strong>版本快照</strong>
                <span>{new Date().toLocaleString('zh-CN', { hour12: false })}</span>
              </div>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="surface-card__header">
            <span className="eyebrow">发布参数</span>
            <button
              className="inline-link"
              onClick={() => onStartTask('请解释最近两次发布差异，并指出最需要确认的变化。')}
            >
              让代理解读差异
            </button>
          </div>
          {synopsisDraft ? (
            <div className="stacked-note publish-draft-note">
              <strong>发布代理最新简介草案</strong>
              <p>{synopsisDraft.body}</p>
              <div className="hero-actions publish-draft-note__actions">
                <button
                  className="primary-button"
                  disabled={isSynopsisDraftApplied}
                  onClick={() => publish.onApplySynopsisDraft(synopsisDraft.body)}
                >
                  {isSynopsisDraftApplied ? '已采用这版简介' : '采用这版简介'}
                </button>
                <button
                  className="ghost-button"
                  onClick={() => onStartTask('请再生成一版更像长篇小说连载文案的平台简介。')}
                >
                  再生成一版
                </button>
              </div>
            </div>
          ) : null}
          {notesDraft ? (
            <div className="stacked-note publish-draft-note">
              <strong>发布代理最新备注草案</strong>
              <p>{notesDraft.body}</p>
              <div className="hero-actions publish-draft-note__actions">
                <button
                  className="primary-button"
                  disabled={isNotesDraftApplied}
                  onClick={() => publish.onApplyNotesDraft(notesDraft.body)}
                >
                  {isNotesDraftApplied ? '已采用这版备注' : '采用这版备注'}
                </button>
                <button
                  className="ghost-button"
                  onClick={() => onStartTask('请再生成一版更适合 release-notes 的发布备注，突出这一版的确认重点。')}
                >
                  再生成一版
                </button>
              </div>
            </div>
          ) : null}
          {confirmSuggestion ? (
            <div className="stacked-note publish-confirm-note">
              <strong>发布代理最终确认建议</strong>
              <p>{confirmSuggestion.body}</p>
              <div className="hero-actions publish-draft-note__actions">
                <button className="primary-button" onClick={publish.onOpenConfirm}>
                  直接打开确认单
                </button>
                <button className="ghost-button" onClick={() => onStartTask('请继续细化当前发布确认单，按风险高低列出复核顺序。')}>
                  细化确认顺序
                </button>
              </div>
            </div>
          ) : null}
          <label className="field-stack">
            <span>平台简介</span>
            <textarea value={publish.synopsis} onChange={(event) => publish.onSynopsisChange(event.target.value)} />
          </label>
          <label className="field-stack">
            <span>目标版本号</span>
            <input
              value={publish.versionTag}
              onChange={(event) => publish.onVersionTagChange(event.target.value)}
              placeholder={suggestNextPublishVersion(shell)}
            />
          </label>
          <label className="field-stack">
            <span>平台拆分章节数</span>
            <input value={publish.exportSplit} onChange={(event) => publish.onExportSplitChange(event.target.value)} />
          </label>
          <label className="field-stack">
            <span>发布备注</span>
            <textarea
              value={publish.notes}
              onChange={(event) => publish.onNotesChange(event.target.value)}
              placeholder="写给未来自己的这版说明，会一起写入 release-notes。"
            />
          </label>
          <div className="stacked-notes">
            {checklist.map((item) => (
              <div key={item} className="stacked-note">
                <p>{item}</p>
              </div>
            ))}
          </div>
          <div className="hero-actions">
            <button
              className="primary-button"
              disabled={!canConfirmExport}
              onClick={() => publish.onConfirmOpenChange(!publish.isConfirmOpen)}
            >
              {publish.isConfirmOpen ? '收起确认单' : '生成确认单'}
            </button>
            <button className="ghost-button" onClick={() => onStartTask('请帮我生成一版平台简介，并保留主线悬念。')}>
              生成平台简介
            </button>
            <button
              className="ghost-button"
              onClick={() => onStartTask('请生成一版发布备注，说明这次导出的确认重点与主线推进。')}
            >
              生成发布备注
            </button>
            <button
              className="ghost-button"
              onClick={() => onStartTask('请比较最新版本与当前发布草案的差异，并指出还需要确认的风险。')}
            >
              让发布代理做最终复核
            </button>
          </div>
        </article>
      </div>

      <article className="surface-card">
        <div className="surface-card__header">
          <div>
            <span className="eyebrow">资产检查</span>
            <h3>平台化资产与最近真实产物</h3>
          </div>
          <span className="status-chip status-chip--muted">
            {latestExport ? `${latestExport.fileCount} 个最近产物` : `${expectedAssets.length} 个待生成产物`}
          </span>
        </div>
        <div className="publish-assets">
          <div className="publish-assets__panel">
            <strong>本次确认后将生成</strong>
            <div className="publish-assets__list">
              {expectedAssets.map((asset) => (
                <div key={asset.label} className="publish-asset-item">
                  <div>
                    <strong>{asset.label}</strong>
                    <p>{asset.detail}</p>
                  </div>
                  <span>待生成</span>
                </div>
              ))}
            </div>
          </div>
          <div className="publish-assets__panel">
            <strong>最近一次真实导出资产</strong>
            {latestExport ? (
              <div className="publish-assets__list">
                {latestExport.files.map((filePath) => (
                  <div key={filePath} className="publish-asset-item">
                    <div>
                      <strong>{filePath.split(/[\\/]/).at(-1) ?? filePath}</strong>
                      <p title={filePath}>{summarizePath(filePath)}</p>
                    </div>
                    <span>已生成</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>还没有真实导出资产</strong>
                <span>完成首个导出后，这里会列出 manifest 里记录的实际产物清单。</span>
              </div>
            )}
          </div>
        </div>
      </article>

      <article className="surface-card">
        <div className="surface-card__header">
          <div>
            <span className="eyebrow">版本比较</span>
            <h3>最近两次真实导出差异</h3>
          </div>
          <span
            className={`severity-badge severity-badge--${
              latestExportComparison ? latestExportComparison.riskLevel : 'low'
            }`}
          >
            {latestExportComparison ? riskLevelLabel[latestExportComparison.riskLevel] : '暂无历史'}
          </span>
        </div>

        {latestExportComparison ? (
          <div className="publish-comparison">
            <div className="publish-comparison__summary">
              <strong>
                {latestExportComparison.previousVersionTag} {'->'} {latestExportComparison.currentVersionTag}
              </strong>
              <span>
                {formatDateTime(latestExportComparison.previousGeneratedAt)} {'->'}{' '}
                {formatDateTime(latestExportComparison.currentGeneratedAt)}
              </span>
              <p>{latestExportComparison.summary}</p>
            </div>

            <div className="publish-comparison__metrics">
              <div className="publish-comparison__metric">
                <span>简介变化</span>
                <strong>{formatSignedDelta(latestExportComparison.synopsisDelta, ' 字')}</strong>
              </div>
              <div className="publish-comparison__metric">
                <span>拆章变化</span>
                <strong>{formatSignedDelta(latestExportComparison.splitChaptersDelta, ' 组')}</strong>
              </div>
              <div className="publish-comparison__metric">
                <span>资产变化</span>
                <strong>{formatSignedDelta(latestExportComparison.fileCountDelta, ' 个')}</strong>
              </div>
            </div>

            <div className="publish-comparison__grid">
              <div className="stacked-notes">
                <div className="stacked-note">
                  <strong>变更项</strong>
                  <p>
                    {latestExportComparison.changedFields.length > 0
                      ? latestExportComparison.changedFields.join('、')
                      : '这两版的发布参数保持一致。'}
                  </p>
                </div>
                {latestExportComparison.addedFeedback.map((item) => (
                  <div key={item} className="stacked-note">
                    <strong>新增反馈</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>

              <div className="stacked-notes">
                {latestExportComparison.removedFeedback.length > 0 ? (
                  latestExportComparison.removedFeedback.map((item) => (
                    <div key={item} className="stacked-note">
                      <strong>已消除反馈</strong>
                      <p>{item}</p>
                    </div>
                  ))
                ) : (
                  <div className="stacked-note">
                    <strong>已消除反馈</strong>
                    <p>最近两次导出之间没有移除的反馈项，说明当前风险仍需继续关注。</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>还不足以比较版本</strong>
            <span>至少需要两次真实导出后，这里才会自动生成参数差异与反馈变化。</span>
          </div>
        )}
      </article>

      {publish.isConfirmOpen ? (
        <article className="surface-card">
          <div className="surface-card__header">
            <div>
              <span className="eyebrow">最终确认</span>
              <h3>作者确认后再执行导出</h3>
            </div>
            <span className="status-chip">{publish.versionTag.trim() || suggestNextPublishVersion(shell)}</span>
          </div>
          <div className="surface-grid surface-grid--two">
            <div className="detail-list">
              <div className="detail-list__item">
                <strong>版本回写</strong>
                <span>
                  这次会把 {publish.versionTag.trim() || suggestNextPublishVersion(shell)} 与导出时间回写到项目配置中。
                </span>
              </div>
              <div className="detail-list__item">
                <strong>输出资产</strong>
                <span>会生成正文包、简介、发布备注、平台反馈与 manifest，不覆盖已有目录。</span>
              </div>
              <div className="detail-list__item">
                <strong>上一个版本</strong>
                <span>{latestExport ? `${latestExport.versionTag} · ${formatDateTime(latestExport.generatedAt)}` : '暂无历史版本'}</span>
              </div>
            </div>
            <div className="stacked-notes">
              {comparisonNotes.map((item) => (
                <div key={item} className="stacked-note">
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-actions">
            <button
              className="primary-button"
              disabled={!preset || !publish.synopsis.trim() || !publish.versionTag.trim() || isExporting}
              onClick={() =>
                preset &&
                onCreateExportPackage({
                  presetId: preset.presetId,
                  synopsis: publish.synopsis,
                  splitChapters: splitValue,
                  versionTag: publish.versionTag.trim(),
                  notes: publish.notes
                })
              }
            >
              {isExporting ? '正在导出...' : '确认并导出'}
            </button>
            <button className="ghost-button" onClick={() => publish.onConfirmOpenChange(false)}>
              继续调整参数
            </button>
          </div>
        </article>
      ) : null}

      <article className="surface-card">
        <div className="surface-card__header">
          <span className="eyebrow">最近导出</span>
          <span className="status-chip status-chip--muted">{shell.recentExports.length} 次输出</span>
        </div>
        {shell.recentExports.length > 0 ? (
          <div className="export-history-list">
            {shell.recentExports.map((item) => (
              <div key={item.exportId} className="export-history-item">
                <div className="export-history-item__header">
                  <strong>
                    {item.versionTag} · {presetTitleById.get(item.presetId) ?? item.presetId}
                  </strong>
                  <span>{formatDateTime(item.generatedAt)}</span>
                </div>
                <p>{item.platformFeedback[0] ?? '该版本未记录平台反馈摘要。'}</p>
                <p>
                  简介长度 {item.synopsis.trim().length} 字 · 拆章 {item.splitChapters} 组 · 产物 {item.fileCount} 个
                </p>
                <p title={item.outputDir}>导出目录：{summarizePath(item.outputDir)}</p>
                <p title={item.manifestPath}>清单文件：{summarizePath(item.manifestPath)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>还没有导出记录</strong>
            <span>生成第一版导出包后，这里会回流最近产物，便于继续比较版本差异。</span>
          </div>
        )}
      </article>
    </div>
  )
}
