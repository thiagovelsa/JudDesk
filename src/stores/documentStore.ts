import { create } from 'zustand'
import { executeQuery, executeInsert, executeUpdate, executeDelete, getDocumentsMetadata, getDocumentExtractedText, updateDocumentFTS, searchDocumentsFast } from '@/lib/db'
import { isSupportedFileType } from '@/lib/extractors'
import { extractTextFromPDFFile, createTextSummary } from '@/lib/pdf'
import { logActivity } from '@/lib/activityLogger'
import { triggerBackup } from '@/lib/autoBackup'
import { getErrorMessage } from '@/lib/errorUtils'
import { removeStoredDocumentFile } from '@/lib/documentStorage'
import { extractFromBufferInBackground } from '@/lib/extractionWorkerClient'
import type { Document } from '@/types'

/** Maximum number of extracted texts to keep in cache */
const EXTRACTED_TEXT_CACHE_SIZE = 10

interface DocumentInput {
  client_id: number
  case_id?: number
  name: string
  file_path: string
  folder_id?: number | null
}

interface DocumentStore {
  documents: Document[]
  loading: boolean
  error: string | null
  extractionProgress: number | null
  /** Cache for extracted texts (loaded on demand) */
  extractedTextCache: Map<number, string>

  fetchDocuments: (clientId?: number) => Promise<void>
  getDocument: (id: number) => Promise<Document | null>
  createDocument: (data: DocumentInput) => Promise<Document>
  updateDocument: (id: number, data: Partial<DocumentInput>) => Promise<void>
  deleteDocument: (id: number) => Promise<void>
  extractPDFText: (documentId: number) => Promise<string>
  extractDocumentText: (documentId: number) => Promise<string>
  searchDocuments: (query: string) => Promise<void>
  getDocumentsByFolderId: (folderId: number | null) => Promise<Document[]>
  /** Gets extracted text on demand with caching */
  getExtractedText: (documentId: number) => Promise<string | null>
  /** Clears the extracted text cache */
  clearExtractedTextCache: () => void
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  loading: false,
  error: null,
  extractionProgress: null,
  extractedTextCache: new Map<number, string>(),

  fetchDocuments: async (clientId?: number) => {
    set({ loading: true, error: null })
    try {
      // Use optimized query that excludes extracted_text
      const metadata = await getDocumentsMetadata(clientId)

      // Convert metadata to Document type (without extracted_text loaded)
      const documents: Document[] = metadata.map(m => ({
        id: m.id,
        case_id: m.case_id,
        client_id: m.client_id,
        name: m.name,
        file_path: m.file_path,
        folder_id: m.folder_id,
        created_at: m.created_at,
        updated_at: m.updated_at,
        // Mark if text exists but don't load it
        extracted_text: m.has_extracted_text ? '__LAZY_LOAD__' : null,
      }))

      set({ documents, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  getDocument: async (id: number) => {
    try {
      const documents = await executeQuery<Document>(
        'SELECT * FROM documents WHERE id = ?',
        [id]
      )
      return documents[0] || null
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return null
    }
  },

  createDocument: async (data: DocumentInput) => {
    set({ loading: true, error: null })
    try {
      const id = await executeInsert(
        `INSERT INTO documents (client_id, case_id, name, file_path, folder_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          data.client_id,
          data.case_id || null,
          data.name,
          data.file_path,
          data.folder_id ?? null,
        ]
      )

      const documents = await executeQuery<Document>(
        'SELECT * FROM documents WHERE id = ?',
        [id]
      )
      const newDocument = documents[0]

      set((state) => ({
        documents: [newDocument, ...state.documents],
        loading: false,
      }))

      await updateDocumentFTS(
        newDocument.id,
        newDocument.name,
        newDocument.extracted_text
      )

      // Log activity
      await logActivity('document', newDocument.id, 'create', newDocument.name)
      triggerBackup()

      return newDocument
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateDocument: async (id: number, data: Partial<DocumentInput>) => {
    set({ loading: true, error: null })
    try {
      const fields: string[] = []
      const values: unknown[] = []

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = ?`)
          values.push(value)
        }
      })

      if (fields.length > 0) {
        // Always update the updated_at timestamp
        fields.push('updated_at = CURRENT_TIMESTAMP')
        values.push(id)
        await executeUpdate(
          `UPDATE documents SET ${fields.join(', ')} WHERE id = ?`,
          values
        )

        // Fetch only the updated document (not all documents)
        const [updatedDoc] = await executeQuery<{
          id: number
          case_id: number | null
          client_id: number
          name: string
          file_path: string
          folder_id: number | null
          created_at: string
          updated_at: string
          has_extracted_text: number
        }>(
          `SELECT id, case_id, client_id, name, file_path, folder_id, created_at, updated_at,
           CASE WHEN extracted_text IS NOT NULL AND extracted_text != '' THEN 1 ELSE 0 END as has_extracted_text
           FROM documents WHERE id = ?`,
          [id]
        )

        if (updatedDoc) {
          // Convert to Document type
          const patchedDoc: Document = {
            id: updatedDoc.id,
            case_id: updatedDoc.case_id,
            client_id: updatedDoc.client_id,
            name: updatedDoc.name,
            file_path: updatedDoc.file_path,
            folder_id: updatedDoc.folder_id,
            created_at: updatedDoc.created_at,
            updated_at: updatedDoc.updated_at,
            extracted_text: updatedDoc.has_extracted_text ? '__LAZY_LOAD__' : null,
          }

          // Patch the document in local state
          set((state) => ({
            documents: state.documents.map((d) =>
              d.id === id ? patchedDoc : d
            ),
            loading: false,
          }))

          // Log activity with changed fields
          await logActivity('document', id, 'update', patchedDoc.name, data)

          if (data.name !== undefined) {
            const extractedText = await getDocumentExtractedText(id)
            await updateDocumentFTS(id, patchedDoc.name, extractedText)
          }
        } else {
          set({ loading: false })
        }

        triggerBackup()
      } else {
        set({ loading: false })
      }
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  deleteDocument: async (id: number) => {
    set({ loading: true, error: null })
    try {
      // Get document name before deletion for logging
      const doc = await get().getDocument(id)
      const docName = doc?.name

      await executeDelete('DELETE FROM documents WHERE id = ?', [id])
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
        extractedTextCache: new Map(
          [...state.extractedTextCache.entries()].filter(([docId]) => docId !== id)
        ),
        loading: false,
      }))

      // Best-effort cleanup of local file from AppData/documents/<clientId>/...
      await removeStoredDocumentFile(doc?.file_path)

      // Log activity
      await logActivity('document', id, 'delete', docName)
      triggerBackup()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  extractPDFText: async (documentId: number) => {
    set({ extractionProgress: 0, error: null })

    try {
      // Get document
      const document = await get().getDocument(documentId)
      if (!document) {
        throw new Error('Documento não encontrado')
      }

      // Check if it's a PDF
      if (!document.file_path.toLowerCase().endsWith('.pdf')) {
        throw new Error('Somente arquivos PDF são suportados para extração')
      }

      set({ extractionProgress: 20 })

      // Extract text
      const result = await extractTextFromPDFFile(document.file_path)

      set({ extractionProgress: 80 })

      // Save extracted text to database
      await executeUpdate(
        'UPDATE documents SET extracted_text = ? WHERE id = ?',
        [result.text, documentId]
      )

      // Update FTS index
      await updateDocumentFTS(documentId, document.name, result.text)

      set({ extractionProgress: 100 })

      // Update local state
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === documentId ? { ...d, extracted_text: result.text } : d
        ),
        extractionProgress: null,
      }))

      return result.text
    } catch (error) {
      set({
        error: getErrorMessage(error),
        extractionProgress: null,
      })
      throw error
    }
  },

  extractDocumentText: async (documentId: number) => {
    set({ error: null })

    try {
      const document = await get().getDocument(documentId)
      if (!document) {
        throw new Error('Documento não encontrado')
      }

      if (!isSupportedFileType(document.file_path)) {
        throw new Error('Tipo de arquivo não suportado para extração')
      }

      const { readFile } = await import('@tauri-apps/plugin-fs')
      const fileData = await readFile(document.file_path)
      const buffer = fileData.buffer.slice(
        fileData.byteOffset,
        fileData.byteOffset + fileData.byteLength
      )
      const fileName = document.file_path.split(/[/\\]/).pop() || document.file_path

      const result = await extractFromBufferInBackground(buffer, fileName)
      if (result.error) {
        throw new Error(result.error)
      }

      await executeUpdate(
        'UPDATE documents SET extracted_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [result.text, documentId]
      )

      await updateDocumentFTS(documentId, document.name, result.text)

      const { extractedTextCache } = get()
      const newCache = new Map(extractedTextCache)
      newCache.set(documentId, result.text)

      if (newCache.size > EXTRACTED_TEXT_CACHE_SIZE) {
        const firstKey = newCache.keys().next().value
        if (firstKey !== undefined) {
          newCache.delete(firstKey)
        }
      }

      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === documentId ? { ...d, extracted_text: result.text } : d
        ),
        extractedTextCache: newCache,
      }))

      return result.text
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },

  searchDocuments: async (query: string) => {
    set({ loading: true, error: null })
    try {
      const searchTerm = `%${query}%`
      
      // Try FTS-accelerated search first
      const candidateIds = await searchDocumentsFast(query)

      let results: Array<{
        id: number
        case_id: number | null
        client_id: number
        name: string
        file_path: string
        folder_id: number | null
        created_at: string
        updated_at: string
        has_extracted_text: number
      }>

      if (candidateIds.length > 0) {
        // FTS returned candidates - validate with LIKE on those IDs only
        const placeholders = candidateIds.map(() => '?').join(',')
        results = await executeQuery(
          `SELECT id, case_id, client_id, name, file_path, folder_id, created_at, updated_at,
           CASE WHEN extracted_text IS NOT NULL AND extracted_text != '' THEN 1 ELSE 0 END as has_extracted_text
           FROM documents
           WHERE id IN (${placeholders}) AND (name LIKE ? OR extracted_text LIKE ?)
           ORDER BY created_at DESC`,
          [...candidateIds, searchTerm, searchTerm]
        )
      } else {
        // No FTS candidates or FTS not available - fall back to full LIKE search
        results = await executeQuery(
          `SELECT id, case_id, client_id, name, file_path, folder_id, created_at, updated_at,
           CASE WHEN extracted_text IS NOT NULL AND extracted_text != '' THEN 1 ELSE 0 END as has_extracted_text
           FROM documents
           WHERE name LIKE ? OR extracted_text LIKE ?
           ORDER BY created_at DESC`,
          [searchTerm, searchTerm]
        )
      }

      // Convert to Document type with lazy loading marker
      const documents: Document[] = results.map(r => ({
        id: r.id,
        case_id: r.case_id,
        client_id: r.client_id,
        name: r.name,
        file_path: r.file_path,
        folder_id: r.folder_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        extracted_text: r.has_extracted_text === 1 ? '__LAZY_LOAD__' : null,
      }))

      set({ documents, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  getDocumentsByFolderId: async (folderId: number | null) => {
    try {
      let query = 'SELECT * FROM documents'
      const params: unknown[] = []

      if (folderId !== null) {
        query += ' WHERE folder_id = ?'
        params.push(folderId)
      }

      query += ' ORDER BY created_at DESC'

      const documents = await executeQuery<Document>(query, params)
      return documents
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return []
    }
  },

  getExtractedText: async (documentId: number) => {
    const { extractedTextCache } = get()

    // Check cache first
    if (extractedTextCache.has(documentId)) {
      return extractedTextCache.get(documentId)!
    }

    try {
      // Load from database
      const text = await getDocumentExtractedText(documentId)

      if (text !== null) {
        // Add to cache (including empty strings)
        const newCache = new Map(extractedTextCache)
        newCache.set(documentId, text)

        // Limit cache size (FIFO eviction)
        if (newCache.size > EXTRACTED_TEXT_CACHE_SIZE) {
          const firstKey = newCache.keys().next().value
          if (firstKey !== undefined) {
            newCache.delete(firstKey)
          }
        }

        set({ extractedTextCache: newCache })
      }

      return text
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return null
    }
  },

  clearExtractedTextCache: () => {
    set({ extractedTextCache: new Map<number, string>() })
  },
}))

// Helper to get summary of document text
export function getDocumentSummary(document: Document): string | null {
  if (!document.extracted_text) return null
  return createTextSummary(document.extracted_text, 300)
}
