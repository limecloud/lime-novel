import { useEffect, useMemo, useRef, useState } from 'react'
import { BubbleMenu, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

type ChapterEditorProps = {
  content: string
  onChange: (value: string) => void
  onSave?: () => void
}

type EditorJsonNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: EditorJsonNode[]
}

const normalizeNarrativeText = (value: string): string => value.replace(/\r\n/g, '\n').trimEnd()

const withTrailingNewline = (value: string): string => {
  const normalized = normalizeNarrativeText(value)
  return normalized ? `${normalized}\n` : ''
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderParagraph = (lines: string[]): string => `<p>${lines.map((line) => escapeHtml(line)).join('<br />')}</p>`

const narrativeTextToHtml = (content: string): string => {
  const normalized = normalizeNarrativeText(content)

  if (!normalized) {
    return '<p></p>'
  }

  return normalized
    .split(/\n{2,}/)
    .map((rawBlock) => rawBlock.trim())
    .filter(Boolean)
    .map((block) => {
      const headingMatch = /^(#{1,6})\s+([\s\S]+)$/u.exec(block)

      if (headingMatch) {
        const level = Math.min(6, headingMatch[1].length)
        return `<h${level}>${escapeHtml(headingMatch[2].trim())}</h${level}>`
      }

      const lines = block.split('\n').map((line) => line.trimEnd())

      if (lines.every((line) => /^-\s+.+$/u.test(line.trim()))) {
        return `<ul>${lines
          .map((line) => `<li>${escapeHtml(line.trim().replace(/^-\s+/u, ''))}</li>`)
          .join('')}</ul>`
      }

      if (lines.every((line) => /^\d+\.\s+.+$/u.test(line.trim()))) {
        return `<ol>${lines
          .map((line) => `<li>${escapeHtml(line.trim().replace(/^\d+\.\s+/u, ''))}</li>`)
          .join('')}</ol>`
      }

      return renderParagraph(lines)
    })
    .join('')
}

const serializeInlineNodes = (nodes?: EditorJsonNode[]): string =>
  (nodes ?? [])
    .map((node) => {
      if (node.type === 'text') {
        return node.text ?? ''
      }

      if (node.type === 'hardBreak') {
        return '\n'
      }

      return serializeInlineNodes(node.content)
    })
    .join('')

const serializeListItem = (node: EditorJsonNode): string =>
  (node.content ?? [])
    .map((child) => {
      if (child.type === 'paragraph') {
        return serializeInlineNodes(child.content)
      }

      return serializeNode(child, 0)
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

const serializeNode = (node: EditorJsonNode, index: number): string => {
  if (node.type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? Number(node.attrs.level) : 1
    return `${'#'.repeat(Math.max(1, Math.min(level, 6)))} ${serializeInlineNodes(node.content).trim()}`
  }

  if (node.type === 'paragraph') {
    return serializeInlineNodes(node.content).trimEnd()
  }

  if (node.type === 'bulletList') {
    return (node.content ?? [])
      .map((item) => `- ${serializeListItem(item)}`)
      .join('\n')
  }

  if (node.type === 'orderedList') {
    return (node.content ?? [])
      .map((item, itemIndex) => `${itemIndex + 1}. ${serializeListItem(item)}`)
      .join('\n')
  }

  if (node.type === 'blockquote') {
    return (node.content ?? [])
      .map((child) => serializeNode(child, index))
      .filter(Boolean)
      .map((line) => `> ${line.replace(/\n+/g, ' ').trim()}`)
      .join('\n')
  }

  if (node.type === 'doc') {
    return (node.content ?? [])
      .map((child, childIndex) => serializeNode(child, childIndex))
      .filter((value) => value.trim().length > 0)
      .join('\n\n')
  }

  return serializeInlineNodes(node.content)
}

const serializeNarrativeDocument = (document: EditorJsonNode): string => withTrailingNewline(serializeNode(document, 0))

export const ChapterEditor = ({ content, onChange, onSave }: ChapterEditorProps) => {
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false)
  const lastExternalValueRef = useRef(withTrailingNewline(content))

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder: '正文会在这里继续生长。'
      })
    ],
    content: narrativeTextToHtml(content),
    editorProps: {
      attributes: {
        class: 'chapter-editor__content'
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextValue = serializeNarrativeDocument(currentEditor.getJSON() as EditorJsonNode)
      lastExternalValueRef.current = nextValue
      onChange(nextValue)
    }
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    const normalizedIncoming = withTrailingNewline(content)
    const normalizedCurrent = serializeNarrativeDocument(editor.getJSON() as EditorJsonNode)

    if (normalizedIncoming === normalizedCurrent || normalizedIncoming === lastExternalValueRef.current) {
      return
    }

    editor.commands.setContent(narrativeTextToHtml(content), false)
    lastExternalValueRef.current = normalizedIncoming
  }, [content, editor])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        onSave?.()
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [onSave])

  const toolbarActions = useMemo(
    () => [
      {
        id: 'heading-1',
        label: '章节',
        isActive: editor?.isActive('heading', { level: 1 }) ?? false,
        isDisabled: !(editor?.can().chain().focus().toggleHeading({ level: 1 }).run() ?? false),
        onClick: () => editor?.chain().focus().toggleHeading({ level: 1 }).run()
      },
      {
        id: 'heading-2',
        label: '小节',
        isActive: editor?.isActive('heading', { level: 2 }) ?? false,
        isDisabled: !(editor?.can().chain().focus().toggleHeading({ level: 2 }).run() ?? false),
        onClick: () => editor?.chain().focus().toggleHeading({ level: 2 }).run()
      },
      {
        id: 'paragraph',
        label: '正文',
        isActive: editor?.isActive('paragraph') ?? false,
        isDisabled: !(editor?.can().chain().focus().setParagraph().run() ?? false),
        onClick: () => editor?.chain().focus().setParagraph().run()
      },
      {
        id: 'bold',
        label: '强调',
        isActive: editor?.isActive('bold') ?? false,
        isDisabled: !(editor?.can().chain().focus().toggleBold().run() ?? false),
        onClick: () => editor?.chain().focus().toggleBold().run()
      },
      {
        id: 'bullet-list',
        label: '清单',
        isActive: editor?.isActive('bulletList') ?? false,
        isDisabled: !(editor?.can().chain().focus().toggleBulletList().run() ?? false),
        onClick: () => editor?.chain().focus().toggleBulletList().run()
      },
      {
        id: 'blockquote',
        label: '摘录',
        isActive: editor?.isActive('blockquote') ?? false,
        isDisabled: !(editor?.can().chain().focus().toggleBlockquote().run() ?? false),
        onClick: () => editor?.chain().focus().toggleBlockquote().run()
      }
    ],
    [editor]
  )

  const activeToolSummary = useMemo(() => {
    const activeLabels = toolbarActions.filter((action) => action.isActive).map((action) => action.label)
    return activeLabels.length > 0 ? activeLabels.join(' / ') : '正文'
  }, [toolbarActions])

  const bubbleActions = useMemo(() => toolbarActions, [toolbarActions])

  return (
    <div className="chapter-editor">
      <div className="chapter-editor__toolbar-shell">
        <div className="chapter-editor__toolbar-summary">
          <button
            type="button"
            className="chapter-editor__toolbar-toggle"
            aria-expanded={isToolbarExpanded}
            onClick={() => setIsToolbarExpanded((value) => !value)}
          >
            {isToolbarExpanded ? '收起格式' : '展开格式'}
          </button>
          <span className="chapter-editor__toolbar-state">当前：{activeToolSummary}</span>
          <span className="chapter-editor__toolbar-tip">Cmd/Ctrl+S 保存</span>
        </div>
        {isToolbarExpanded ? (
          <div className="chapter-editor__toolbar" role="toolbar" aria-label="正文格式工具">
            <div className="chapter-editor__toolbar-group">
              {toolbarActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={action.isActive ? 'chapter-editor__tool chapter-editor__tool--active' : 'chapter-editor__tool'}
                  disabled={action.isDisabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <div className="chapter-editor__toolbar-note">Tiptap Headless 已接入，保存协议仍保持纯文本章节文件。</div>
          </div>
        ) : null}
      </div>
      {editor ? (
        <BubbleMenu
          editor={editor}
          className="chapter-editor__bubble"
          updateDelay={0}
          tippyOptions={{
            duration: 120,
            placement: 'top',
            offset: [0, 10]
          }}
          shouldShow={({ editor: currentEditor, state, from, to }) =>
            currentEditor.isEditable && !state.selection.empty && from < to
          }
        >
          <div className="chapter-editor__bubble-group" role="toolbar" aria-label="选中文本格式工具">
            {bubbleActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={action.isActive ? 'chapter-editor__bubble-tool chapter-editor__bubble-tool--active' : 'chapter-editor__bubble-tool'}
                disabled={action.isDisabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
