import { createId } from '@lime-novel/shared-kernel'
import type { ChapterDocumentDto, RevisionIssueDto } from '@lime-novel/application'
import {
  extractBodyParagraphs,
  replaceFirstBodyParagraph,
  toSnippet
} from './legacy-agent-text-utils'

export type LegacyRevisionProposal = {
  proposalId: string
  fullContent: string
  before: string
  after: string
  title: string
  body: string
}

export const shouldGenerateLegacyRevisionProposal = (intent: string): boolean =>
  /(方案|改写|重写|再来一版|克制|应用)/u.test(intent)

export const buildLegacyRevisionProposal = (
  chapter: ChapterDocumentDto,
  issue: RevisionIssueDto,
  intent: string
): LegacyRevisionProposal => {
  const paragraphs = extractBodyParagraphs(chapter.content)
  const firstParagraph = paragraphs[0] ?? chapter.objective
  const isRestrained = intent.includes('再来一版') || intent.includes('克制')
  const proposalId = createId('proposal')

  if (issue.title.includes('视角')) {
    const rewritten = isRestrained
      ? '林清远先被钟声逼得耳骨发紧，才把视线压回门锁。她不去猜门后有什么，只抓住自己能够确认的潮湿铜味与楼梯回声，让紧张留在身体反应里。'
      : '钟声贴着耳骨落下来时，林清远先摸到口袋里的旧硬币，才勉强稳住呼吸。她没有越过门板去想象里面发生过什么，只盯着锁孔边缘那一圈被雨气浸亮的铜色。'

    return {
      proposalId,
      fullContent: replaceFirstBodyParagraph(chapter.content, rewritten),
      before: toSnippet(firstParagraph, 48),
      after: toSnippet(rewritten, 48),
      title: '修订方案 A 已生成',
      body: '已经围绕视角边界给出一版最小修订方案，优先把越界信息收回到角色可感知范围。'
    }
  }

  if (issue.title.includes('密度') || issue.title.includes('节奏')) {
    const rewritten = isRestrained
      ? '她没有继续解释门后的意义，只让钥匙、门锁和旧铜味更快碰到一起。动作先发生，判断被压到下一拍，整段呼吸会更稳。'
      : '她把解释压短，只留下钥匙进锁、门锁回声和旧铜味同时逼近的那一下。这样动作会更早落地，悬念也不需要靠额外说明支撑。'

    return {
      proposalId,
      fullContent: replaceFirstBodyParagraph(chapter.content, rewritten),
      before: toSnippet(firstParagraph, 48),
      after: toSnippet(rewritten, 48),
      title: '节奏修订方案已生成',
      body: '已经把开头改成更快落动作的一版，优先解决解释偏多、推进偏缓的问题。'
    }
  }

  const rewritten = isRestrained
    ? '她先确认眼前能够被看见、被听见的细节，再决定下一步动作，把容易冲突的解释全部往后收。'
    : '她先把能够确认的事实落成动作，再把解释延后，让当前章的冲突和信息边界重新对齐。'

  return {
    proposalId,
    fullContent: replaceFirstBodyParagraph(chapter.content, rewritten),
    before: toSnippet(firstParagraph, 48),
    after: toSnippet(rewritten, 48),
    title: '最小修订方案已生成',
    body: '已经基于当前问题给出一版最小改动的修订方案，方便先验证冲突是否被消掉。'
  }
}
