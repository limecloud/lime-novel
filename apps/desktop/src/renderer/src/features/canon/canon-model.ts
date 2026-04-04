import type { CanonCandidateDto, ChapterListItemDto } from '@lime-novel/application'

export type CanonView = 'cards' | 'graph' | 'timeline'
export type CanonCategoryId = 'all' | 'character' | 'location' | 'rule' | 'timeline'

export const canonCategoryDefinitions: Array<{
  id: CanonCategoryId
  label: string
  match: (card: CanonCandidateDto) => boolean
}> = [
  {
    id: 'all',
    label: '全部卡片',
    match: () => true
  },
  {
    id: 'character',
    label: '人物卡',
    match: (card) => card.kind === 'character'
  },
  {
    id: 'location',
    label: '地点与场景',
    match: (card) => card.kind === 'location'
  },
  {
    id: 'rule',
    label: '规则与道具',
    match: (card) => card.kind === 'rule' || card.kind === 'item'
  },
  {
    id: 'timeline',
    label: '时间线节点',
    match: (card) => card.kind === 'timeline-event'
  }
]

export const findCanonCategoryDefinition = (category: CanonCategoryId) =>
  canonCategoryDefinitions.find((item) => item.id === category)

export const buildCanonTimeline = (
  chapters: ChapterListItemDto[],
  selectedCard?: CanonCandidateDto
): Array<{ title: string; detail: string }> =>
  chapters.map((chapter) => ({
    title: `第 ${chapter.order} 章 · ${chapter.title}`,
    detail: selectedCard ? `${selectedCard.name} 与本章建立关联，可回看 ${chapter.summary}` : chapter.summary
  }))
