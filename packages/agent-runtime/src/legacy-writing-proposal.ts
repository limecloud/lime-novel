import { createId } from '@lime-novel/shared-kernel'
import type { ChapterDocumentDto, WorkspaceShellDto } from '@lime-novel/application'
import {
  appendParagraphs,
  extractBodyParagraphs,
  replaceFirstBodyParagraph,
  toSnippet
} from './legacy-agent-text-utils'

export type LegacyWritingProposal = {
  proposalId: string
  fullContent: string
  before: string
  after: string
  title: string
  body: string
}

export const buildLegacyWritingProposal = (
  shell: WorkspaceShellDto,
  chapter: ChapterDocumentDto,
  intent: string
): LegacyWritingProposal => {
  const paragraphs = extractBodyParagraphs(chapter.content)
  const firstParagraph = paragraphs[0] ?? chapter.objective
  const lastParagraph = paragraphs.at(-1) ?? chapter.objective
  const sceneTitle = shell.sceneList[0]?.title ?? '当前场景'
  const sceneGoal = shell.sceneList[0]?.goal ?? chapter.objective
  const proposalId = createId('proposal')

  if (intent.includes('改') || intent.includes('开头') || intent.includes('克制')) {
    const rewrittenOpening = [
      `${sceneTitle}里没有任何多余解释，先逼近的是动作本身。`,
      `她把注意力压回到眼前那一步，只让${toSnippet(sceneGoal, 18)}先发生，再把情绪藏进更细的反应里。`
    ].join('')

    return {
      proposalId,
      fullContent: replaceFirstBodyParagraph(chapter.content, rewrittenOpening),
      before: toSnippet(firstParagraph, 48),
      after: toSnippet(rewrittenOpening, 48),
      title: '开头改写提议已生成',
      body: '已经把开头收紧为“动作先落下、解释后补足”的版本，适合直接应用到正文。'
    }
  }

  const continuationParagraphs = [
    `她没有再把注意力让给犹豫，反而顺着${toSnippet(sceneGoal, 18)}往前推了一步。眼前的信息仍然不完整，但动作已经替她做出了选择。`,
    `真正需要被确认的，不是答案本身，而是${toSnippet(lastParagraph, 20)}之后还能不能继续成立。于是她把下一步落到更具体的感官与细节上，让场景继续向前。`
  ]

  return {
    proposalId,
    fullContent: appendParagraphs(chapter.content, continuationParagraphs),
    before: toSnippet(lastParagraph, 48),
    after: toSnippet(continuationParagraphs[0], 48),
    title: '续写提议已生成',
    body: '已经基于当前章节目标补了一版可直接应用的下一段，保持当前场景继续向前。'
  }
}
