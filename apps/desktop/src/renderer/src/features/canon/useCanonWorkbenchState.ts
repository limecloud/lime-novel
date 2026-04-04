import { useEffect, useState } from 'react'
import type { WorkspaceShellDto } from '@lime-novel/application'
import {
  buildCanonTimeline,
  canonCategoryDefinitions,
  findCanonCategoryDefinition,
  type CanonCategoryId,
  type CanonView
} from './canon-model'

export type CanonWorkbenchState = {
  canonView: CanonView
  selectedCategory: CanonCategoryId
  selectedCardId?: string
  visibleCards: WorkspaceShellDto['canonCandidates']
  selectedCard?: WorkspaceShellDto['canonCandidates'][number]
  timeline: Array<{ title: string; detail: string }>
  onCanonViewChange: (view: CanonView) => void
  onCategoryChange: (category: CanonCategoryId) => void
  onSelectCard: (cardId: string) => void
}

export const useCanonWorkbenchState = (shell: WorkspaceShellDto): CanonWorkbenchState => {
  const [canonView, setCanonView] = useState<CanonView>('cards')
  const [selectedCategory, setSelectedCategory] = useState<CanonCategoryId>('all')
  const [selectedCardId, setSelectedCardId] = useState(shell.canonCandidates[0]?.cardId)

  const visibleCards = shell.canonCandidates.filter((card) =>
    findCanonCategoryDefinition(selectedCategory)?.match(card) ?? true
  )
  const selectedCard =
    visibleCards.find((card) => card.cardId === selectedCardId) ??
    shell.canonCandidates.find((card) => card.cardId === selectedCardId) ??
    visibleCards[0]

  useEffect(() => {
    if (!shell.canonCandidates.some((card) => card.cardId === selectedCardId)) {
      setSelectedCardId(shell.canonCandidates[0]?.cardId)
    }
  }, [selectedCardId, shell.canonCandidates])

  useEffect(() => {
    if (visibleCards.length === 0) {
      return
    }

    if (!selectedCardId || !visibleCards.some((card) => card.cardId === selectedCardId)) {
      setSelectedCardId(visibleCards[0]?.cardId)
    }
  }, [selectedCardId, visibleCards])

  const handleCategoryChange = (category: CanonCategoryId): void => {
    setSelectedCategory(category)
  }

  const handleSelectCard = (cardId: string): void => {
    const card = shell.canonCandidates.find((item) => item.cardId === cardId)

    if (card) {
      const activeCategoryDefinition = findCanonCategoryDefinition(selectedCategory)

      if (selectedCategory !== 'all' && !(activeCategoryDefinition?.match(card) ?? true)) {
        const fallbackCategory =
          canonCategoryDefinitions.slice(1).find((definition) => definition.match(card))?.id ?? 'all'
        setSelectedCategory(fallbackCategory)
      }
    }

    setSelectedCardId(cardId)
  }

  return {
    canonView,
    selectedCategory,
    selectedCardId,
    visibleCards,
    selectedCard,
    timeline: buildCanonTimeline(shell.chapterTree, selectedCard),
    onCanonViewChange: setCanonView,
    onCategoryChange: handleCategoryChange,
    onSelectCard: handleSelectCard
  }
}
