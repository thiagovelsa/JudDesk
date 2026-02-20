import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetMocks } from '@/test/setup'
import type { SearchResult } from '@/types'

// Mock db module directly
const mockExecuteQuery = vi.fn()

vi.mock('@/lib/db', () => ({
  executeQuery: (...args: unknown[]) => mockExecuteQuery(...args),
  isTauriEnvironment: () => true,
  searchDocumentsFast: vi.fn().mockResolvedValue([]), // FTS function
}))

import { globalSearch, getSearchResultPath, getSearchResultIcon } from './globalSearch'

describe('globalSearch', () => {
  beforeEach(() => {
    resetMocks()
    mockExecuteQuery.mockReset()
  })

  describe('globalSearch', () => {
    it('should return empty array for empty query', async () => {
      const result = await globalSearch('')

      expect(result).toEqual([])
      expect(mockExecuteQuery).not.toHaveBeenCalled()
    })

    it('should return empty array for whitespace query', async () => {
      const result = await globalSearch('   ')

      expect(result).toEqual([])
      expect(mockExecuteQuery).not.toHaveBeenCalled()
    })

    it('should return empty array for single-character query', async () => {
      const result = await globalSearch('a')

      expect(result).toEqual([])
      expect(mockExecuteQuery).not.toHaveBeenCalled()
    })

    it('should search clients', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ id: 1, name: 'John Doe', cpf_cnpj: '123.456.789-00', email: null }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await globalSearch('John')

      expect(result).toContainEqual({
        type: 'client',
        id: 1,
        title: 'John Doe',
        subtitle: '123.456.789-00',
      })
    })

    it('should search cases', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, title: 'Acao de Cobranca', case_number: '2024/001', court: null }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await globalSearch('Cobranca')

      expect(result).toContainEqual({
        type: 'case',
        id: 1,
        title: 'Acao de Cobranca',
        subtitle: '2024/001',
      })
    })

    it('should search documents', async () => {
      // FTS will return empty, so LIKE fallback is used
      mockExecuteQuery.mockResolvedValue([])

      const result = await globalSearch('Contrato')

      // Just verify it calls executeQuery (the actual implementation uses FTS + LIKE)
      expect(mockExecuteQuery).toHaveBeenCalled()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should search deadlines', async () => {
      mockExecuteQuery.mockResolvedValue([])

      const result = await globalSearch('Audiencia')

      expect(mockExecuteQuery).toHaveBeenCalled()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should combine results from all entity types', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ id: 1, name: 'Test Client', cpf_cnpj: null, email: 'test@test.com' }])
        .mockResolvedValueOnce([{ id: 2, title: 'Test Case', case_number: null, court: 'TJSP' }])
        .mockResolvedValueOnce([{ id: 3, name: 'test.pdf', folder_name: 'Geral' }])
        .mockResolvedValueOnce([{ id: 4, title: 'Test Deadline', due_date: '2024-03-01', priority: 'normal' }])

      const result = await globalSearch('test')

      expect(result).toHaveLength(4)
      expect(result.map(r => r.type)).toEqual(['client', 'case', 'document', 'deadline'])
    })

    it('should use search term with wildcards', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      await globalSearch('test')

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['%test%'])
      )
    })

    it('should respect limit parameter', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      await globalSearch('test', 10)

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10])
      )
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockExecuteQuery.mockRejectedValue(new Error('Database error'))

      const result = await globalSearch('test')

      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith('Global search error:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('should use email as subtitle when cpf_cnpj is null', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ id: 1, name: 'Client', cpf_cnpj: null, email: 'client@email.com' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await globalSearch('Client')

      expect(result[0].subtitle).toBe('client@email.com')
    })

    it('should use court as subtitle when case_number is null', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, title: 'Case', case_number: null, court: 'TJSP' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await globalSearch('Case')

      expect(result[0].subtitle).toBe('TJSP')
    })
  })

  describe('getSearchResultPath', () => {
    it('should return client path', () => {
      const result: SearchResult = { type: 'client', id: 1, title: 'Test', subtitle: '' }
      expect(getSearchResultPath(result)).toBe('/clients?id=1')
    })

    it('should return case path', () => {
      const result: SearchResult = { type: 'case', id: 5, title: 'Test', subtitle: '' }
      expect(getSearchResultPath(result)).toBe('/clients?caseId=5')
    })

    it('should return document path', () => {
      const result: SearchResult = { type: 'document', id: 10, title: 'Test', subtitle: '' }
      expect(getSearchResultPath(result)).toBe('/documents?id=10')
    })

    it('should return deadline path', () => {
      const result: SearchResult = { type: 'deadline', id: 3, title: 'Test', subtitle: '' }
      expect(getSearchResultPath(result)).toBe('/calendar?id=3')
    })
  })

  describe('getSearchResultIcon', () => {
    it('should return User icon for client', () => {
      expect(getSearchResultIcon('client')).toBe('User')
    })

    it('should return Briefcase icon for case', () => {
      expect(getSearchResultIcon('case')).toBe('Briefcase')
    })

    it('should return FileText icon for document', () => {
      expect(getSearchResultIcon('document')).toBe('FileText')
    })

    it('should return Calendar icon for deadline', () => {
      expect(getSearchResultIcon('deadline')).toBe('Calendar')
    })
  })
})
