/**
 * @fileoverview Activity Logger module for tracking CRUD operations.
 * Records all create, update, and delete actions across entities.
 *
 * @module activityLogger
 */

import { executeQuery, executeInsert, isTauriEnvironment } from './db'
import { toLocalDateKey } from './utils'
import type { ActivityLog, EntityType, ActionType } from '@/types'

interface ActivityFilters {
  entityType?: EntityType
  entityId?: number
  startDate?: string
  endDate?: string
  limit?: number
}

/**
 * Logs an activity to the database
 * @param entityType - Type of entity (client, case, document, deadline)
 * @param entityId - ID of the entity
 * @param action - Action performed (create, update, delete)
 * @param entityName - Optional display name of the entity
 * @param details - Optional object with change details
 */
export async function logActivity(
  entityType: EntityType,
  entityId: number,
  action: ActionType,
  entityName?: string,
  details?: Record<string, unknown>
): Promise<void> {
  if (!isTauriEnvironment()) return

  try {
    await executeInsert(
      `INSERT INTO activity_logs (entity_type, entity_id, action, entity_name, details)
       VALUES (?, ?, ?, ?, ?)`,
      [
        entityType,
        entityId,
        action,
        entityName || null,
        details ? JSON.stringify(details) : null,
      ]
    )
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

/**
 * Retrieves activity logs with optional filters
 * @param filters - Optional filters for querying logs
 * @returns Array of ActivityLog entries
 */
export async function getActivityLogs(
  filters?: ActivityFilters
): Promise<ActivityLog[]> {
  if (!isTauriEnvironment()) return []

  try {
    let query = 'SELECT * FROM activity_logs WHERE 1=1'
    const params: unknown[] = []

    if (filters?.entityType) {
      query += ' AND entity_type = ?'
      params.push(filters.entityType)
    }

    if (filters?.entityId) {
      query += ' AND entity_id = ?'
      params.push(filters.entityId)
    }

    if (filters?.startDate) {
      query += ' AND date(created_at) >= date(?)'
      params.push(filters.startDate)
    }

    if (filters?.endDate) {
      query += ' AND date(created_at) <= date(?)'
      params.push(filters.endDate)
    }

    query += ' ORDER BY created_at DESC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
    }

    return await executeQuery<ActivityLog>(query, params)
  } catch (error) {
    console.error('Failed to get activity logs:', error)
    return []
  }
}

/**
 * Gets the activity history for a specific entity
 * @param entityType - Type of entity
 * @param entityId - ID of the entity
 * @returns Array of ActivityLog entries for the entity
 */
export async function getEntityHistory(
  entityType: EntityType,
  entityId: number
): Promise<ActivityLog[]> {
  return getActivityLogs({ entityType, entityId })
}

/**
 * Gets recent activities grouped by date
 * @param days - Number of days to look back (default: 30)
 * @returns Array of ActivityLog entries
 */
export async function getRecentActivities(days: number = 30): Promise<ActivityLog[]> {
  if (!isTauriEnvironment()) return []

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    return await executeQuery<ActivityLog>(
      `SELECT * FROM activity_logs
       WHERE date(created_at) >= date(?)
       ORDER BY created_at DESC`,
      [toLocalDateKey(startDate)]
    )
  } catch (error) {
    console.error('Failed to get recent activities:', error)
    return []
  }
}

/**
 * Formats an action type for display in Portuguese
 * @param action - The action type
 * @returns Formatted string
 */
export function formatAction(action: ActionType): string {
  const actions: Record<ActionType, string> = {
    create: 'criado',
    update: 'editado',
    delete: 'excluído',
  }
  return actions[action]
}

/**
 * Formats an entity type for display in Portuguese
 * @param entityType - The entity type
 * @returns Formatted string
 */
export function formatEntityType(entityType: EntityType): string {
  const types: Record<EntityType, string> = {
    client: 'Cliente',
    case: 'Caso',
    document: 'Documento',
    deadline: 'Prazo',
  }
  return types[entityType]
}

/**
 * Parses the details JSON string from an ActivityLog
 * @param log - The activity log entry
 * @returns Parsed details object or null
 */
export function parseActivityDetails(log: ActivityLog): Record<string, unknown> | null {
  if (!log.details) return null
  try {
    return JSON.parse(log.details)
  } catch {
    return null
  }
}
