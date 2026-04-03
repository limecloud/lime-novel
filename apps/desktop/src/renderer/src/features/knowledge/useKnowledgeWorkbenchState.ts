import { useEffect, useState } from 'react'
import type { KnowledgeDocumentDetailDto, KnowledgeDocumentDto, WorkspaceShellDto } from '@lime-novel/application'
import { desktopApi } from '../../lib/desktop-api'
import { knowledgeBucketDefinitions, type KnowledgeBucketFilterId } from './knowledge-model'

const findKnowledgeBucketDefinition = (bucket: KnowledgeBucketFilterId) =>
  knowledgeBucketDefinitions.find((item) => item.id === bucket)

const filterVisibleKnowledgeDocuments = (
  documents: KnowledgeDocumentDto[],
  bucket: KnowledgeBucketFilterId
): KnowledgeDocumentDto[] => {
  const definition = findKnowledgeBucketDefinition(bucket)

  return documents.filter((document) => definition?.match(document) ?? true)
}

export const useKnowledgeWorkbenchState = (shell: WorkspaceShellDto) => {
  const [selectedBucket, setSelectedBucket] = useState<KnowledgeBucketFilterId>('all')
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string | undefined>(shell.knowledgeDocuments[0]?.relativePath)
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocumentDetailDto>()
  const [knowledgeDocumentError, setKnowledgeDocumentError] = useState<string | null>(null)
  const [isKnowledgeDocumentLoading, setKnowledgeDocumentLoading] = useState(false)

  const visibleDocuments = filterVisibleKnowledgeDocuments(shell.knowledgeDocuments, selectedBucket)
  const selectedDocumentMetadata =
    visibleDocuments.find((document) => document.relativePath === selectedDocumentPath) ?? visibleDocuments[0]

  useEffect(() => {
    setSelectedBucket('all')
    setSelectedDocumentPath(shell.knowledgeDocuments[0]?.relativePath)
  }, [shell.workspacePath])

  useEffect(() => {
    if (visibleDocuments.length === 0) {
      if (selectedDocumentPath) {
        setSelectedDocumentPath(undefined)
      }
      return
    }

    if (!selectedDocumentPath || !visibleDocuments.some((document) => document.relativePath === selectedDocumentPath)) {
      setSelectedDocumentPath(visibleDocuments[0]?.relativePath)
    }
  }, [selectedDocumentPath, visibleDocuments])

  useEffect(() => {
    const relativePath = selectedDocumentMetadata?.relativePath

    if (!relativePath) {
      setSelectedDocument(undefined)
      setKnowledgeDocumentError(null)
      setKnowledgeDocumentLoading(false)
      return
    }

    let isCancelled = false
    setKnowledgeDocumentLoading(true)
    setKnowledgeDocumentError(null)

    void desktopApi.knowledge
      .loadDocument(relativePath)
      .then((document) => {
        if (!isCancelled) {
          setSelectedDocument(document)
        }
      })
      .catch((error) => {
        if (isCancelled) {
          return
        }

        setSelectedDocument(undefined)
        setKnowledgeDocumentError(error instanceof Error ? error.message : '当前知识页暂时无法读取。')
      })
      .finally(() => {
        if (!isCancelled) {
          setKnowledgeDocumentLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [selectedDocumentMetadata?.relativePath, shell.workspacePath])

  const handleBucketChange = (bucket: KnowledgeBucketFilterId): void => {
    setSelectedBucket(bucket)
  }

  const handleDocumentSelect = (relativePath: string): void => {
    const document = shell.knowledgeDocuments.find((item) => item.relativePath === relativePath)

    if (document) {
      const activeBucketDefinition = findKnowledgeBucketDefinition(selectedBucket)

      if (selectedBucket !== 'all' && !(activeBucketDefinition?.match(document) ?? true)) {
        setSelectedBucket(document.bucket)
      }
    }

    setSelectedDocumentPath(relativePath)
  }

  return {
    selectedBucket,
    selectedDocumentPath,
    selectedDocument,
    selectedDocumentMetadata,
    knowledgeDocumentError,
    isKnowledgeDocumentLoading,
    visibleDocuments,
    onBucketChange: handleBucketChange,
    onSelectDocument: handleDocumentSelect
  }
}
