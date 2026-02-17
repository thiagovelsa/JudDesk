import { create } from 'zustand'
import { executeQuery, executeInsert, executeUpdate, executeDelete } from '@/lib/db'
import { logActivity } from '@/lib/activityLogger'
import { triggerBackup } from '@/lib/autoBackup'
import { getErrorMessage } from '@/lib/errorUtils'
import type { Deadline } from '@/types'

/**
 * Safely converts SQLite boolean (INTEGER 0/1) to JavaScript boolean.
 * Handles both number and string representations that may come from the database driver.
 */
function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return false
}

interface DeadlineInput {
  title: string
  description?: string
  due_date: string
  reminder_date?: string
  priority?: 'baixa' | 'normal' | 'alta' | 'urgente'
  case_id?: number
  client_id?: number
}

interface DeadlineStore {
  deadlines: Deadline[]
  loading: boolean
  error: string | null

  fetchDeadlines: () => Promise<void>
  getDeadline: (id: number) => Promise<Deadline | null>
  createDeadline: (data: DeadlineInput) => Promise<Deadline>
  updateDeadline: (id: number, data: Partial<DeadlineInput>) => Promise<void>
  deleteDeadline: (id: number) => Promise<void>
  toggleComplete: (id: number) => Promise<void>
  getUpcomingDeadlines: (days: number) => Promise<Deadline[]>
  getOverdueDeadlines: () => Promise<Deadline[]>
  getDeadlinesByCase: (caseId: number) => Promise<Deadline[]>
  getDeadlinesByClient: (clientId: number) => Promise<Deadline[]>
}

export const useDeadlineStore = create<DeadlineStore>((set, get) => ({
  deadlines: [],
  loading: false,
  error: null,

  fetchDeadlines: async () => {
    set({ loading: true, error: null })
    try {
      const deadlines = await executeQuery<Deadline>(
        'SELECT * FROM deadlines ORDER BY due_date ASC',
        []
      )
      // Convert completed field from number to boolean
      const normalized = deadlines.map((d) => ({
        ...d,
        completed: toBool(d.completed),
      }))
      set({ deadlines: normalized, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  getDeadline: async (id: number) => {
    try {
      const deadlines = await executeQuery<Deadline>(
        'SELECT * FROM deadlines WHERE id = ?',
        [id]
      )
      if (deadlines[0]) {
        return { ...deadlines[0], completed: toBool(deadlines[0].completed) }
      }
      return null
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return null
    }
  },

  createDeadline: async (data: DeadlineInput) => {
    set({ loading: true, error: null })
    try {
      const id = await executeInsert(
        `INSERT INTO deadlines (title, description, due_date, reminder_date, priority, case_id, client_id, completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          data.title,
          data.description || null,
          data.due_date,
          data.reminder_date || null,
          data.priority || 'normal',
          data.case_id || null,
          data.client_id || null,
        ]
      )

      const deadlines = await executeQuery<Deadline>(
        'SELECT * FROM deadlines WHERE id = ?',
        [id]
      )
      const newDeadline = { ...deadlines[0], completed: toBool(deadlines[0].completed) }

      set((state) => ({
        deadlines: [...state.deadlines, newDeadline].sort(
          (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        ),
        loading: false,
      }))

      // Log activity
      await logActivity('deadline', newDeadline.id, 'create', newDeadline.title)
      triggerBackup()

      return newDeadline
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateDeadline: async (id: number, data: Partial<DeadlineInput>) => {
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
        values.push(id)

        await executeUpdate(
          `UPDATE deadlines SET ${fields.join(', ')} WHERE id = ?`,
          values
        )

        // Fetch only the updated deadline instead of all deadlines
        const updated = await executeQuery<Deadline>(
          'SELECT * FROM deadlines WHERE id = ?',
          [id]
        )

        if (updated[0]) {
          const normalizedDeadline = { ...updated[0], completed: toBool(updated[0].completed) }

          // Only re-sort if due_date was changed
          const needsSort = data.due_date !== undefined

          // Patch the deadline in local state
          set((state) => {
            const updatedDeadlines = state.deadlines.map((d) =>
              d.id === id ? normalizedDeadline : d
            )
            return {
              deadlines: needsSort
                ? updatedDeadlines.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                : updatedDeadlines,
              loading: false,
            }
          })

          // Log activity with changed fields
          await logActivity('deadline', id, 'update', normalizedDeadline.title, data)
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

  deleteDeadline: async (id: number) => {
    set({ loading: true, error: null })
    try {
      // Get deadline title before deletion for logging
      const deadline = await get().getDeadline(id)
      const deadlineTitle = deadline?.title

      await executeDelete('DELETE FROM deadlines WHERE id = ?', [id])
      set((state) => ({
        deadlines: state.deadlines.filter((d) => d.id !== id),
        loading: false,
      }))

      // Log activity
      await logActivity('deadline', id, 'delete', deadlineTitle)
      triggerBackup()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  toggleComplete: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const deadline = get().deadlines.find((d) => d.id === id)
      if (!deadline) {
        throw new Error('Prazo não encontrado')
      }

      const newCompleted = deadline.completed ? 0 : 1

      await executeUpdate(
        'UPDATE deadlines SET completed = ? WHERE id = ?',
        [newCompleted, id]
      )

      set((state) => ({
        deadlines: state.deadlines.map((d) =>
          d.id === id ? { ...d, completed: toBool(newCompleted) } : d
        ),
        loading: false,
      }))

      triggerBackup()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  getUpcomingDeadlines: async (days: number) => {
    try {
      const today = new Date()
      const futureDate = new Date(today)
      futureDate.setDate(today.getDate() + days)

      const todayStr = today.toISOString().split('T')[0]
      const futureDateStr = futureDate.toISOString().split('T')[0]

      const deadlines = await executeQuery<Deadline>(
        `SELECT * FROM deadlines
         WHERE completed = 0
         AND date(due_date) >= date(?)
         AND date(due_date) <= date(?)
         ORDER BY due_date ASC`,
        [todayStr, futureDateStr]
      )

      return deadlines.map((d) => ({ ...d, completed: toBool(d.completed) }))
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return []
    }
  },

  getOverdueDeadlines: async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const deadlines = await executeQuery<Deadline>(
        `SELECT * FROM deadlines
         WHERE completed = 0
         AND date(due_date) < date(?)
         ORDER BY due_date ASC`,
        [today]
      )

      return deadlines.map((d) => ({ ...d, completed: toBool(d.completed) }))
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return []
    }
  },

  getDeadlinesByCase: async (caseId: number) => {
    try {
      const deadlines = await executeQuery<Deadline>(
        'SELECT * FROM deadlines WHERE case_id = ? ORDER BY due_date ASC',
        [caseId]
      )
      return deadlines.map((d) => ({ ...d, completed: toBool(d.completed) }))
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return []
    }
  },

  getDeadlinesByClient: async (clientId: number) => {
    try {
      const deadlines = await executeQuery<Deadline>(
        'SELECT * FROM deadlines WHERE client_id = ? ORDER BY due_date ASC',
        [clientId]
      )
      return deadlines.map((d) => ({ ...d, completed: toBool(d.completed) }))
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return []
    }
  },
}))
