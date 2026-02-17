import { describe, it, expect, beforeEach } from 'vitest'
import { useCaseStore } from './caseStore'
import { mockDatabase, resetMocks, mockDatabaseSelect, mockDatabaseExecute } from '@/test/setup'
import type { Case } from '@/types'

describe('caseStore', () => {
  beforeEach(() => {
    resetMocks()
    // Reset store state
    useCaseStore.setState({
      cases: [],
      loading: false,
      error: null,
    })
  })

  describe('fetchCases', () => {
    it('should fetch all cases from database', async () => {
      const mockCases: Case[] = [
        {
          id: 1,
          client_id: 1,
          title: 'Processo Trabalhista',
          case_number: '0001234-56.2024.5.01.0001',
          court: 'TRT 1a Região',
          type: 'trabalhista',
          status: 'ativo',
          description: 'Reclamação trabalhista',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockCases)

      await useCaseStore.getState().fetchCases()

      const state = useCaseStore.getState()
      expect(state.cases).toEqual(mockCases)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM cases ORDER BY created_at DESC',
        []
      )
    })

    it('should fetch cases filtered by client_id', async () => {
      mockDatabaseSelect([])

      await useCaseStore.getState().fetchCases(1)

      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM cases WHERE client_id = ? ORDER BY created_at DESC',
        [1]
      )
    })

    it('should handle errors', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Database error'))

      await useCaseStore.getState().fetchCases()

      const state = useCaseStore.getState()
      expect(state.cases).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBe('Database error')
    })
  })

  describe('getCase', () => {
    it('should get case by id', async () => {
      const mockCase: Case = {
        id: 1,
        client_id: 1,
        title: 'Processo Civil',
        case_number: '0001234-56.2024.8.19.0001',
        court: 'TJRJ',
        type: 'civil',
        status: 'ativo',
        description: 'Ação de cobrança',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseSelect([mockCase])

      const result = await useCaseStore.getState().getCase(1)

      expect(result).toEqual(mockCase)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM cases WHERE id = ?',
        [1]
      )
    })

    it('should return null if case not found', async () => {
      mockDatabaseSelect([])

      const result = await useCaseStore.getState().getCase(999)

      expect(result).toBeNull()
    })
  })

  describe('createCase', () => {
    it('should create a new case', async () => {
      const newCase = {
        client_id: 1,
        title: 'Novo Processo',
        case_number: '0009999-88.2024.8.19.0001',
        court: 'TJRJ',
        type: 'civil',
        description: 'Descrição do processo',
      }

      const createdCase: Case = {
        id: 1,
        ...newCase,
        status: 'ativo',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseExecute(1, 1)
      mockDatabase.select.mockResolvedValueOnce([createdCase])

      const result = await useCaseStore.getState().createCase(newCase)

      expect(result).toEqual(createdCase)
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cases'),
        [
          newCase.client_id,
          newCase.title,
          newCase.case_number,
          newCase.court,
          newCase.type,
          'ativo',
          newCase.description,
        ]
      )

      const state = useCaseStore.getState()
      expect(state.cases).toContainEqual(createdCase)
    })

    it('should create case with minimal fields', async () => {
      const minimalCase = {
        client_id: 1,
        title: 'Processo Simples',
      }

      const createdCase: Case = {
        id: 1,
        client_id: 1,
        title: 'Processo Simples',
        case_number: null,
        court: null,
        type: null,
        status: 'ativo',
        description: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseExecute(1, 1)
      mockDatabase.select.mockResolvedValueOnce([createdCase])

      const result = await useCaseStore.getState().createCase(minimalCase)

      expect(result).toEqual(createdCase)
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cases'),
        [1, 'Processo Simples', null, null, null, 'ativo', null]
      )
    })

    it('should handle creation errors', async () => {
      mockDatabase.execute.mockRejectedValue(new Error('Insert failed'))

      await expect(
        useCaseStore.getState().createCase({ client_id: 1, title: 'Test' })
      ).rejects.toThrow('Insert failed')

      const state = useCaseStore.getState()
      expect(state.error).toBe('Insert failed')
    })
  })

  describe('updateCase', () => {
    it('should update an existing case', async () => {
      const updatedCases: Case[] = [
        {
          id: 1,
          client_id: 1,
          title: 'Título Atualizado',
          case_number: '0001234-56.2024.8.19.0001',
          court: 'TJRJ',
          type: 'civil',
          status: 'arquivado',
          description: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseExecute(0, 1)
      mockDatabase.select.mockResolvedValueOnce(updatedCases)

      await useCaseStore.getState().updateCase(1, {
        title: 'Título Atualizado',
        status: 'arquivado',
      })

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE cases SET'),
        expect.arrayContaining(['Título Atualizado', 'arquivado', 1])
      )
    })

    it('should not execute if no fields to update', async () => {
      mockDatabase.select.mockResolvedValueOnce([])

      await useCaseStore.getState().updateCase(1, {})

      expect(mockDatabase.execute).not.toHaveBeenCalled()
    })
  })

  describe('deleteCase', () => {
    it('should delete a case', async () => {
      useCaseStore.setState({
        cases: [
          {
            id: 1,
            client_id: 1,
            title: 'Test Case',
            case_number: null,
            court: null,
            type: null,
            status: 'ativo',
            description: null,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      })

      mockDatabaseExecute(0, 1)

      await useCaseStore.getState().deleteCase(1)

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'DELETE FROM cases WHERE id = ?',
        [1]
      )

      const state = useCaseStore.getState()
      expect(state.cases).toHaveLength(0)
    })
  })

  describe('searchCases', () => {
    it('should search cases by title, case_number or court', async () => {
      const mockResults: Case[] = [
        {
          id: 1,
          client_id: 1,
          title: 'Processo Trabalhista',
          case_number: '0001234-56.2024.5.01.0001',
          court: 'TRT',
          type: 'trabalhista',
          status: 'ativo',
          description: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockResults)

      await useCaseStore.getState().searchCases('trabalhista')

      expect(mockDatabase.select).toHaveBeenCalledWith(
        expect.stringContaining('WHERE title LIKE ?'),
        ['%trabalhista%', '%trabalhista%', '%trabalhista%']
      )

      const state = useCaseStore.getState()
      expect(state.cases).toEqual(mockResults)
    })
  })

  describe('getCasesByClient', () => {
    it('should get cases by client id', async () => {
      const mockCases: Case[] = [
        {
          id: 1,
          client_id: 5,
          title: 'Processo do Cliente',
          case_number: null,
          court: null,
          type: null,
          status: 'ativo',
          description: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockCases)

      const result = await useCaseStore.getState().getCasesByClient(5)

      expect(result).toEqual(mockCases)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM cases WHERE client_id = ? ORDER BY created_at DESC',
        [5]
      )
    })

    it('should return empty array on error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Query failed'))

      const result = await useCaseStore.getState().getCasesByClient(5)

      expect(result).toEqual([])
    })
  })

  describe('getAllCaseCounts', () => {
    it('should return case counts grouped by client_id', async () => {
      const mockResults = [
        { client_id: 1, count: 5 },
        { client_id: 2, count: 3 },
        { client_id: 3, count: 10 },
      ]

      mockDatabaseSelect(mockResults)

      const result = await useCaseStore.getState().getAllCaseCounts()

      expect(result).toEqual({ 1: 5, 2: 3, 3: 10 })
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT client_id, COUNT(*) as count FROM cases GROUP BY client_id',
        []
      )
    })

    it('should return empty object on error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Query failed'))

      const result = await useCaseStore.getState().getAllCaseCounts()

      expect(result).toEqual({})
      const state = useCaseStore.getState()
      expect(state.error).toBe('Query failed')
    })

    it('should handle empty results', async () => {
      mockDatabaseSelect([])

      const result = await useCaseStore.getState().getAllCaseCounts()

      expect(result).toEqual({})
    })
  })

  describe('getCase error handling', () => {
    it('should set error and return null on database error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Connection lost'))

      const result = await useCaseStore.getState().getCase(1)

      expect(result).toBeNull()
      const state = useCaseStore.getState()
      expect(state.error).toBe('Connection lost')
    })
  })

  describe('searchCases error handling', () => {
    it('should set error on database error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Search failed'))

      await useCaseStore.getState().searchCases('test')

      const state = useCaseStore.getState()
      expect(state.error).toBe('Search failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('updateCase error handling', () => {
    it('should throw and set error on database error', async () => {
      mockDatabase.execute.mockRejectedValue(new Error('Update failed'))

      await expect(
        useCaseStore.getState().updateCase(1, { title: 'New Title' })
      ).rejects.toThrow('Update failed')

      const state = useCaseStore.getState()
      expect(state.error).toBe('Update failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('deleteCase error handling', () => {
    it('should throw and set error on database error', async () => {
      // First mock getCase to return a case
      mockDatabase.select.mockResolvedValueOnce([{ id: 1, title: 'Test' }])
      // Then mock delete to fail
      mockDatabase.execute.mockRejectedValue(new Error('Delete failed'))

      await expect(
        useCaseStore.getState().deleteCase(1)
      ).rejects.toThrow('Delete failed')

      const state = useCaseStore.getState()
      expect(state.error).toBe('Delete failed')
      expect(state.loading).toBe(false)
    })
  })
})
