import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetMocks } from '@/test/setup'
import type { ActivityLog } from '@/types'

// Mock db module directly
const mockExecuteQuery = vi.fn()
const mockExecuteInsert = vi.fn()

vi.mock('@/lib/db', () => ({
  executeQuery: (...args: unknown[]) => mockExecuteQuery(...args),
  executeInsert: (...args: unknown[]) => mockExecuteInsert(...args),
  isTauriEnvironment: () => true,
}))

import {
  logActivity,
  getActivityLogs,
  getEntityHistory,
  getRecentActivities,
  formatAction,
  formatEntityType,
  parseActivityDetails,
} from './activityLogger'

describe('activityLogger', () => {
  beforeEach(() => {
    resetMocks()
    mockExecuteQuery.mockReset()
    mockExecuteInsert.mockReset()
    mockExecuteInsert.mockResolvedValue(1)
  })

  describe('logActivity', () => {
    it('should insert activity log into database', async () => {
      await logActivity('client', 1, 'create', 'Test Client')

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_logs'),
        ['client', 1, 'create', 'Test Client', null]
      )
    })

    it('should include details as JSON when provided', async () => {
      await logActivity('client', 1, 'update', 'Test Client', { name: 'New Name' })

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_logs'),
        ['client', 1, 'update', 'Test Client', '{"name":"New Name"}']
      )
    })

    it('should handle null entity name', async () => {
      await logActivity('document', 5, 'delete')

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_logs'),
        ['document', 5, 'delete', null, null]
      )
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockExecuteInsert.mockRejectedValue(new Error('Database error'))

      await logActivity('case', 1, 'create', 'Test Case')

      expect(consoleSpy).toHaveBeenCalledWith('Failed to log activity:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('getActivityLogs', () => {
    const mockLogs: ActivityLog[] = [
      {
        id: 1,
        entity_type: 'client',
        entity_id: 1,
        action: 'create',
        entity_name: 'Test Client',
        details: null,
        created_at: '2024-01-15T10:00:00Z',
      },
      {
        id: 2,
        entity_type: 'case',
        entity_id: 1,
        action: 'update',
        entity_name: 'Test Case',
        details: '{"status":"ativo"}',
        created_at: '2024-01-15T11:00:00Z',
      },
    ]

    it('should fetch all activity logs', async () => {
      mockExecuteQuery.mockResolvedValue(mockLogs)

      const result = await getActivityLogs()

      expect(result).toEqual(mockLogs)
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM activity_logs'),
        []
      )
    })

    it('should filter by entity type', async () => {
      mockExecuteQuery.mockResolvedValue([mockLogs[0]])

      const result = await getActivityLogs({ entityType: 'client' })

      expect(result).toHaveLength(1)
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND entity_type = ?'),
        ['client']
      )
    })

    it('should filter by entity id', async () => {
      mockExecuteQuery.mockResolvedValue([mockLogs[0]])

      const result = await getActivityLogs({ entityId: 1 })

      expect(result).toHaveLength(1)
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND entity_id = ?'),
        [1]
      )
    })

    it('should filter by date range', async () => {
      mockExecuteQuery.mockResolvedValue(mockLogs)

      await getActivityLogs({ startDate: '2024-01-01', endDate: '2024-01-31' })

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND date(created_at) >= date(?)'),
        expect.arrayContaining(['2024-01-01', '2024-01-31'])
      )
    })

    it('should apply limit', async () => {
      mockExecuteQuery.mockResolvedValue(mockLogs)

      await getActivityLogs({ limit: 10 })

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [10]
      )
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockExecuteQuery.mockRejectedValue(new Error('Database error'))

      const result = await getActivityLogs()

      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('getEntityHistory', () => {
    it('should get history for specific entity', async () => {
      const mockHistory: ActivityLog[] = [
        {
          id: 1,
          entity_type: 'client',
          entity_id: 5,
          action: 'create',
          entity_name: 'Client 5',
          details: null,
          created_at: '2024-01-10T10:00:00Z',
        },
        {
          id: 2,
          entity_type: 'client',
          entity_id: 5,
          action: 'update',
          entity_name: 'Client 5',
          details: '{"email":"new@email.com"}',
          created_at: '2024-01-15T10:00:00Z',
        },
      ]

      mockExecuteQuery.mockResolvedValue(mockHistory)

      const result = await getEntityHistory('client', 5)

      expect(result).toEqual(mockHistory)
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND entity_type = ?'),
        expect.arrayContaining(['client', 5])
      )
    })
  })

  describe('getRecentActivities', () => {
    it('should get activities from last 30 days by default', async () => {
      mockExecuteQuery.mockResolvedValue([])

      await getRecentActivities()

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE date(created_at) >= date(?)'),
        expect.any(Array)
      )
    })

    it('should accept custom days parameter', async () => {
      mockExecuteQuery.mockResolvedValue([])

      await getRecentActivities(7)

      expect(mockExecuteQuery).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockExecuteQuery.mockRejectedValue(new Error('Database error'))

      const result = await getRecentActivities()

      expect(result).toEqual([])
      consoleSpy.mockRestore()
    })
  })

  describe('formatAction', () => {
    it('should format create action', () => {
      expect(formatAction('create')).toBe('criado')
    })

    it('should format update action', () => {
      expect(formatAction('update')).toBe('editado')
    })

    it('should format delete action', () => {
      expect(formatAction('delete')).toBe('excluído')
    })
  })

  describe('formatEntityType', () => {
    it('should format client type', () => {
      expect(formatEntityType('client')).toBe('Cliente')
    })

    it('should format case type', () => {
      expect(formatEntityType('case')).toBe('Caso')
    })

    it('should format document type', () => {
      expect(formatEntityType('document')).toBe('Documento')
    })

    it('should format deadline type', () => {
      expect(formatEntityType('deadline')).toBe('Prazo')
    })
  })

  describe('parseActivityDetails', () => {
    it('should parse valid JSON details', () => {
      const log: ActivityLog = {
        id: 1,
        entity_type: 'client',
        entity_id: 1,
        action: 'update',
        entity_name: 'Test',
        details: '{"name":"New Name","email":"test@test.com"}',
        created_at: '2024-01-01T00:00:00Z',
      }

      const result = parseActivityDetails(log)

      expect(result).toEqual({ name: 'New Name', email: 'test@test.com' })
    })

    it('should return null for null details', () => {
      const log: ActivityLog = {
        id: 1,
        entity_type: 'client',
        entity_id: 1,
        action: 'create',
        entity_name: 'Test',
        details: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      const result = parseActivityDetails(log)

      expect(result).toBeNull()
    })

    it('should return null for invalid JSON', () => {
      const log: ActivityLog = {
        id: 1,
        entity_type: 'client',
        entity_id: 1,
        action: 'update',
        entity_name: 'Test',
        details: 'invalid json {',
        created_at: '2024-01-01T00:00:00Z',
      }

      const result = parseActivityDetails(log)

      expect(result).toBeNull()
    })
  })
})
