import { useEffect } from 'react'

type ChapterEditorProps = {
  content: string
  onChange: (value: string) => void
}

export const ChapterEditor = ({ content, onChange }: ChapterEditorProps) => {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [])

  return (
    <div className="chapter-editor">
      <textarea
        className="chapter-editor__textarea"
        value={content}
        onChange={(event) => onChange(event.target.value)}
        placeholder="正文会在这里继续生长。"
        spellCheck={false}
      />
    </div>
  )
}
