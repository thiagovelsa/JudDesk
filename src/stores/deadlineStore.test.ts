import { describe, it, expect, beforeEach } from 'vitest'
import { useDeadlineStore } from './deadlineStore'
import { mockDatabase, resetMocks, mockDatabaseSelect, mockDatabaseExecute } from '@/test/setup'
import type { Deadline } from '@/types'

describe('deadlineStore', () => {
  beforeEach(() => {
    resetMocks()
    // Reset store state
    useDeadlineStore.setState({
      deadlines: [],
      loading: false,
      error: null,
    })
  })

  describe('fetchDeadlines', () => {
    it('should fetch all deadlines from database', async () => {
      const mockDeadlines: Deadline[] = [
        {
          id: 1,
          case_id: 1,
          client_id: 1,
          title: 'Audiência Trabalhista',
          description: 'Audiência inicial',
          due_date: '2024-02-15T10:00:00Z',
          reminder_date: '2024-02-14T10:00:00Z',
          completed: false,
          priority: 'alta',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockDeadlines)

      await useDeadlineStore.getState().fetchDeadlines()

      const state = useDeadlineStore.getState()
      expect(state.deadlines).toEqual(mockDeadlines)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM deadlines ORDER BY due_date ASC',
        []
      )
    })

    it('should handle errors', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Database error'))

      await useDeadlineStore.getState().fetchDeadlines()

      const state = useDeadlineStore.getState()
      expect(state.deadlines).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBe('Database error')
    })
  })

  describe('getDeadline', () => {
    it('should get deadline by id', async () => {
      const mockDeadline: Deadline = {
        id: 1,
        case_id: 1,
        client_id: 1,
        title: 'Prazo Recurso',
        description: null,
        due_date: '2024-02-20T23:59:00Z',
        reminder_date: null,
        completed: false,
        priority: 'urgente',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseSelect([mockDeadline])

      const result = await useDeadlineStore.getState().getDeadline(1)

      expect(result).toEqual(mockDeadline)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM deadlines WHERE id = ?',
        [1]
      )
    })

    it('should return null if deadline not found', async () => {
      mockDatabaseSelect([])

      const result = await useDeadlineStore.getState().getDeadline(999)

      expect(result).toBeNull()
    })
  })

  describe('createDeadline', () => {
    it('should create a new deadline', async () => {
      const newDeadline = {
        title: 'Novo Prazo',
        description: 'Prazo para contestação',
        due_date: '2024-03-01T23:59:00Z',
        reminder_date: '2024-02-28T09:00:00Z',
        priority: 'alta' as const,
        case_id: 1,
        client_id: 1,
      }

      const createdDeadline: Deadline = {
        id: 1,
        ...newDeadline,
        completed: false,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseExecute(1, 1)
      mockDatabase.select.mockResolvedValueOnce([createdDeadline])

      const result = await useDeadlineStore.getState().createDeadline(newDeadline)

      expect(result).toEqual(createdDeadline)
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deadlines'),
        [
          newDeadline.title,
          newDeadline.description,
          newDeadline.due_date,
          newDeadline.reminder_date,
          newDeadline.priority,
          newDeadline.case_id,
          newDeadline.client_id,
        ]
      )

      const state = useDeadlineStore.getState()
      expect(state.deadlines).toContainEqual(createdDeadline)
    })

    it('should create deadline with minimal fields', async () => {
      const minimalDeadline = {
        title: 'Prazo Simples',
        due_date: '2024-03-15T23:59:00Z',
      }

      const createdDeadline: Deadline = {
        id: 1,
        case_id: null,
        client_id: null,
        title: 'Prazo Simples',
        description: null,
        due_date: '2024-03-15T23:59:00Z',
        reminder_date: null,
        completed: false,
        priority: 'normal',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseExecute(1, 1)
      mockDatabase.select.mockResolvedValueOnce([createdDeadline])

      const result = await useDeadlineStore.getState().createDeadline(minimalDeadline)

      expect(result).toEqual(createdDeadline)
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deadlines'),
        ['Prazo Simples', null, '2024-03-15T23:59:00Z', null, 'normal', null, null]
      )
    })

    it('should handle creation errors', async () => {
      mockDatabase.execute.mockRejectedValue(new Error('Insert failed'))

      await expect(
        useDeadlineStore.getState().createDeadline({
          title: 'Test',
          due_date: '2024-03-01T00:00:00Z',
        })
      ).rejects.toThrow('Insert failed')

      const state = useDeadlineStore.getState()
      expect(state.error).toBe('Insert failed')
    })
  })

  describe('updateDeadline', () => {
    it('should update an existing deadline', async () => {
      const updatedDeadlines: Deadline[] = [
        {
          id: 1,
          case_id: 1,
          client_id: 1,
          title: 'Título Atualizado',
          description: null,
          due_date: '2024-03-10T23:59:00Z',
          reminder_date: null,
          completed: false,
          priority: 'urgente',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseExecute(0, 1)
      mockDatabase.select.mockResolvedValueOnce(updatedDeadlines)

      await useDeadlineStore.getState().updateDeadline(1, {
        title: 'Título Atualizado',
        priority: 'urgente',
      })

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deadlines SET'),
        expect.arrayContaining(['Título Atualizado', 'urgente', 1])
      )
    })

    it('should not execute if no fields to update', async () => {
      mockDatabase.select.mockResolvedValueOnce([])

      await useDeadlineStore.getState().updateDeadline(1, {})

      expect(mockDatabase.execute).not.toHaveBeenCalled()
    })
  })

  describe('deleteDeadline', () => {
    it('should delete a deadline', async () => {
      useDeadlineStore.setState({
        deadlines: [
          {
            id: 1,
            case_id: null,
            client_id: null,
            title: 'Test Deadline',
            description: null,
            due_date: '2024-03-01T00:00:00Z',
            reminder_date: null,
            completed: false,
            priority: 'normal',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      })

      mockDatabaseExecute(0, 1)

      await useDeadlineStore.getState().deleteDeadline(1)

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'DELETE FROM deadlines WHERE id = ?',
        [1]
      )

      const state = useDeadlineStore.getState()
      expect(state.deadlines).toHaveLength(0)
    })
  })

  describe('toggleComplete', () => {
    it('should toggle deadline completion from false to true', async () => {
      useDeadlineStore.setState({
        deadlines: [
          {
            id: 1,
            case_id: null,
            client_id: null,
            title: 'Test Deadline',
            description: null,
            due_date: '2024-03-01T00:00:00Z',
            reminder_date: null,
            completed: false,
            priority: 'normal',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      })

      mockDatabaseExecute(0, 1)

      await useDeadlineStore.getState().toggleComplete(1)

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'UPDATE deadlines SET completed = ? WHERE id = ?',
        [1, 1]
      )

      const state = useDeadlineStore.getState()
      expect(state.deadlines[0].completed).toBe(true)
    })

    it('should toggle deadline completion from true to false', async () => {
      useDeadlineStore.setState({
        deadlines: [
          {
            id: 1,
            case_id: null,
            client_id: null,
            title: 'Test Deadline',
            description: null,
            due_date: '2024-03-01T00:00:00Z',
            reminder_date: null,
            completed: true,
            priority: 'normal',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      })

      mockDatabaseExecute(0, 1)

      await useDeadlineStore.getState().toggleComplete(1)

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'UPDATE deadlines SET completed = ? WHERE id = ?',
        [0, 1]
      )

      const state = useDeadlineStore.getState()
      expect(state.deadlines[0].completed).toBe(false)
    })

    it('should throw error if deadline not found', async () => {
      useDeadlineStore.setState({ deadlines: [] })

      await expect(
        useDeadlineStore.getState().toggleComplete(999)
      ).rejects.toThrow('Prazo não encontrado')
    })
  })

  describe('getUpcomingDeadlines', () => {
    it('should get upcoming deadlines within specified days', async () => {
      const mockDeadlines: Deadline[] = [
        {
          id: 1,
          case_id: null,
          client_id: null,
          title: 'Upcoming Deadline',
          description: null,
          due_date: '2024-02-10T00:00:00Z',
          reminder_date: null,
          completed: false,
          priority: 'normal',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockDeadlines)

      const result = await useDeadlineStore.getState().getUpcomingDeadlines(7)

      expect(result).toEqual(mockDeadlines)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        expect.stringContaining('WHERE completed = 0'),
        expect.any(Array)
      )
    })

    it('should return empty array on error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Query failed'))

      const result = await useDeadlineStore.getState().getUpcomingDeadlines(7)

      expect(result).toEqual([])
    })
  })

  describe('getOverdueDeadlines', () => {
    it('should get overdue deadlines', async () => {
      const mockDeadlines: Deadline[] = [
        {
          id: 1,
          case_id: null,
          client_id: null,
          title: 'Overdue Deadline',
          description: null,
          due_date: '2024-01-01T00:00:00Z',
          reminder_date: null,
          completed: false,
          priority: 'alta',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockDeadlines)

      const result = await useDeadlineStore.getState().getOverdueDeadlines()

      expect(result).toEqual(mockDeadlines)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        expect.stringContaining('WHERE completed = 0'),
        expect.any(Array)
      )
    })

    it('should return empty array on error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Query failed'))

      const result = await useDeadlineStore.getState().getOverdueDeadlines()

      expect(result).toEqual([])
    })
  })

  describe('getDeadlinesByCase', () => {
    it('should get deadlines by case id', async () => {
      const mockDeadlines: Deadline[] = [
        {
          id: 1,
          case_id: 5,
          client_id: null,
          title: 'Case Deadline',
          description: null,
          due_date: '2024-03-01T00:00:00Z',
          reminder_date: null,
          completed: false,
          priority: 'normal',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockDeadlines)

      const result = await useDeadlineStore.getState().getDeadlinesByCase(5)

      expect(result).toEqual(mockDeadlines)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM deadlines WHERE case_id = ? ORDER BY due_date ASC',
        [5]
      )
    })

    it('should return empty array on error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Query failed'))

      const result = await useDeadlineStore.getState().getDeadlinesByCase(5)

      expect(result).toEqual([])
    })
  })

  describe('getDeadlinesByClient', () => {
    it('should get deadlines by client id', async () => {
      const mockDeadlines: Deadline[] = [
        {
          id: 1,
          case_id: null,
          client_id: 3,
          title: 'Client Deadline',
          description: null,
          due_date: '2024-03-01T00:00:00Z',
          reminder_date: null,
          completed: false,
          priority: 'normal',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockDeadlines)

      const result = await useDeadlineStore.getState().getDeadlinesByClient(3)

      expect(result).toEqual(mockDeadlines)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM deadlines WHERE client_id = ? ORDER BY due_date ASC',
        [3]
      )
    })

    it('should return empty array on error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Query failed'))

      const result = await useDeadlineStore.getState().getDeadlinesByClient(3)

      expect(result).toEqual([])
    })
  })

  describe('updateDeadline error handling', () => {
    it('should throw and set error on database error', async () => {
      mockDatabase.execute.mockRejectedValue(new Error('Update failed'))

      await expect(
        useDeadlineStore.getState().updateDeadline(1, { title: 'New Title' })
      ).rejects.toThrow('Update failed')

      const state = useDeadlineStore.getState()
      expect(state.error).toBe('Update failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('deleteDeadline error handling', () => {
    it('should throw and set error on database error', async () => {
      // First mock getDeadline to return a deadline
      mockDatabase.select.mockResolvedValueOnce([{ id: 1, title: 'Test' }])
      // Then mock delete to fail
      mockDatabase.execute.mockRejectedValue(new Error('Delete failed'))

      await expect(
        useDeadlineStore.getState().deleteDeadline(1)
      ).rejects.toThrow('Delete failed')

      const state = useDeadlineStore.getState()
      expect(state.error).toBe('Delete failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('getDeadline error handling', () => {
    it('should set error and return null on database error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Connection lost'))

      const result = await useDeadlineStore.getState().getDeadline(1)

      expect(result).toBeNull()
      const state = useDeadlineStore.getState()
      expect(state.error).toBe('Connection lost')
    })
  })

  describe('toggleComplete error handling', () => {
    it('should throw and set error on database error', async () => {
      useDeadlineStore.setState({
        deadlines: [
          {
            id: 1,
            case_id: null,
            client_id: null,
            title: 'Test Deadline',
            description: null,
            due_date: '2024-03-01T00:00:00Z',
            reminder_date: null,
            completed: false,
            priority: 'normal',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      })

      mockDatabase.execute.mockRejectedValue(new Error('Toggle failed'))

      await expect(
        useDeadlineStore.getState().toggleComplete(1)
      ).rejects.toThrow('Toggle failed')

      const state = useDeadlineStore.getState()
      expect(state.error).toBe('Toggle failed')
      expect(state.loading).toBe(false)
    })
  })
})
