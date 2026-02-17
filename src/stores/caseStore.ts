import { create } from 'zustand'
import { executeQuery, executeInsert, executeUpdate, executeDelete } from '@/lib/db'
import { logActivity } from '@/lib/activityLogger'
import { triggerBackup } from '@/lib/autoBackup'
import { getErrorMessage } from '@/lib/errorUtils'
import { cleanupAfterCaseDelete } from './cascadeCleanup'
import type { Case } from '@/types'

interface CaseInput {
  client_id: number
  title: string
  case_number?: string
  court?: string
  type?: string
  status?: 'ativo' | 'arquivado' | 'suspenso'
  description?: string
}

interface CaseStore {
  cases: Case[]
  loading: boolean
  error: string | null

  fetchCases: (clientId?: number) => Promise<void>
  getCase: (id: number) => Promise<Case | null>
  createCase: (data: CaseInput) => Promise<Case>
  updateCase: (id: number, data: Partial<CaseInput>) => Promise<void>
  deleteCase: (id: number) => Promise<void>
  searchCases: (query: string) => Promise<void>
  getCasesByClient: (clientId: number) => Promise<Case[]>
  getAllCaseCounts: () => Promise<Record<number, number>>
}

export const useCaseStore = create<CaseStore>((set, get) => ({
  cases: [],
  loading: false,
  error: null,

  fetchCases: async (clientId?: number) => {
    set({ loading: true, error: null })
    try {
      let query = 'SELECT * FROM cases'
      const params: unknown[] = []

      if (clientId !== undefined) {
        query += ' WHERE client_id = ?'
        params.push(clientId)
      }

      query += ' ORDER BY created_at DESC'

      const cases = await executeQuery<Case>(query, params)
      set({ cases, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  getCase: async (id: number) => {
    try {
      const cases = await executeQuery<Case>(
        'SELECT * FROM cases WHERE id = ?',
        [id]
      )
      return cases[0] || null
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return null
    }
  },

  createCase: async (data: CaseInput) => {
    set({ loading: true, error: null })
    try {
      const id = await executeInsert(
        `INSERT INTO cases (client_id, title, case_number, court, type, status, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.client_id,
          data.title,
          data.case_number || null,
          data.court || null,
          data.type || null,
          data.status || 'ativo',
          data.description || null,
        ]
      )

      const cases = await executeQuery<Case>(
        'SELECT * FROM cases WHERE id = ?',
        [id]
      )
      const newCase = cases[0]

      set((state) => ({
        cases: [newCase, ...state.cases],
        loading: false,
      }))

      // Log activity
      await logActivity('case', newCase.id, 'create', newCase.title)
      triggerBackup()

      return newCase
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateCase: async (id: number, data: Partial<CaseInput>) => {
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
          `UPDATE cases SET ${fields.join(', ')} WHERE id = ?`,
          values
        )

        // Fetch only the updated case instead of all cases
        const updated = await executeQuery<Case>(
          'SELECT * FROM cases WHERE id = ?',
          [id]
        )

        if (updated[0]) {
          // Patch the case in local state
          set((state) => ({
            cases: state.cases.map((c) =>
              c.id === id ? updated[0] : c
            ),
            loading: false,
          }))

          // Log activity with changed fields
          await logActivity('case', id, 'update', updated[0].title, data)
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

  deleteCase: async (id: number) => {
    set({ loading: true, error: null })
    try {
      // Get case title before deletion for logging
      const caseData = await get().getCase(id)
      const caseTitle = caseData?.title
      const caseFolders = await executeQuery<{ id: number }>(
        'SELECT id FROM document_folders WHERE case_id = ?',
        [id]
      )
      const caseFolderIds = new Set(caseFolders.map((folder) => folder.id))

      if (caseFolderIds.size > 0) {
        const placeholders = Array.from(caseFolderIds).map(() => '?').join(', ')
        await executeUpdate(
          `UPDATE documents SET folder_id = NULL WHERE folder_id IN (${placeholders})`,
          Array.from(caseFolderIds)
        )
      }

      await executeDelete('DELETE FROM cases WHERE id = ?', [id])
      set((state) => ({
        cases: state.cases.filter((c) => c.id !== id),
        loading: false,
      }))

      const cleanupResult = await cleanupAfterCaseDelete(id, Array.from(caseFolderIds))
      if (!cleanupResult.ok) {
        console.warn('[CaseStore] Partial cleanup after deleteCase:', cleanupResult.warnings)
      }

      // Log activity
      await logActivity('case', id, 'delete', caseTitle)
      triggerBackup()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  searchCases: async (query: string) => {
    set({ loading: true, error: null })
    try {
      const searchTerm = `%${query}%`
      const cases = await executeQuery<Case>(
        `SELECT * FROM cases
         WHERE title LIKE ? OR case_number LIKE ? OR court LIKE ?
         ORDER BY created_at DESC`,
        [searchTerm, searchTerm, searchTerm]
      )
      set({ cases, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  getCasesByClient: async (clientId: number) => {
    try {
      const cases = await executeQuery<Case>(
        'SELECT * FROM cases WHERE client_id = ? ORDER BY created_at DESC',
        [clientId]
      )
      return cases
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return []
    }
  },

  getAllCaseCounts: async () => {
    try {
      const results = await executeQuery<{ client_id: number; count: number }>(
        'SELECT client_id, COUNT(*) as count FROM cases GROUP BY client_id',
        []
      )
      const counts: Record<number, number> = {}
      results.forEach((row) => {
        counts[row.client_id] = row.count
      })
      return counts
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return {}
    }
  },
}))
