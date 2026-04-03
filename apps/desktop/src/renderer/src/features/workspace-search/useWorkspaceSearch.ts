import { useEffect, useRef, useState } from 'react'
import type { WorkspaceSearchItemDto } from '@lime-novel/application'
import { desktopApi } from '../../lib/desktop-api'

export const useWorkspaceSearch = (workspacePath: string) => {
  const [isOpen, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WorkspaceSearchItemDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSearching, setSearching] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
        return
      }

      if (event.key === 'Escape' && isOpen) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setError(null)
      setSearching(false)
      return
    }

    const nextQuery = query.trim()

    if (!nextQuery) {
      setResults([])
      setError(null)
      setSearching(false)
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const timer = window.setTimeout(() => {
      setSearching(true)
      void desktopApi.workspace
        .searchWorkspace({
          query: nextQuery,
          limit: 16
        })
        .then((result) => {
          if (requestIdRef.current !== requestId) {
            return
          }

          setResults(result.items)
          setError(null)
        })
        .catch((nextError) => {
          if (requestIdRef.current !== requestId) {
            return
          }

          setResults([])
          setError(nextError instanceof Error ? nextError.message : '当前工作区暂时无法完成搜索。')
        })
        .finally(() => {
          if (requestIdRef.current === requestId) {
            setSearching(false)
          }
        })
    }, 180)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isOpen, query, workspacePath])

  return {
    isOpen,
    query,
    results,
    error,
    isSearching,
    open: () => setOpen(true),
    close: () => setOpen(false),
    setQuery
  }
}
