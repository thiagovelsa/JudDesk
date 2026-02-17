/**
 * @fileoverview Global Search module for unified search across all entities.
 * Searches clients, cases, documents, and deadlines in parallel.
 *
 * @module globalSearch
 */

import { executeQuery, isTauriEnvironment, searchDocumentsFast } from './db'
import type { SearchResult, EntityType } from '@/types'

interface ClientRow {
  id: number
  name: string
  cpf_cnpj: string | null
  email: string | null
}

interface CaseRow {
  id: number
  title: string
  case_number: string | null
  court: string | null
}

interface DocumentRow {
  id: number
  name: string
  folder_name: string | null
}

interface DeadlineRow {
  id: number
  title: string
  due_date: string
  priority: string
}

/**
 * Performs a global search across all entity types
 * @param query - Search term
 * @param limit - Maximum results per entity type (default: 5)
 * @returns Array of SearchResult grouped by type
 */
export async function globalSearch(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  if (!isTauriEnvironment() || !query.trim()) return []

  const searchTerm = `%${query.trim()}%`

  try {
    // Search all entity types in parallel
    const [clients, cases, documents, deadlines] = await Promise.all([
      searchClients(searchTerm, limit),
      searchCases(searchTerm, limit),
      searchDocuments(searchTerm, limit),
      searchDeadlines(searchTerm, limit),
    ])

    // Combine and return results
    return [...clients, ...cases, ...documents, ...deadlines]
  } catch (error) {
    console.error('Global search error:', error)
    return []
  }
}

async function searchClients(searchTerm: string, limit: number): Promise<SearchResult[]> {
  const rows = await executeQuery<ClientRow>(
    `SELECT id, name, cpf_cnpj, email FROM clients
     WHERE name LIKE ? OR cpf_cnpj LIKE ? OR email LIKE ?
     LIMIT ?`,
    [searchTerm, searchTerm, searchTerm, limit]
  )

  return rows.map((row) => ({
    type: 'client' as EntityType,
    id: row.id,
    title: row.name,
    subtitle: row.cpf_cnpj || row.email || '',
  }))
}

async function searchCases(searchTerm: string, limit: number): Promise<SearchResult[]> {
  const rows = await executeQuery<CaseRow>(
    `SELECT id, title, case_number, court FROM cases
     WHERE title LIKE ? OR case_number LIKE ? OR court LIKE ?
     LIMIT ?`,
    [searchTerm, searchTerm, searchTerm, limit]
  )

  return rows.map((row) => ({
    type: 'case' as EntityType,
    id: row.id,
    title: row.title,
    subtitle: row.case_number || row.court || '',
  }))
}

async function searchDocuments(searchTerm: string, limit: number): Promise<SearchResult[]> {
  // Try FTS-accelerated search first
  const searchQuery = searchTerm.replace(/%/g, '')
  const candidateIds = await searchDocumentsFast(searchQuery)

  let rows: DocumentRow[]

  if (candidateIds.length > 0) {
    // FTS returned candidates - validate with LIKE on those IDs only
    const placeholders = candidateIds.map(() => '?').join(',')
    rows = await executeQuery(
      `SELECT d.id, d.name, f.name as folder_name
       FROM documents d
       LEFT JOIN document_folders f ON d.folder_id = f.id
       WHERE d.id IN (${placeholders}) AND (d.name LIKE ? OR d.extracted_text LIKE ?)
       LIMIT ?`,
      [...candidateIds, searchTerm, searchTerm, limit]
    )
  } else {
    // No FTS candidates or FTS not available - fall back to full LIKE search
    rows = await executeQuery(
      `SELECT d.id, d.name, f.name as folder_name
       FROM documents d
       LEFT JOIN document_folders f ON d.folder_id = f.id
       WHERE d.name LIKE ? OR d.extracted_text LIKE ?
       LIMIT ?`,
      [searchTerm, searchTerm, limit]
    )
  }

  return rows.map((row) => ({
    type: 'document' as EntityType,
    id: row.id,
    title: row.name,
    subtitle: row.folder_name || 'Sem pasta',
  }))
}

async function searchDeadlines(searchTerm: string, limit: number): Promise<SearchResult[]> {
  const rows = await executeQuery<DeadlineRow>(
    `SELECT id, title, due_date, priority FROM deadlines
     WHERE title LIKE ? OR description LIKE ?
     LIMIT ?`,
    [searchTerm, searchTerm, limit]
  )

  return rows.map((row) => ({
    type: 'deadline' as EntityType,
    id: row.id,
    title: row.title,
    subtitle: formatDeadlineDate(row.due_date),
  }))
}

function formatDeadlineDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR')
  } catch {
    return dateStr
  }
}

/**
 * Gets the navigation path for a search result
 * @param result - The search result
 * @returns The path to navigate to
 */
export function getSearchResultPath(result: SearchResult): string {
  const paths: Record<EntityType, string> = {
    client: `/clients?id=${result.id}`,
    case: `/clients?caseId=${result.id}`,
    document: `/documents?id=${result.id}`,
    deadline: `/calendar?id=${result.id}`,
  }
  return paths[result.type]
}

/**
 * Gets the icon name for a search result type
 * @param type - The entity type
 * @returns Icon name for lucide-react
 */
export function getSearchResultIcon(type: EntityType): string {
  const icons: Record<EntityType, string> = {
    client: 'User',
    case: 'Briefcase',
    document: 'FileText',
    deadline: 'Calendar',
  }
  return icons[type]
}
