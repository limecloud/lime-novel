export const extractBodyParagraphs = (content: string): string[] =>
  content
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !segment.startsWith('#'))

export const replaceFirstBodyParagraph = (
  content: string,
  nextParagraph: string
): string => {
  const parts = content
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  const firstBodyIndex = parts.findIndex((segment) => !segment.startsWith('#'))

  if (firstBodyIndex < 0) {
    return `${content.trim()}\n\n${nextParagraph}\n`
  }

  const nextParts = [...parts]
  nextParts[firstBodyIndex] = nextParagraph.trim()
  return `${nextParts.join('\n\n').trim()}\n`
}

export const appendParagraphs = (
  content: string,
  paragraphs: string[]
): string =>
  `${content.trimEnd()}\n\n${paragraphs.map((paragraph) => paragraph.trim()).join('\n\n')}\n`

export const toSnippet = (value: string, maxLength = 40): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`
