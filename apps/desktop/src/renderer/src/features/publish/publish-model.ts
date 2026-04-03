import type {
  AgentFeedItemDto,
  ExportComparisonDto,
  ExportPresetDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import { formatDateTime } from '../workbench/workbench-format'

export const exportStatusLabel: Record<ExportPresetDto['status'], string> = {
  ready: '可导出',
  draft: '待补齐元数据'
}

export const riskLevelLabel: Record<ExportComparisonDto['riskLevel'], string> = {
  low: '低风险',
  medium: '需复核',
  high: '高风险'
}

export const buildDefaultPublishSynopsis = (shell: WorkspaceShellDto): string =>
  `《${shell.project.title}》聚焦林清远在钟楼与旧雨季之间追索父亲失踪真相的过程，保留悬疑与都市奇幻的双重张力。`

export const buildDefaultPublishNotes = (shell: WorkspaceShellDto): string =>
  shell.recentExports[0]
    ? `延续 ${shell.recentExports[0].versionTag} 之后的当前发布快照，重点确认最新正文与简介差异。`
    : `首个正式导出版本，准备围绕《${shell.project.title}》建立发布基线。`

export const suggestNextPublishVersion = (shell: WorkspaceShellDto): string => {
  if (!shell.recentExports[0] && !shell.project.lastPublishedAt) {
    return shell.project.releaseVersion
  }

  const previousVersion = shell.recentExports[0]?.versionTag ?? shell.project.releaseVersion
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(previousVersion)

  if (!match) {
    return previousVersion === 'v0.1.0' ? 'v0.1.1' : `${previousVersion}-next`
  }

  const major = Number.parseInt(match[1], 10)
  const minor = Number.parseInt(match[2], 10)
  const patch = Number.parseInt(match[3], 10)
  return `v${major}.${minor}.${patch + 1}`
}

export const buildPublishChecklist = (preset: ExportPresetDto, shell: WorkspaceShellDto): string[] => [
  `当前预设：${preset.title} · ${preset.format.toUpperCase()}`,
  `卷册范围：${shell.chapterTree[0]?.order ?? 1} - ${shell.chapterTree.at(-1)?.order ?? 1} 章`,
  `当前项目版本：${shell.project.releaseVersion}${shell.project.lastPublishedAt ? ` · 上次导出 ${formatDateTime(shell.project.lastPublishedAt)}` : ' · 尚未正式导出'}`,
  '导出策略：始终生成新的版本快照，不覆盖已有导出目录。'
]

export const buildPublishComparisonNotes = (
  shell: WorkspaceShellDto,
  input: { versionTag: string; synopsis: string; splitChapters: number; notes: string }
): string[] => {
  const latestExport = shell.recentExports[0]
  const previousVersion = latestExport?.versionTag ?? shell.project.releaseVersion
  const notes: string[] = []

  if (latestExport) {
    notes.push(`将从 ${latestExport.versionTag} 继续导出，本次目标版本为 ${input.versionTag}。`)
    notes.push(
      latestExport.splitChapters === input.splitChapters
        ? `平台拆章保持 ${input.splitChapters} 组，不改变上一次节奏切分。`
        : `平台拆章将从 ${latestExport.splitChapters} 调整为 ${input.splitChapters}，需再次确认连载节奏。`
    )
    notes.push(
      latestExport.synopsis.trim() === input.synopsis.trim()
        ? '平台简介与上一版保持一致，适合只发布正文修订。'
        : '平台简介已发生变化，建议在确认前快速核对悬念钩子是否仍然成立。'
    )

    if (latestExport.platformFeedback[0]) {
      notes.push(`上一版主要反馈：${latestExport.platformFeedback[0]}`)
    }
  } else {
    notes.push(`当前会创建首个正式导出版本 ${input.versionTag}。`)
    notes.push('这是第一次输出，建议先确认简介、拆章和发布备注，再执行导出。')
  }

  if (input.notes.trim()) {
    notes.push(`发布备注将写入 release-notes：${input.notes.trim()}`)
  } else {
    notes.push(`若不填写备注，会自动写入“${previousVersion} 后的当前导出快照”说明。`)
  }

  return notes
}

export const isPublishSynopsisDraftItem = (item: AgentFeedItemDto): boolean =>
  item.kind === 'evidence' &&
  item.title === '平台简介草案已生成' &&
  item.supportingLabel === '发布参数 / 可直接回填简介'

export const isPublishNotesDraftItem = (item: AgentFeedItemDto): boolean =>
  item.kind === 'evidence' &&
  item.title === '发布备注草案已生成' &&
  item.supportingLabel === '发布参数 / 可直接回填备注'

export const isPublishConfirmSuggestionItem = (item: AgentFeedItemDto): boolean =>
  item.kind === 'status' && item.title === '最终确认建议已生成'

export const buildExpectedPublishAssets = (preset?: ExportPresetDto): Array<{ label: string; detail: string }> => {
  const manuscriptFile = preset?.format === 'markdown' ? 'manuscript.md' : 'prepack.md'

  return [
    {
      label: manuscriptFile,
      detail: '正文主包，按当前预设聚合章节内容。'
    },
    {
      label: 'synopsis.md',
      detail: '平台简介，随版本一起归档。'
    },
    {
      label: 'release-notes.md',
      detail: '发布备注，记录这一版的确认重点。'
    },
    {
      label: 'platform-feedback.md',
      detail: '平台反馈与预检提示，便于下次复盘。'
    },
    {
      label: 'manifest.json',
      detail: '版本、预设、资产路径与反馈清单。'
    }
  ]
}
