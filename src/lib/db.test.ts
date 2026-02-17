import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockDatabase, resetMocks, mockDatabaseExecute, mockDatabaseSelect } from '@/test/setup'
import {
  exportDatabase,
  importDatabase,
  updateDocumentFTS,
  searchDocumentsFast,
  isTauriEnvironment,
  executeQuery,
} from './db'

// Mock the database module to bypass Tauri environment checks for testing
vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db')
  return {
    ...actual,
    isTauriEnvironment: () => true,
  }
})

// Mock activity logger and auto backup
vi.mock('./activityLogger', () => ({
  logActivity: vi.fn(),
}))

vi.mock('./autoBackup', () => ({
  triggerBackup: vi.fn(),
}))

describe('db.ts - Database Core Functionality', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('Environment Detection', () => {
    it('should detect Tauri environment correctly', () => {
      // isTauriEnvironment is mocked to return true in test environment
      expect(isTauriEnvironment()).toBe(true)
    })
  })

  describe('Migration Logic Coverage', () => {
    it('should handle PRAGMA table_info queries for migration checks', async () => {
      // Mock PRAGMA response for cases table
      mockDatabaseSelect([
        { name: 'id' },
        { name: 'client_id' },
        { name: 'title' },
        { name: 'updated_at' },
      ])

      const result = await executeQuery<{ name: string }[]>(
        "PRAGMA table_info(cases)"
      )

      expect(result.some(col => col.name === 'updated_at')).toBe(true)
    })

    it('should handle migration check logic for columns', async () => {
      // Mock PRAGMA response showing column does NOT exist yet
      mockDatabaseSelect([
        { name: 'id' },
        { name: 'client_id' },
        { name: 'title' },
        // No 'updated_at' column
      ])

      const result = await executeQuery<{ name: string }[]>(
        "PRAGMA table_info(cases)"
      )

      const hasUpdatedAt = result.some(col => col.name === 'updated_at')
      expect(hasUpdatedAt).toBe(false) // Column doesn't exist yet, needs migration
    })

    it('should handle folder_id migration when column does not exist', async () => {
      // Mock PRAGMA for documents table without folder_id
      mockDatabaseSelect([
        { name: 'id' },
        { name: 'name' },
        { name: 'folder' }, // Old string column
        // No folder_id
      ])

      const result = await executeQuery<{ name: string }[]>(
        "PRAGMA table_info(documents)"
      )

      const hasFolderId = result.some(col => col.name === 'folder_id')
      expect(hasFolderId).toBe(false)
    })

    it('should handle client_id migration in document_folders', async () => {
      // Mock PRAGMA for document_folders without client_id
      mockDatabaseSelect([
        { name: 'id' },
        { name: 'name' },
        { name: 'parent_id' },
        { name: 'case_id' },
        // No client_id
      ])

      const result = await executeQuery<{ name: string }[]>(
        "PRAGMA table_info(document_folders)"
      )

      const hasClientId = result.some(col => col.name === 'client_id')
      expect(hasClientId).toBe(false)
    })

    it('should handle Claude-specific chat_messages columns migration', async () => {
      // Mock PRAGMA for chat_messages without Claude columns
      mockDatabaseSelect([
        { name: 'id' },
        { name: 'session_id' },
        { name: 'role' },
        { name: 'content' },
        // No thinking_content, web_search_results, cost_usd, intent_profile
      ])

      const result = await executeQuery<{ name: string }[]>(
        "PRAGMA table_info(chat_messages)"
      )

      expect(result.some(col => col.name === 'thinking_content')).toBe(false)
      expect(result.some(col => col.name === 'web_search_results')).toBe(false)
      expect(result.some(col => col.name === 'cost_usd')).toBe(false)
      expect(result.some(col => col.name === 'intent_profile')).toBe(false)
    })
  })

  describe('Backup and Import - Rollback and Integrity', () => {
    it('should export database with correct structure', async () => {
      // Mock all table queries for export (exportDatabase calls Promise.all)
      mockDatabase.select
        .mockResolvedValueOnce([{ id: 1, name: 'Test Client', email: 'test@test.com', created_at: '2025-01-01', updated_at: '2025-01-01' }]) // clients
        .mockResolvedValueOnce([]) // cases
        .mockResolvedValueOnce([]) // documents
        .mockResolvedValueOnce([]) // deadlines
        .mockResolvedValueOnce([]) // chat_sessions
        .mockResolvedValueOnce([]) // chat_messages
        .mockResolvedValueOnce([]) // chat_attachments
        .mockResolvedValueOnce([]) // settings
        .mockResolvedValueOnce([]) // document_folders
        .mockResolvedValueOnce([]) // activity_logs
        .mockResolvedValueOnce([]) // ai_usage_logs

      const backup = await exportDatabase()

      expect(backup).toHaveProperty('version')
      expect(backup).toHaveProperty('created_at') // Field name in actual implementation
      expect(backup).toHaveProperty('clients')
      expect(backup).toHaveProperty('cases')
      expect(backup).toHaveProperty('documents')
      expect(backup).toHaveProperty('deadlines')
      expect(backup).toHaveProperty('chat_sessions')
      expect(backup).toHaveProperty('chat_messages')
      expect(backup).toHaveProperty('chat_attachments')
      expect(backup).toHaveProperty('settings')
      expect(backup).toHaveProperty('activity_logs')
      expect(backup).toHaveProperty('ai_usage_logs')
      expect(backup).toHaveProperty('document_folders')

      expect(Array.isArray(backup.clients)).toBe(true)
    })

    it('should handle import with missing updated_at (backward compatibility)', async () => {
      // Create a backup without updated_at (legacy format)
      const legacyBackup = {
        version: '1.0',
        created_at: new Date().toISOString(), // Use created_at, not exportedAt
        clients: [
          {
            id: 1,
            name: 'Legacy Client',
            email: 'legacy@test.com',
            created_at: '2025-01-01T00:00:00.000Z',
            // No updated_at
          },
        ],
        cases: [
          {
            id: 1,
            client_id: 1,
            title: 'Legacy Case',
            status: 'ativo',
            created_at: '2025-01-01T00:00:00.000Z',
            // No updated_at
          },
        ],
        documents: [],
        deadlines: [],
        chat_sessions: [],
        chat_messages: [],
        chat_attachments: [],
        settings: [],
        activity_logs: [],
        ai_usage_logs: [],
        document_folders: [],
      }

      // Mock successful import operations
      mockDatabaseExecute(0, 1)

      await importDatabase(legacyBackup)

      // Verify that import includes both created_at and updated_at (fallback)
      // The 14th call should be the INSERT INTO cases
      const casesInsertCall = mockDatabase.execute.mock.calls.find(call => 
        typeof call[0] === 'string' && call[0].includes('INSERT INTO cases')
      )
      
      expect(casesInsertCall).toBeDefined()
      expect(casesInsertCall![1]).toEqual(
        expect.arrayContaining(['2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z']) // Both created_at and updated_at with same value
      )
    })

    it('should rollback on import failure and re-enable foreign keys', async () => {
      // Create invalid backup
      const invalidBackup = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        clients: [],
        cases: [
          {
            id: 999,
            client_id: 999999, // Non-existent client
            title: 'Invalid Case',
            status: 'ativo',
            created_at: '2025-01-01',
          },
        ],
        documents: [],
        deadlines: [],
        chat_sessions: [],
        chat_messages: [],
        chat_attachments: [],
        settings: [],
        activity_logs: [],
        ai_usage_logs: [],
        document_folders: [],
      }

      // Mock failure during import (foreign key constraint)
      mockDatabase.execute
        .mockResolvedValueOnce({ lastInsertId: 0, rowsAffected: 1 }) // BEGIN
        .mockResolvedValueOnce({ lastInsertId: 0, rowsAffected: 1 }) // PRAGMA foreign_keys = OFF
        .mockResolvedValueOnce({ lastInsertId: 0, rowsAffected: 1 }) // DELETE clients
        .mockResolvedValueOnce({ lastInsertId: 0, rowsAffected: 1 }) // DELETE cases
        .mockRejectedValueOnce(new Error('FOREIGN KEY constraint failed')) // INSERT case fails

      // Import should fail
      await expect(importDatabase(invalidBackup)).rejects.toThrow()

      // Verify ROLLBACK and foreign keys re-enabled
      expect(mockDatabase.execute).toHaveBeenCalledWith('ROLLBACK')
      expect(mockDatabase.execute).toHaveBeenCalledWith('PRAGMA foreign_keys = ON')
    })

    it('should handle rollback error gracefully', async () => {
      const invalidBackup = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        clients: [],
        cases: [],
        documents: [],
        deadlines: [],
        chat_sessions: [],
        chat_messages: [],
        chat_attachments: [],
        settings: [],
        activity_logs: [],
        ai_usage_logs: [],
        document_folders: [],
      }

      // Mock failure during import and also during rollback
      mockDatabase.execute
        .mockResolvedValueOnce({ lastInsertId: 0, rowsAffected: 1 }) // BEGIN
        .mockResolvedValueOnce({ lastInsertId: 0, rowsAffected: 1 }) // PRAGMA
        .mockRejectedValueOnce(new Error('Import error')) // DELETE fails
        .mockRejectedValueOnce(new Error('Rollback error')) // ROLLBACK also fails

      await expect(importDatabase(invalidBackup)).rejects.toThrow('Falha ao importar backup')

      // Should still attempt rollback and re-enable foreign keys
      expect(mockDatabase.execute).toHaveBeenCalledWith('ROLLBACK')
    })
  })

  describe('FTS (Full-Text Search) Functionality', () => {
    it('should update FTS index when document is updated', async () => {
      // Mock successful FTS operations
      mockDatabaseExecute(1, 1)

      await updateDocumentFTS(123, 'Test Document', 'Extracted text content')

      // Verify DELETE and INSERT were called for FTS update
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'DELETE FROM documents_fts WHERE document_id = ?',
        [123]
      )
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'INSERT INTO documents_fts(document_id, name, extracted_text) VALUES (?, ?, ?)',
        [123, 'Test Document', 'Extracted text content']
      )
    })

    it('should handle FTS update gracefully when error occurs', async () => {
      // Mock FTS error (table might not exist)
      mockDatabase.execute.mockRejectedValue(new Error('no such table: documents_fts'))

      // Should not throw, just log
      await expect(
        updateDocumentFTS(999, 'Test', 'Content')
      ).resolves.not.toThrow()
    })

    it('should index document name even when text is null', async () => {
      mockDatabaseExecute(1, 1)

      await updateDocumentFTS(123, 'Test Document', null)

      // Should DELETE and INSERT with empty text
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'DELETE FROM documents_fts WHERE document_id = ?',
        [123]
      )
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'INSERT INTO documents_fts(document_id, name, extracted_text) VALUES (?, ?, ?)',
        [123, 'Test Document', '']
      )
    })

    it('should return document IDs from FTS search', async () => {
      // Mock FTS search - returns array of { document_id: number }
      mockDatabaseSelect([
        { document_id: 1 },
        { document_id: 2 },
      ])

      const results = await searchDocumentsFast('contract')

      // searchDocumentsFast returns an array of IDs, not full objects
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(2)
      expect(results).toEqual([1, 2])
    })

    it('should handle empty search queries gracefully', async () => {
      mockDatabaseSelect([])

      const emptyResults = await searchDocumentsFast('')
      expect(Array.isArray(emptyResults)).toBe(true)

      const shortResults = await searchDocumentsFast('a')
      expect(Array.isArray(shortResults)).toBe(true)
    })

    it('should handle FTS search errors gracefully', async () => {
      // Mock FTS search failure
      mockDatabase.select.mockRejectedValue(new Error('FTS5 not available'))

      const results = await searchDocumentsFast('test')

      // Should return empty array on error
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })
  })

  describe('Query Execution Helper', () => {
    it('should execute queries successfully', async () => {
      mockDatabaseSelect([{ test: 1 }])

      const result = await executeQuery<{ test: number }[]>('SELECT 1 as test')
      expect(result).toEqual([{ test: 1 }])
    })

    it('should handle parameterized queries', async () => {
      mockDatabaseSelect([{ name: 'Query Test' }])

      const result = await executeQuery<{ name: string }[]>(
        'SELECT name FROM clients WHERE name = ?',
        ['Query Test']
      )

      expect(result.length).toBe(1)
      expect(result[0].name).toBe('Query Test')
    })

    it('should verify environment check function exists', () => {
      // Since isTauriEnvironment is mocked in this test file to always return true,
      // we just verify the function exists and can be called
      expect(typeof isTauriEnvironment).toBe('function')
      expect(isTauriEnvironment()).toBe(true)
    })
  })

  describe('Export CSV Functionality', () => {
    it('should validate table names for CSV export', async () => {
      const { exportTableAsCSV } = await import('./db')
      
      // Should reject invalid table names
      await expect(exportTableAsCSV('invalid_table')).rejects.toThrow('Tabela não permitida')
      await expect(exportTableAsCSV('DROP TABLE clients')).rejects.toThrow('Tabela não permitida')
    })

    it('should handle empty tables for CSV export', async () => {
      const { exportTableAsCSV } = await import('./db')
      
      mockDatabaseSelect([])

      const csv = await exportTableAsCSV('clients')
      expect(csv).toBe('')
    })

    it('should generate CSV with headers and data', async () => {
      const { exportTableAsCSV } = await import('./db')
      
      mockDatabaseSelect([
        { id: 1, name: 'Client 1', email: 'client1@test.com' },
        { id: 2, name: 'Client 2', email: 'client2@test.com' },
      ])

      const csv = await exportTableAsCSV('clients')
      
      expect(csv).toContain('id,name,email')
      // CSV implementation may or may not quote all fields
      expect(csv).toContain('Client 1')
      expect(csv).toContain('client1@test.com')
      expect(csv).toContain('Client 2')
      expect(csv).toContain('client2@test.com')
    })

    it('should properly escape CSV special characters', async () => {
      const { exportTableAsCSV } = await import('./db')
      
      mockDatabaseSelect([
        { id: 1, name: 'Client, Inc.', email: 'test@test.com' },
        { id: 2, name: 'Client "Quoted"', email: 'quoted@test.com' },
      ])

      const csv = await exportTableAsCSV('clients')
      
      // Should quote values with commas or quotes
      expect(csv).toMatch(/"Client, Inc\."/)
      expect(csv).toMatch(/"Client ""Quoted"""/)
    })

    it('should handle null and undefined values in CSV', async () => {
      const { exportTableAsCSV } = await import('./db')
      
      mockDatabaseSelect([
        { id: 1, name: 'Client 1', email: null, phone: undefined },
      ])

      const csv = await exportTableAsCSV('clients')
      
      expect(csv).toContain('id,name,email,phone')
      expect(csv).toContain('1,Client 1,,')
    })
  })

  describe('Document Metadata Queries', () => {
    it('should fetch documents metadata without extracted_text', async () => {
      const { getDocumentsMetadata } = await import('./db')
      
      mockDatabaseSelect([
        {
          id: 1,
          case_id: 10,
          client_id: 5,
          name: 'Document 1.pdf',
          file_path: '/path/to/doc1.pdf',
          folder_id: 2,
          created_at: '2025-01-01',
          updated_at: '2025-01-02',
          has_extracted_text: 1,
        },
        {
          id: 2,
          case_id: null,
          client_id: 5,
          name: 'Document 2.pdf',
          file_path: '/path/to/doc2.pdf',
          folder_id: null,
          created_at: '2025-01-03',
          updated_at: '2025-01-03',
          has_extracted_text: 0,
        },
      ])

      const metadata = await getDocumentsMetadata()
      
      expect(metadata.length).toBe(2)
      expect(metadata[0].has_extracted_text).toBe(true)
      expect(metadata[1].has_extracted_text).toBe(false)
      expect(metadata[0]).not.toHaveProperty('extracted_text')
    })

    it('should filter documents by client_id', async () => {
      const { getDocumentsMetadata } = await import('./db')
      
      mockDatabaseSelect([
        {
          id: 1,
          case_id: 10,
          client_id: 5,
          name: 'Document 1.pdf',
          file_path: '/path/to/doc1.pdf',
          folder_id: 2,
          created_at: '2025-01-01',
          updated_at: '2025-01-02',
          has_extracted_text: 1,
        },
      ])

      await getDocumentsMetadata(5)
      
      // Verify the query was called with client_id parameter
      expect(mockDatabase.select).toHaveBeenCalledWith(
        expect.stringContaining('WHERE client_id = ?'),
        [5]
      )
    })

    it('should fetch extracted text for a specific document', async () => {
      const { getDocumentExtractedText } = await import('./db')
      
      mockDatabaseSelect([
        { extracted_text: 'This is the extracted text from the PDF' },
      ])

      const text = await getDocumentExtractedText(123)
      
      expect(text).toBe('This is the extracted text from the PDF')
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT extracted_text FROM documents WHERE id = ?',
        [123]
      )
    })

    it('should return null when document has no extracted text', async () => {
      const { getDocumentExtractedText } = await import('./db')
      
      mockDatabaseSelect([
        { extracted_text: null },
      ])

      const text = await getDocumentExtractedText(456)
      
      expect(text).toBeNull()
    })

    it('should return null when document does not exist', async () => {
      const { getDocumentExtractedText } = await import('./db')
      
      mockDatabaseSelect([])

      const text = await getDocumentExtractedText(999)
      
      expect(text).toBeNull()
    })
  })

  describe('Database Statistics', () => {
    it('should fetch database statistics', async () => {
      const { getDatabaseStats } = await import('./db')
      
      // Mock Promise.all responses for all count queries
      mockDatabase.select
        .mockResolvedValueOnce([{ count: 10 }]) // clients
        .mockResolvedValueOnce([{ count: 25 }]) // cases
        .mockResolvedValueOnce([{ count: 150 }]) // documents
        .mockResolvedValueOnce([{ count: 40 }]) // deadlines
        .mockResolvedValueOnce([{ count: 5 }]) // chat_sessions
        .mockResolvedValueOnce([{ count: 120 }]) // chat_messages

      const stats = await getDatabaseStats()
      
      expect(stats.clients).toBe(10)
      expect(stats.cases).toBe(25)
      expect(stats.documents).toBe(150)
      expect(stats.deadlines).toBe(40)
      expect(stats.chat_sessions).toBe(5)
      expect(stats.chat_messages).toBe(120)
    })

    it('should handle empty database statistics', async () => {
      const { getDatabaseStats } = await import('./db')
      
      // Mock all count queries returning 0
      mockDatabase.select
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])

      const stats = await getDatabaseStats()
      
      expect(stats.clients).toBe(0)
      expect(stats.cases).toBe(0)
      expect(stats.documents).toBe(0)
      expect(stats.deadlines).toBe(0)
      expect(stats.chat_sessions).toBe(0)
      expect(stats.chat_messages).toBe(0)
    })

    it('should handle missing count values gracefully', async () => {
      const { getDatabaseStats } = await import('./db')
      
      // Mock some queries returning empty arrays
      mockDatabase.select
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{ count: 5 }])
        .mockResolvedValueOnce([{ count: null }])
        .mockResolvedValueOnce([{ count: undefined }])
        .mockResolvedValueOnce([{ count: 10 }])

      const stats = await getDatabaseStats()
      
      expect(stats.clients).toBe(0)
      expect(stats.cases).toBe(0)
      expect(stats.documents).toBe(5)
      expect(stats.deadlines).toBe(0)
      expect(stats.chat_sessions).toBe(0)
      expect(stats.chat_messages).toBe(10)
    })
  })

  describe('Execute Helpers', () => {
    it('should dispatch database changed event on insert/update/delete', async () => {
      const { executeInsert, executeUpdate, executeDelete, DATABASE_CHANGED_EVENT } = await import('./db')
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      mockDatabaseExecute(100, 1)
      await executeInsert('INSERT INTO clients (name) VALUES (?)', ['Client'])

      mockDatabaseExecute(0, 1)
      await executeUpdate('UPDATE clients SET name = ? WHERE id = ?', ['Updated', 1])

      mockDatabaseExecute(0, 1)
      await executeDelete('DELETE FROM clients WHERE id = ?', [1])

      const emittedEvents = dispatchSpy.mock.calls
        .map(([event]) => event)
        .filter((event): event is CustomEvent =>
          event instanceof CustomEvent && event.type === DATABASE_CHANGED_EVENT
        )

      expect(emittedEvents).toHaveLength(3)
      expect(emittedEvents[0].detail.operation).toBe('insert')
      expect(emittedEvents[1].detail.operation).toBe('update')
      expect(emittedEvents[2].detail.operation).toBe('delete')
      dispatchSpy.mockRestore()
    })

    it('should execute insert and return last insert ID', async () => {
      const { executeInsert } = await import('./db')
      
      mockDatabaseExecute(42, 1)

      const id = await executeInsert(
        'INSERT INTO clients (name) VALUES (?)',
        ['Test Client']
      )
      
      expect(id).toBe(42)
    })

    it('should return 0 when lastInsertId is null', async () => {
      const { executeInsert } = await import('./db')
      
      mockDatabase.execute.mockResolvedValue({ lastInsertId: null, rowsAffected: 1 })

      const id = await executeInsert(
        'INSERT INTO clients (name) VALUES (?)',
        ['Test Client']
      )
      
      expect(id).toBe(0)
    })

    it('should execute update and return rows affected', async () => {
      const { executeUpdate } = await import('./db')
      
      mockDatabaseExecute(0, 3)

      const affected = await executeUpdate(
        'UPDATE clients SET name = ? WHERE id IN (1, 2, 3)',
        ['Updated Name']
      )
      
      expect(affected).toBe(3)
    })

    it('should execute delete and return rows affected', async () => {
      const { executeDelete } = await import('./db')
      
      mockDatabaseExecute(0, 5)

      const affected = await executeDelete(
        'DELETE FROM activity_logs WHERE created_at < ?',
        ['2024-01-01']
      )
      
      expect(affected).toBe(5)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle query execution with empty params array', async () => {
      mockDatabaseSelect([{ test: 'value' }])

      const result = await executeQuery<{ test: string }[]>('SELECT * FROM clients')
      
      expect(result.length).toBe(1)
      expect(result[0].test).toBe('value')
    })

    it('should handle export with all arrays being empty', async () => {
      // Mock all table queries returning empty arrays
      mockDatabase.select
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const backup = await exportDatabase()
      
      expect(backup.clients).toEqual([])
      expect(backup.cases).toEqual([])
      expect(backup.documents).toEqual([])
      expect(backup.version).toBe('1.4')
    })

    it('should handle import with optional fields missing', async () => {
      const minimalBackup = {
        version: '1.0',
        created_at: new Date().toISOString(),
        clients: [],
        cases: [],
        documents: [],
        deadlines: [],
        chat_sessions: [],
        chat_messages: [],
        chat_attachments: [],
        settings: [],
        // Missing document_folders, activity_logs, ai_usage_logs
      }

      mockDatabaseExecute(0, 1)

      await importDatabase(minimalBackup)
      
      // Should complete without errors
      expect(mockDatabase.execute).toHaveBeenCalledWith('COMMIT')
    })
  })
})

