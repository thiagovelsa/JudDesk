import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock pdfjs-dist before importing modules that use it
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

const mockExtractFromBufferInBackground = vi.fn()
vi.mock('@/lib/extractionWorkerClient', () => ({
  extractFromBufferInBackground: (...args: unknown[]) =>
    mockExtractFromBufferInBackground(...args),
}))

import { useDocumentStore } from './documentStore'
import { mockDatabase, resetMocks, mockDatabaseSelect, mockDatabaseExecute } from '@/test/setup'
import type { Document } from '@/types'

describe('documentStore', () => {
  beforeEach(() => {
    resetMocks()
    mockExtractFromBufferInBackground.mockReset()
    // Reset store state
    useDocumentStore.setState({
      documents: [],
      loading: false,
      error: null,
      extractionProgress: null,
      extractedTextCache: new Map(),
    })
  })

  describe('fetchDocuments', () => {
    it('should fetch all documents with has_extracted_text flag', async () => {
      // Mock returns data as-is from the query (which includes has_extracted_text)
      const mockDocuments = [
        {
          id: 1,
          case_id: null,
          client_id: 1,
          name: 'contract.pdf',
          file_path: '/docs/contract.pdf',
          folder_id: 1,
          created_at: '2024-01-01T00:00:00Z',
          has_extracted_text: 0,
        },
      ]

      mockDatabaseSelect(mockDocuments)

      await useDocumentStore.getState().fetchDocuments()

      const state = useDocumentStore.getState()
      expect(state.documents).toHaveLength(1)
      expect(state.documents[0].name).toBe('contract.pdf')
      expect(state.loading).toBe(false)
      // The query now uses specific columns with has_extracted_text
      expect(mockDatabase.select).toHaveBeenCalledWith(
        expect.stringContaining('has_extracted_text'),
        []
      )
    })

    it('should filter documents by client_id', async () => {
      mockDatabaseSelect([])

      await useDocumentStore.getState().fetchDocuments(1)

      expect(mockDatabase.select).toHaveBeenCalledWith(
        expect.stringContaining('WHERE client_id = ?'),
        [1]
      )
    })

    it('should handle errors', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Database error'))

      await useDocumentStore.getState().fetchDocuments()

      const state = useDocumentStore.getState()
      expect(state.error).toBe('Database error')
    })
  })

  describe('getDocument', () => {
    it('should get document by id', async () => {
      const mockDocument: Document = {
        id: 1,
        case_id: null,
        client_id: 1,
        name: 'test.pdf',
        file_path: '/docs/test.pdf',
        extracted_text: 'Some text',
        folder_id: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseSelect([mockDocument])

      const result = await useDocumentStore.getState().getDocument(1)

      expect(result).toEqual(mockDocument)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM documents WHERE id = ?',
        [1]
      )
    })

    it('should return null if document not found', async () => {
      mockDatabaseSelect([])

      const result = await useDocumentStore.getState().getDocument(999)

      expect(result).toBeNull()
    })
  })

  describe('createDocument', () => {
    it('should create a new document', async () => {
      const newDoc: Document = {
        id: 1,
        case_id: null,
        client_id: 1,
        name: 'new.pdf',
        file_path: '/docs/new.pdf',
        extracted_text: null,
        folder_id: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseExecute(1, 1)
      mockDatabase.select.mockResolvedValueOnce([newDoc])

      const result = await useDocumentStore.getState().createDocument({
        client_id: 1,
        name: 'new.pdf',
        file_path: '/docs/new.pdf',
      })

      expect(result).toEqual(newDoc)
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO documents'),
        [1, null, 'new.pdf', '/docs/new.pdf', null]
      )

      const state = useDocumentStore.getState()
      expect(state.documents).toContainEqual(newDoc)
    })

    it('should create document with case_id and folder_id', async () => {
      const newDoc: Document = {
        id: 1,
        case_id: 5,
        client_id: 1,
        name: 'contrato.pdf',
        file_path: '/docs/contrato.pdf',
        extracted_text: null,
        folder_id: 2,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseExecute(1, 1)
      mockDatabase.select.mockResolvedValueOnce([newDoc])

      await useDocumentStore.getState().createDocument({
        client_id: 1,
        case_id: 5,
        name: 'contrato.pdf',
        file_path: '/docs/contrato.pdf',
        folder_id: 2,
      })

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.any(String),
        [1, 5, 'contrato.pdf', '/docs/contrato.pdf', 2]
      )
    })
  })

  describe('updateDocument', () => {
    it('should update document fields', async () => {
      mockDatabaseExecute(0, 1)
      mockDatabase.select.mockResolvedValueOnce([])

      await useDocumentStore.getState().updateDocument(1, {
        name: 'updated.pdf',
        folder_id: 3,
      })

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE documents SET'),
        expect.arrayContaining(['updated.pdf', 3, 1])
      )
    })

    it('should not execute if no fields to update', async () => {
      mockDatabase.select.mockResolvedValueOnce([])

      await useDocumentStore.getState().updateDocument(1, {})

      expect(mockDatabase.execute).not.toHaveBeenCalled()
    })
  })

  describe('deleteDocument', () => {
    it('should delete document', async () => {
      useDocumentStore.setState({
        documents: [
          {
            id: 1,
            case_id: null,
            client_id: 1,
            name: 'test.pdf',
            file_path: '/test.pdf',
            extracted_text: null,
            folder_id: null,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      })

      mockDatabaseExecute(0, 1)

      await useDocumentStore.getState().deleteDocument(1)

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'DELETE FROM documents WHERE id = ?',
        [1]
      )

      const state = useDocumentStore.getState()
      expect(state.documents).toHaveLength(0)
    })
  })

  describe('searchDocuments', () => {
    it('should search documents by name or extracted_text using FTS', async () => {
      // Mock FTS query result
      const ftsResults = [{ rowid: 1 }]
      
      // Mock main query result  
      const mockDbResults = [
        {
          id: 1,
          case_id: null,
          client_id: 1,
          name: 'contract.pdf',
          file_path: '/docs/contract.pdf',
          folder_id: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          has_extracted_text: 1, // Indicates text exists but not loaded
        },
      ]

      // First call is FTS query, second is actual data query
      mockDatabase.select
        .mockResolvedValueOnce(ftsResults)
        .mockResolvedValueOnce(mockDbResults)

      await useDocumentStore.getState().searchDocuments('contract')

      // Verify FTS query was called
      expect(mockDatabase.select).toHaveBeenNthCalledWith(1,
        expect.stringContaining('documents_fts MATCH'),
        ['contract'] // FTS query parameter (LIMIT is in the SQL itself)
      )

      const state = useDocumentStore.getState()
      // Documents should have lazy loading marker instead of actual text
      expect(state.documents).toEqual([
        {
          id: 1,
          case_id: null,
          client_id: 1,
          name: 'contract.pdf',
          file_path: '/docs/contract.pdf',
          folder_id: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          extracted_text: '__LAZY_LOAD__', // Lazy load marker
        },
      ])
    })
  })

  describe('getDocumentsByFolderId', () => {
    it('should get documents by folder_id', async () => {
      const mockDocs: Document[] = [
        {
          id: 1,
          case_id: null,
          client_id: 1,
          name: 'contrato.pdf',
          file_path: '/docs/contrato.pdf',
          extracted_text: null,
          folder_id: 2,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockDocs)

      const result = await useDocumentStore.getState().getDocumentsByFolderId(2)

      expect(result).toEqual(mockDocs)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM documents WHERE folder_id = ? ORDER BY created_at DESC',
        [2]
      )
    })

    it('should get all documents when folder_id is null', async () => {
      mockDatabaseSelect([])

      await useDocumentStore.getState().getDocumentsByFolderId(null)

      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM documents ORDER BY created_at DESC',
        []
      )
    })

    it('should handle errors and return empty array', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Database error'))

      const result = await useDocumentStore.getState().getDocumentsByFolderId(1)

      expect(result).toEqual([])
      const state = useDocumentStore.getState()
      expect(state.error).toBe('Database error')
    })
  })

  describe('getDocument error handling', () => {
    it('should handle errors and return null', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Database error'))

      const result = await useDocumentStore.getState().getDocument(1)

      expect(result).toBeNull()
      const state = useDocumentStore.getState()
      expect(state.error).toBe('Database error')
    })
  })

  describe('extractPDFText', () => {
    it('should throw error if document not found', async () => {
      mockDatabaseSelect([])

      await expect(
        useDocumentStore.getState().extractPDFText(999)
      ).rejects.toThrow('Documento não encontrado')

      const state = useDocumentStore.getState()
      expect(state.extractionProgress).toBeNull()
    })

    it('should throw error for non-PDF files', async () => {
      const mockDocument: Document = {
        id: 1,
        case_id: null,
        client_id: 1,
        name: 'document.docx',
        file_path: '/docs/document.docx',
        extracted_text: null,
        folder_id: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseSelect([mockDocument])

      await expect(
        useDocumentStore.getState().extractPDFText(1)
      ).rejects.toThrow('Somente arquivos PDF são suportados para extração')

      const state = useDocumentStore.getState()
      expect(state.extractionProgress).toBeNull()
    })
  })

  describe('extractDocumentText', () => {
    it('should extract using background worker and persist result', async () => {
      const mockDocument: Document = {
        id: 1,
        case_id: null,
        client_id: 1,
        name: 'document.pdf',
        file_path: '/docs/document.pdf',
        extracted_text: null,
        folder_id: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabase.select.mockResolvedValueOnce([mockDocument])
      mockExtractFromBufferInBackground.mockResolvedValue({
        text: 'Texto extraído',
        type: 'pdf',
      })

      const result = await useDocumentStore.getState().extractDocumentText(1)

      expect(result).toBe('Texto extraído')
      expect(mockExtractFromBufferInBackground).toHaveBeenCalled()
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE documents SET extracted_text'),
        ['Texto extraído', 1]
      )
    })
  })

  describe('getExtractedText', () => {
    it('should return cached text if available', async () => {
      const cache = new Map<number, string>()
      cache.set(1, 'Cached text content')

      useDocumentStore.setState({ extractedTextCache: cache })

      const result = await useDocumentStore.getState().getExtractedText(1)

      expect(result).toBe('Cached text content')
      // Should not make database call
      expect(mockDatabase.select).not.toHaveBeenCalled()
    })

    it('should load text from database and cache it', async () => {
      mockDatabaseSelect([{ extracted_text: 'Database text content' }])

      const result = await useDocumentStore.getState().getExtractedText(1)

      expect(result).toBe('Database text content')
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT extracted_text FROM documents WHERE id = ?',
        [1]
      )

      // Check that it was cached
      const state = useDocumentStore.getState()
      expect(state.extractedTextCache.get(1)).toBe('Database text content')
    })

    it('should return null if no text exists', async () => {
      mockDatabaseSelect([{ extracted_text: null }])

      const result = await useDocumentStore.getState().getExtractedText(1)

      expect(result).toBeNull()
    })

    it('should evict oldest entry when cache is full', async () => {
      // Fill cache to max size (10)
      const cache = new Map<number, string>()
      for (let i = 1; i <= 10; i++) {
        cache.set(i, `Text ${i}`)
      }
      useDocumentStore.setState({ extractedTextCache: cache })

      // Add one more entry
      mockDatabaseSelect([{ extracted_text: 'New text' }])
      await useDocumentStore.getState().getExtractedText(11)

      const state = useDocumentStore.getState()
      expect(state.extractedTextCache.size).toBe(10)
      expect(state.extractedTextCache.has(11)).toBe(true)
      expect(state.extractedTextCache.has(1)).toBe(false) // First entry evicted
    })

    it('should handle database errors', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Database error'))

      const result = await useDocumentStore.getState().getExtractedText(1)

      expect(result).toBeNull()
      const state = useDocumentStore.getState()
      expect(state.error).toBe('Database error')
    })
  })

  describe('clearExtractedTextCache', () => {
    it('should clear the cache', () => {
      const cache = new Map<number, string>()
      cache.set(1, 'Text 1')
      cache.set(2, 'Text 2')
      useDocumentStore.setState({ extractedTextCache: cache })

      useDocumentStore.getState().clearExtractedTextCache()

      const state = useDocumentStore.getState()
      expect(state.extractedTextCache.size).toBe(0)
    })
  })

  describe('fetchDocuments with has_extracted_text', () => {
    it('should set extracted_text to __LAZY_LOAD__ when has_extracted_text is 1', async () => {
      const mockDocuments = [
        {
          id: 1,
          case_id: null,
          client_id: 1,
          name: 'with-text.pdf',
          file_path: '/docs/with-text.pdf',
          folder_id: null,
          created_at: '2024-01-01T00:00:00Z',
          has_extracted_text: 1,
        },
        {
          id: 2,
          case_id: null,
          client_id: 1,
          name: 'without-text.pdf',
          file_path: '/docs/without-text.pdf',
          folder_id: null,
          created_at: '2024-01-01T00:00:00Z',
          has_extracted_text: 0,
        },
      ]

      mockDatabaseSelect(mockDocuments)

      await useDocumentStore.getState().fetchDocuments()

      const state = useDocumentStore.getState()
      expect(state.documents[0].extracted_text).toBe('__LAZY_LOAD__')
      expect(state.documents[1].extracted_text).toBeNull()
    })
  })

  describe('createDocument error handling', () => {
    it('should handle errors and set loading to false', async () => {
      mockDatabase.execute.mockRejectedValue(new Error('Insert failed'))

      await expect(
        useDocumentStore.getState().createDocument({
          client_id: 1,
          name: 'test.pdf',
          file_path: '/test.pdf',
        })
      ).rejects.toThrow('Insert failed')

      const state = useDocumentStore.getState()
      expect(state.error).toBe('Insert failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('updateDocument error handling', () => {
    it('should handle errors and set loading to false', async () => {
      mockDatabase.execute.mockRejectedValue(new Error('Update failed'))

      await expect(
        useDocumentStore.getState().updateDocument(1, { name: 'new.pdf' })
      ).rejects.toThrow('Update failed')

      const state = useDocumentStore.getState()
      expect(state.error).toBe('Update failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('deleteDocument error handling', () => {
    it('should handle errors and set loading to false', async () => {
      // First mock for getDocument
      mockDatabaseSelect([{ id: 1, name: 'test.pdf' }])
      // Then mock execute to fail
      mockDatabase.execute.mockRejectedValue(new Error('Delete failed'))

      await expect(
        useDocumentStore.getState().deleteDocument(1)
      ).rejects.toThrow('Delete failed')

      const state = useDocumentStore.getState()
      expect(state.error).toBe('Delete failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('searchDocuments error handling', () => {
    it('should handle errors', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Search failed'))

      await useDocumentStore.getState().searchDocuments('test')

      const state = useDocumentStore.getState()
      expect(state.error).toBe('Search failed')
      expect(state.loading).toBe(false)
    })
  })
})
