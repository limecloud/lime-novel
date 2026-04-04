import { createId } from '@lime-novel/shared-kernel'
import type { CanonCandidateDto, WorkspaceShellDto } from '@lime-novel/application'

const extractLegacyCanonTerms = (
  content: string,
  fallbackTerms: string[]
): string[] => {
  const stopwords = new Set([
    '当前',
    '工作台',
    '项目',
    '继续',
    '这里',
    '一个',
    '这部',
    '因为',
    '已经',
    '没有',
    '不是',
    '可以',
    '自己',
    '时候',
    '场景',
    '章节',
    '正文',
    '目标',
    '主线',
    '故事',
    '动作',
    '结果',
    '问题',
    '建议',
    '设定',
    '修订',
    '导出'
  ])

  const counts = new Map<string, number>()
  const matches = content.match(/[\u4e00-\u9fff]{2,6}/g) ?? []

  for (const token of matches) {
    if (stopwords.has(token)) {
      continue
    }

    counts.set(token, (counts.get(token) ?? 0) + 1)
  }

  const ranked = [...counts.entries()]
    .sort((left, right) => {
      if (right[1] === left[1]) {
        return right[0].length - left[0].length
      }

      return right[1] - left[1]
    })
    .map(([token]) => token)

  return [...new Set([...fallbackTerms.filter(Boolean), ...ranked])].slice(0, 3)
}

const inferLegacyCanonKind = (term: string): CanonCandidateDto['kind'] => {
  if (/(楼|塔|街|巷|馆|室|城|镇|村|桥|门)$/u.test(term)) {
    return 'location'
  }

  if (/(规则|禁忌|仪式|律|约定)$/u.test(term)) {
    return 'rule'
  }

  if (/(钥匙|手稿|相片|信封|门锁|戒指|碎片|地图)$/u.test(term)) {
    return 'item'
  }

  return 'item'
}

export const buildLegacyCanonCandidates = (input: {
  shell: WorkspaceShellDto
  chapter: {
    title: string
    content: string
    objective: string
  }
}): CanonCandidateDto[] => {
  const scene = input.shell.sceneList[0]
  const terms = extractLegacyCanonTerms(input.chapter.content, [
    scene?.title ?? '',
    input.chapter.title.replace(/^第\d+章\s*/u, '')
  ])

  return terms.slice(0, 2).map((term, index) => ({
    cardId: createId(`canon-${index + 1}`),
    name: term,
    kind: inferLegacyCanonKind(term),
    summary: `在 ${input.chapter.title} 中被反复调用，当前承担“${scene?.goal ?? input.chapter.objective}”的叙事功能，适合继续追踪。`,
    visibility: 'candidate',
    evidence: `章节：${input.chapter.title} · 场景：${scene?.title ?? '当前场景'} · 线索词：${term}`
  }))
}
