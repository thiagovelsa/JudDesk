import Database from '@tauri-apps/plugin-sql'
import type { Client, Case, Document, Deadline, ChatSession, ChatMessage, ChatAttachment, Settings, DocumentFolder, ActivityLog, AIUsageLog } from '@/types'

let db: Database | null = null
let dbInitPromise: Promise<Database> | null = null
export const DATABASE_CHANGED_EVENT = 'jurisdesk:database-changed'

function emitDatabaseChanged(operation: 'insert' | 'update' | 'delete' | 'import'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(DATABASE_CHANGED_EVENT, {
      detail: {
        operation,
        timestamp: Date.now(),
      },
    })
  )
}

// Check if running in Tauri environment
function checkTauriAvailable(): boolean {
  try {
    // Tauri v2 exposes __TAURI_INTERNALS__ (and some builds may still expose __TAURI__).
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  } catch {
    return false
  }
}

async function applyPragmas(database: Database) {
  // Keep these best-effort. If any PRAGMA fails on a given SQLite build,
  // we still want the app to run with defaults.
  try {
    await database.execute('PRAGMA foreign_keys = ON')
    // Reduce "database is locked" errors under bursty writes (CRUD + autobackup + logs).
    await database.execute('PRAGMA busy_timeout = 5000')
    // Better durability/concurrency trade-off for desktop apps.
    await database.execute('PRAGMA journal_mode = WAL')
    await database.execute('PRAGMA synchronous = NORMAL')
  } catch (error) {
    console.warn('[DB] Failed to apply PRAGMAs (continuing with defaults):', error)
  }
}

export async function getDatabase(): Promise<Database> {
  if (db) return db

  if (!checkTauriAvailable()) {
    throw new Error('Database não disponível fora do ambiente Tauri. Execute com: npm run tauri dev')
  }

  // Prevent concurrent initialization (App boot triggers multiple fetch* in parallel).
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const database = await Database.load('sqlite:jurisdesk.db')
      db = database
      await applyPragmas(database)
      await initializeTables()
      return database
    })().catch((err) => {
      // Allow retry if initialization failed.
      db = null
      dbInitPromise = null
      throw err
    })
  }

  return dbInitPromise
}

async function initializeTables() {
  if (!db) return

  await db.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cpf_cnpj TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      case_number TEXT,
      court TEXT,
      type TEXT,
      status TEXT DEFAULT 'ativo',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER,
      client_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      extracted_text TEXT,
      folder TEXT DEFAULT 'geral',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS deadlines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER,
      client_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATETIME NOT NULL,
      reminder_date DATETIME,
      completed INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER,
      title TEXT,
      provider TEXT DEFAULT 'ollama',
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE   
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT,
      file_type TEXT NOT NULL,
      extracted_text TEXT,
      size_bytes INTEGER DEFAULT 0,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)

  // Activity logs table for tracking CRUD operations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      entity_name TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Document folders table for hierarchical folder structure
  await db.execute(`
    CREATE TABLE IF NOT EXISTS document_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      case_id INTEGER,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES document_folders(id) ON DELETE CASCADE,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    )
  `)

  // AI usage logs table for cost tracking
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      thinking_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_write_tokens INTEGER DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL
    )
  `)

  // Check if we need to add folder_id column to documents
  await migrateDocumentFolders()

  // Add Claude-specific columns to chat_messages
  await migrateChatMessagesForClaude()
  await migrateChatAttachmentsStorage()

  // Add client_id column to document_folders for auto-created client folders   
  await migrateClientFolders()

  // Merge duplicate client folders before enforcing uniqueness
  await cleanupDuplicateClientFolders()

  // Clean up duplicate root folders (global only)
  await cleanupDuplicateFolders()

  // Enforce uniqueness for client folders
  await ensureUniqueClientFolderIndex()

  // Add updated_at column to cases and documents
  await migrateCasesUpdatedAt()
  await migrateDocumentsUpdatedAt()

  // Create performance indexes
  await createPerformanceIndexes()

  // Create FTS table for document search
  await createDocumentsFTS()
}

/**
 * Adds Claude-specific columns to chat_messages table:
 * - thinking_content: Extended thinking from Claude
 * - web_search_results: JSON array of search results
 * - cost_usd: Cost of the message in USD
 * - intent_profile: Detected intent profile (simples, pesquisa, analise, peca)
 */
async function migrateChatMessagesForClaude() {
  if (!db) return

  // Check which columns exist
  const tableInfo = await db.select<{ name: string }[]>(
    "PRAGMA table_info(chat_messages)"
  )
  const existingColumns = new Set(tableInfo.map(col => col.name))

  // Add missing columns
  const columnsToAdd = [
    { name: 'thinking_content', type: 'TEXT' },
    { name: 'web_search_results', type: 'TEXT' },
    { name: 'cost_usd', type: 'REAL' },
    { name: 'intent_profile', type: 'TEXT' },
  ]

  for (const column of columnsToAdd) {
    if (!existingColumns.has(column.name)) {
      await db.execute(`ALTER TABLE chat_messages ADD COLUMN ${column.name} ${column.type}`)
    }
  }
}

/**
 * Adds storage columns to chat_attachments table
 */
async function migrateChatAttachmentsStorage() {
  if (!db) return

  const tableInfo = await db.select<{ name: string }[]>(
    "PRAGMA table_info(chat_attachments)"
  )
  if (tableInfo.length === 0) return

  const existingColumns = new Set(tableInfo.map((col) => col.name))
  const columnsToAdd = [
    { name: 'file_path', type: 'TEXT' },
  ]

  for (const column of columnsToAdd) {
    if (!existingColumns.has(column.name)) {
      await db.execute(`ALTER TABLE chat_attachments ADD COLUMN ${column.name} ${column.type}`)
    }
  }
}

/**
 * Migrates the documents table from folder (string) to folder_id (integer)
 * Creates default folders and updates existing documents
 */
async function migrateDocumentFolders() {
  if (!db) return

  // Check if folder_id column exists
  const tableInfo = await db.select<{ name: string }[]>(
    "PRAGMA table_info(documents)"
  )
  const hasNewColumn = tableInfo.some((col) => col.name === 'folder_id')

  if (hasNewColumn) return // Already migrated

  // Create default folders
  const defaultFolders = [
    { name: 'Geral', position: 0 },
    { name: 'Contratos', position: 1 },
    { name: 'Procurações', position: 2 },
    { name: 'Petições', position: 3 },
    { name: 'Recursos', position: 4 },
  ]

  const folderMap: Record<string, number> = {}

  for (const folder of defaultFolders) {
    const result = await db.execute(
      'INSERT INTO document_folders (name, position) VALUES (?, ?)',
      [folder.name, folder.position]
    )
    // Map old folder names to new IDs
    const oldName = folder.name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
    folderMap[oldName] = result.lastInsertId ?? 0
  }

  // Add folder_id column
  await db.execute('ALTER TABLE documents ADD COLUMN folder_id INTEGER')

  // Migrate existing documents
  const documents = await db.select<{ id: number; folder: string }[]>(
    'SELECT id, folder FROM documents'
  )

  for (const doc of documents) {
    const normalizedFolder = (doc.folder || 'geral').toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    const folderId = folderMap[normalizedFolder] || folderMap['geral']

    await db.execute(
      'UPDATE documents SET folder_id = ? WHERE id = ?',
      [folderId, doc.id]
    )
  }
}

/**
 * Adds client_id column to document_folders table
 * This allows automatic folder creation for each client
 */
async function migrateClientFolders() {
  if (!db) return

  // Check if client_id column exists
  const tableInfo = await db.select<{ name: string }[]>(
    "PRAGMA table_info(document_folders)"
  )
  const hasClientId = tableInfo.some((col) => col.name === 'client_id')

  if (hasClientId) return // Already migrated

  // Add client_id column
  await db.execute(`
    ALTER TABLE document_folders
    ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE
  `)

  console.log('[DB] Added client_id column to document_folders')
}

/**
 * Adds updated_at column to cases table
 * This column is used to track when a case was last modified
 */
async function migrateCasesUpdatedAt() {
  if (!db) return

  // Check if updated_at column exists
  const tableInfo = await db.select<{ name: string }[]>(
    "PRAGMA table_info(cases)"
  )
  const hasUpdatedAt = tableInfo.some((col) => col.name === 'updated_at')

  if (hasUpdatedAt) return // Already migrated

  // Add updated_at column
  await db.execute(`
    ALTER TABLE cases
    ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  `)

  // Populate existing rows with created_at value
  await db.execute(`
    UPDATE cases SET updated_at = created_at WHERE updated_at IS NULL
  `)

  console.log('[DB] Added updated_at column to cases')
}

/**
 * Adds updated_at column to documents table
 * This column is used to track when a document was last modified
 */
async function migrateDocumentsUpdatedAt() {
  if (!db) return

  // Check if updated_at column exists
  const tableInfo = await db.select<{ name: string }[]>(
    "PRAGMA table_info(documents)"
  )
  const hasUpdatedAt = tableInfo.some((col) => col.name === 'updated_at')

  if (hasUpdatedAt) return // Already migrated

  // Add updated_at column
  await db.execute(`
    ALTER TABLE documents
    ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  `)

  // Populate existing rows with created_at value
  await db.execute(`
    UPDATE documents SET updated_at = created_at WHERE updated_at IS NULL
  `)

  console.log('[DB] Added updated_at column to documents')
}

/**
 * Creates performance indexes for frequently queried columns
 * These indexes significantly improve query performance on large datasets
 */
async function createPerformanceIndexes() {
  if (!db) return

  // Cases indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON cases(updated_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)')

  // Documents indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at)')

  // Deadlines indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON deadlines(due_date)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_deadlines_completed_due_date ON deadlines(completed, due_date)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_deadlines_case_id ON deadlines(case_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_deadlines_client_id ON deadlines(client_id)')

  // Chat messages indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(session_id, created_at)')

  // Chat sessions indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_chat_sessions_case_id ON chat_sessions(case_id)')

  // Chat attachments indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_chat_attachments_session_id ON chat_attachments(session_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_chat_attachments_created_at ON chat_attachments(session_id, created_at)')

  // Activity logs indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id)')

  // AI usage logs indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_session_id ON ai_usage_logs(session_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at)')

  // Document folders indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id ON document_folders(parent_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_document_folders_case_id ON document_folders(case_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_document_folders_client_id ON document_folders(client_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_document_folders_position ON document_folders(position)')

  console.log('[DB] Created performance indexes')
}

/**
 * Creates FTS5 virtual table for fast document text search
 * This table acts as a pre-filter/accelerator for LIKE searches
 */
async function createDocumentsFTS() {
  if (!db) return

  try {
    // Create FTS5 virtual table for document name and extracted text
    await db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        document_id UNINDEXED,
        name,
        extracted_text,
        content=''
      )
    `)

    // Populate missing FTS rows so name-only documents are searchable too
    await db.execute(`
      INSERT INTO documents_fts(document_id, name, extracted_text)
      SELECT d.id, d.name, COALESCE(d.extracted_text, '')
      FROM documents d
      WHERE NOT EXISTS (
        SELECT 1 FROM documents_fts f WHERE f.document_id = d.id
      )
    `)

    console.log('[DB] Created FTS5 table for documents')
  } catch (error) {
    // FTS5 might not be available in some SQLite builds, log but don't fail
    console.warn('[DB] FTS5 not available, falling back to LIKE search:', error)
  }
}

/**
 * Updates the FTS index when a document is created or updated
 * Call this after inserting/updating documents (with or without extracted text)
 */
export async function updateDocumentFTS(
  documentId: number,
  name: string,
  extractedText: string | null
): Promise<void> {
  if (!isTauriEnvironment()) return

  try {
    const database = await getDatabase()

    // Delete existing FTS entry
    await database.execute(
      'DELETE FROM documents_fts WHERE document_id = ?',
      [documentId]
    )

    const normalizedText = extractedText ?? ''
    await database.execute(
      'INSERT INTO documents_fts(document_id, name, extracted_text) VALUES (?, ?, ?)',
      [documentId, name, normalizedText]
    )
  } catch (error) {
    // Silently fail if FTS is not available
    console.debug('[DB] FTS update skipped:', error)
  }
}

/**
 * Searches documents using FTS5 as an accelerator with LIKE validation
 * Returns the same results as LIKE search but much faster on large datasets
 */
export async function searchDocumentsFast(searchTerm: string): Promise<number[]> {
  if (!isTauriEnvironment() || !searchTerm.trim()) return []

  try {
    const database = await getDatabase()

    // Only use FTS for queries with 3+ characters
    if (searchTerm.trim().length < 3) {
      return [] // Fall back to full LIKE search
    }

    // Use FTS5 to get candidate document IDs
    // FTS5 uses MATCH which is much faster than LIKE
    const candidates = await database.select<{ document_id: number }[]>(
      `SELECT document_id FROM documents_fts
       WHERE documents_fts MATCH ?
       LIMIT 100`,
      [searchTerm.trim().replace(/[^\w\s]/g, ' ')]
    )

    return candidates.map(c => c.document_id)
  } catch (error) {
    // If FTS fails, return empty to trigger fallback to LIKE
    console.debug('[DB] FTS search failed, falling back to LIKE:', error)
    return []
  }
}

/**
 * Removes duplicate client folders (same client_id).
 * Keeps the lowest ID and remaps documents/children before deletion.
 */
async function cleanupDuplicateClientFolders() {
  if (!db) return

  const duplicates = await db.select<{ client_id: number; count: number }[]>(`
    SELECT client_id, COUNT(*) as count
    FROM document_folders
    WHERE client_id IS NOT NULL
    GROUP BY client_id
    HAVING COUNT(*) > 1
  `)

  for (const dup of duplicates) {
    const rows = await db.select<{ id: number }[]>(`
      SELECT id
      FROM document_folders
      WHERE client_id = ?
      ORDER BY id ASC
    `, [dup.client_id])

    if (rows.length <= 1) continue

    const keepId = rows[0].id
    const duplicateIds = rows.slice(1).map((row) => row.id)
    if (duplicateIds.length === 0) continue

    const placeholders = duplicateIds.map(() => '?').join(',')

    // Re-parent children to the kept folder
    await db.execute(
      `UPDATE document_folders SET parent_id = ? WHERE parent_id IN (${placeholders})`,
      [keepId, ...duplicateIds]
    )

    // Remap documents to the kept folder
    await db.execute(
      `UPDATE documents SET folder_id = ? WHERE folder_id IN (${placeholders})`,
      [keepId, ...duplicateIds]
    )

    // Remove duplicates
    await db.execute(
      `DELETE FROM document_folders WHERE id IN (${placeholders})`,
      duplicateIds
    )
  }
}

/**
 * Removes duplicate folders with the same name at root level
 * Keeps only the one with the lowest ID
 */
async function cleanupDuplicateFolders() {
  if (!db) return

  // Find duplicate folder names at root level (global folders only)
  const duplicates = await db.select<{ name: string; count: number }[]>(`       
    SELECT name, COUNT(*) as count
    FROM document_folders
    WHERE parent_id IS NULL
      AND client_id IS NULL
      AND case_id IS NULL
    GROUP BY name
    HAVING COUNT(*) > 1
  `)

  for (const dup of duplicates) {
    const rows = await db.select<{ id: number }[]>(`
      SELECT id
      FROM document_folders
      WHERE name = ?
        AND parent_id IS NULL
        AND client_id IS NULL
        AND case_id IS NULL
      ORDER BY id ASC
    `, [dup.name])

    if (rows.length <= 1) continue

    const keepId = rows[0].id
    const duplicateIds = rows.slice(1).map((row) => row.id)
    if (duplicateIds.length === 0) continue

    const placeholders = duplicateIds.map(() => '?').join(',')

    // Re-parent children to the kept folder
    await db.execute(
      `UPDATE document_folders SET parent_id = ? WHERE parent_id IN (${placeholders})`,
      [keepId, ...duplicateIds]
    )

    // Remap documents to the kept folder
    await db.execute(
      `UPDATE documents SET folder_id = ? WHERE folder_id IN (${placeholders})`,
      [keepId, ...duplicateIds]
    )

    // Delete duplicates
    await db.execute(
      `DELETE FROM document_folders WHERE id IN (${placeholders})`,
      duplicateIds
    )
  }
}

/**
 * Ensures there is at most one folder per client_id.
 */
async function ensureUniqueClientFolderIndex() {
  if (!db) return

  try {
    await db.execute(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_document_folders_client_unique ON document_folders(client_id)'
    )
  } catch (error) {
    console.warn('[DB] Failed to create unique client folder index:', error)
  }
}

export function isTauriEnvironment(): boolean {
  return checkTauriAvailable()
}

export async function executeQuery<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const database = await getDatabase()
  return database.select(query, params)
}

export async function executeInsert(query: string, params: unknown[] = []): Promise<number> {
  const database = await getDatabase()
  const result = await database.execute(query, params)
  const lastInsertId = result.lastInsertId ?? 0
  if (result.rowsAffected > 0) {
    emitDatabaseChanged('insert')
  }
  return lastInsertId
}

export async function executeUpdate(query: string, params: unknown[] = []): Promise<number> {
  const database = await getDatabase()
  const result = await database.execute(query, params)
  if (result.rowsAffected > 0) {
    emitDatabaseChanged('update')
  }
  return result.rowsAffected
}

export async function executeDelete(query: string, params: unknown[] = []): Promise<number> {
  const database = await getDatabase()
  const result = await database.execute(query, params)
  if (result.rowsAffected > 0) {
    emitDatabaseChanged('delete')
  }
  return result.rowsAffected
}

// ============================================================================
// Health / Diagnostics
// ============================================================================

export interface DatabaseHealth {
  ok: boolean
  dbFile: string | null
  foreignKeys: boolean | null
  journalMode: string | null
  integrity: string | null
  error?: string
}

/**
 * Returns basic database health signals to help validate persistence at runtime.
 * Intended for UI diagnostics (Settings -> Database).
 */
export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  if (!isTauriEnvironment()) {
    return {
      ok: false,
      dbFile: null,
      foreignKeys: null,
      journalMode: null,
      integrity: null,
      error: 'Not running in the Tauri environment.',
    }
  }

  try {
    const database = await getDatabase()

    const dbList = await database.select<Array<{ name: string; file: string }>>(
      'PRAGMA database_list'
    )
    const mainDb = dbList.find((row) => row.name === 'main')
    const dbFile = mainDb?.file ?? null

    const fkRows = await database.select<Array<{ foreign_keys: number }>>(
      'PRAGMA foreign_keys'
    )
    const foreignKeys =
      fkRows.length > 0 ? fkRows[0].foreign_keys === 1 : null

    const journalRows = await database.select<Array<{ journal_mode: string }>>(
      'PRAGMA journal_mode'
    )
    const journalMode = journalRows[0]?.journal_mode ?? null

    // Use quick_check(1) to keep it fast.
    const integrityRows = await database.select<Array<{ quick_check: string }>>(
      'PRAGMA quick_check(1)'
    )
    const integrity = integrityRows[0]?.quick_check ?? null

    return {
      ok: integrity === 'ok',
      dbFile,
      foreignKeys,
      journalMode,
      integrity,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      dbFile: null,
      foreignKeys: null,
      journalMode: null,
      integrity: null,
      error: message,
    }
  }
}

// ============================================================================
// Backup and Export Functions
// ============================================================================

/**
 * Estrutura do backup completo do banco de dados
 * @interface DatabaseBackup
 */
export interface DatabaseBackup {
  /** Versão do formato de backup */
  version: string
  /** Data/hora da criação do backup (ISO 8601) */
  created_at: string
  /** Todos os registros da tabela clients */
  clients: unknown[]
  /** Todos os registros da tabela cases */
  cases: unknown[]
  /** Todos os registros da tabela documents */
  documents: unknown[]
  /** Todos os registros da tabela deadlines */
  deadlines: unknown[]
  /** Todos os registros da tabela chat_sessions */
  chat_sessions: unknown[]
  /** Todos os registros da tabela chat_messages */
  chat_messages: unknown[]
  /** Todos os registros da tabela chat_attachments */
  chat_attachments?: unknown[]
  /** Todos os registros da tabela settings */
  settings: unknown[]
  /** Todos os registros da tabela document_folders */
  document_folders: unknown[]
  /** Todos os registros da tabela activity_logs */
  activity_logs: unknown[]
  /** Todos os registros da tabela ai_usage_logs */
  ai_usage_logs?: unknown[]
}

/**
 * Estatísticas do banco de dados
 * @interface DatabaseStats
 */
export interface DatabaseStats {
  /** Número total de clientes */
  clients: number
  /** Número total de casos */
  cases: number
  /** Número total de documentos */
  documents: number
  /** Número total de prazos */
  deadlines: number
  /** Número total de sessões de chat */
  chat_sessions: number
  /** Número total de mensagens de chat */
  chat_messages: number
}

/**
 * Exporta todo o banco de dados como objeto JSON
 * @returns Objeto DatabaseBackup com todos os dados
 * @example
 * const backup = await exportDatabase()
 * const json = JSON.stringify(backup, null, 2)
 */
export async function exportDatabase(): Promise<DatabaseBackup> {
  const database = await getDatabase()

  const [clients, cases, documents, deadlines, chatSessions, chatMessages, chatAttachments, settings, documentFolders, activityLogs, aiUsageLogs] = await Promise.all([
    database.select<Client[]>('SELECT * FROM clients'),
    database.select<Case[]>('SELECT * FROM cases'),
    database.select<Document[]>('SELECT * FROM documents'),
    database.select<Deadline[]>('SELECT * FROM deadlines'),
    database.select<ChatSession[]>('SELECT * FROM chat_sessions'),
    database.select<ChatMessage[]>('SELECT * FROM chat_messages'),
    database.select<ChatAttachment[]>('SELECT * FROM chat_attachments'),
    database.select<Settings[]>('SELECT * FROM settings'),
    database.select<DocumentFolder[]>('SELECT * FROM document_folders'),
    database.select<ActivityLog[]>('SELECT * FROM activity_logs'),
    database.select<AIUsageLog[]>('SELECT * FROM ai_usage_logs'),
  ])

  return {
    version: '1.4',
    created_at: new Date().toISOString(),
    clients,
    cases,
    documents,
    deadlines,
    chat_sessions: chatSessions,
    chat_messages: chatMessages,
    chat_attachments: chatAttachments,
    settings,
    document_folders: documentFolders,
    activity_logs: activityLogs,
    ai_usage_logs: aiUsageLogs,
  }
}

type ImportedFolderRow = {
  id: number
  name: string
  parent_id: number | null
  case_id: number | null
  client_id: number | null
  position: number
  created_at: string | null
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function sanitizeImportedFolders(rawFolders: Record<string, unknown>[]) {
  const normalized: ImportedFolderRow[] = rawFolders
    .map((folder) => {
      const id = toNumberOrNull(folder.id)
      if (!id || id <= 0) return null

      return {
        id,
        name: typeof folder.name === 'string' ? folder.name : String(folder.name ?? ''),
        parent_id: toNumberOrNull(folder.parent_id),
        case_id: toNumberOrNull(folder.case_id),
        client_id: toNumberOrNull(folder.client_id),
        position: toNumberOrNull(folder.position) ?? 0,
        created_at: typeof folder.created_at === 'string' ? folder.created_at : null,
      }
    })
    .filter((folder): folder is ImportedFolderRow => folder !== null)

  const clientPrimary = new Map<number, number>()
  const idRemap = new Map<number, number>()
  const deduped: ImportedFolderRow[] = []

  for (const folder of normalized) {
    if (folder.client_id !== null) {
      const existing = clientPrimary.get(folder.client_id)
      if (existing) {
        idRemap.set(folder.id, existing)
        continue
      }
      clientPrimary.set(folder.client_id, folder.id)
    }
    deduped.push(folder)
  }

  for (const folder of deduped) {
    if (folder.parent_id !== null && idRemap.has(folder.parent_id)) {
      folder.parent_id = idRemap.get(folder.parent_id) ?? null
    }
  }

  const idSet = new Set(deduped.map((folder) => folder.id))
  for (const folder of deduped) {
    if (folder.parent_id !== null && !idSet.has(folder.parent_id)) {
      folder.parent_id = null
    }
  }

  const parentMap = new Map<number, number | null>(
    deduped.map((folder) => [folder.id, folder.parent_id])
  )

  for (const folder of deduped) {
    let parentId = parentMap.get(folder.id) ?? null
    if (parentId !== null) {
      const seen = new Set<number>([folder.id])
      let current: number | null = parentId
      while (current !== null) {
        if (seen.has(current)) {
          parentId = null
          break
        }
        seen.add(current)
        current = parentMap.get(current) ?? null
      }
    }

    if (parentId !== folder.parent_id) {
      folder.parent_id = parentId
      parentMap.set(folder.id, parentId)
    }
  }

  return { folders: deduped, idRemap }
}

/**
 * Importa backup JSON para o banco de dados
 *
 * **ATENÇÃO: Esta operação substitui TODOS os dados existentes!**
 *
 * Usa transação SQLite para garantir atomicidade - se qualquer operação falhar,
 * todo o banco é restaurado ao estado anterior (ROLLBACK).
 *
 * @param backup - Objeto DatabaseBackup com os dados a importar
 * @throws Error se a importação falhar (banco permanece intacto devido ao rollback)
 * @example
 * const backup = JSON.parse(jsonString) as DatabaseBackup
 * await importDatabase(backup)
 */
export async function importDatabase(backup: DatabaseBackup): Promise<void> {
  const database = await getDatabase()

  // Start transaction for atomic operation
  await database.execute('BEGIN TRANSACTION')

  try {
    // Disable foreign key checks during import for performance and order flexibility
    await database.execute('PRAGMA foreign_keys = OFF')

    // Clear existing data (in reverse dependency order)
    await database.execute('DELETE FROM ai_usage_logs')
    await database.execute('DELETE FROM activity_logs')
    await database.execute('DELETE FROM chat_attachments')
    await database.execute('DELETE FROM chat_messages')
    await database.execute('DELETE FROM chat_sessions')
    await database.execute('DELETE FROM documents')
    await database.execute('DELETE FROM document_folders')
    await database.execute('DELETE FROM deadlines')
    await database.execute('DELETE FROM cases')
    await database.execute('DELETE FROM clients')
    await database.execute('DELETE FROM settings')

    // Insert clients
    for (const client of backup.clients as Record<string, unknown>[]) {
      await database.execute(
        `INSERT INTO clients (id, name, cpf_cnpj, email, phone, address, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [client.id, client.name, client.cpf_cnpj, client.email, client.phone, client.address, client.notes, client.created_at, client.updated_at]
      )
    }

    // Insert cases
    for (const c of backup.cases as Record<string, unknown>[]) {
      await database.execute(
        `INSERT INTO cases (id, client_id, title, case_number, court, type, status, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.client_id, c.title, c.case_number, c.court, c.type, c.status, c.description, c.created_at, c.updated_at ?? c.created_at]
      )
    }

    // Insert document_folders (before documents due to FK)
    const { folders: importedFolders, idRemap: folderIdRemap } = sanitizeImportedFolders(
      (backup.document_folders ?? []) as Record<string, unknown>[]
    )

    if (importedFolders.length > 0) {
      for (const folder of importedFolders) {
        await database.execute(
          `INSERT INTO document_folders (id, name, parent_id, case_id, client_id, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [folder.id, folder.name, folder.parent_id, folder.case_id, folder.client_id ?? null, folder.position, folder.created_at]
        )
      }
    }

    const normalizeFolderName = (name: string) =>
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()

    const rootFolders = await database.select<{ id: number; name: string; position: number }[]>(`
      SELECT id, name, position
      FROM document_folders
      WHERE parent_id IS NULL
        AND client_id IS NULL
        AND case_id IS NULL
    `)

    const folderNameMap = new Map<string, number>()
    let nextFolderPosition = 0

    rootFolders.forEach((folder) => {
      const normalized = normalizeFolderName(folder.name)
      if (!folderNameMap.has(normalized)) {
        folderNameMap.set(normalized, folder.id)
      }
      if (typeof folder.position === 'number' && folder.position >= nextFolderPosition) {
        nextFolderPosition = folder.position + 1
      }
    })

    const ensureLegacyFolderId = async (folderName: string): Promise<number | null> => {
      const normalized = normalizeFolderName(folderName)
      const existing = folderNameMap.get(normalized)
      if (existing) return existing

      const result = await database.execute(
        `INSERT INTO document_folders (name, parent_id, case_id, client_id, position)
         VALUES (?, NULL, NULL, NULL, ?)`,
        [folderName, nextFolderPosition]
      )
      const newId = result.lastInsertId ?? 0
      if (!newId) return null

      folderNameMap.set(normalized, newId)
      nextFolderPosition += 1
      return newId
    }

    // Insert documents (use folder_id for new backups, folder for legacy)
    for (const doc of backup.documents as Record<string, unknown>[]) {
      const rawFolderId = doc.folder_id
      let resolvedFolderId: number | null = null

      if (typeof rawFolderId === 'number' && rawFolderId > 0) {
        resolvedFolderId = rawFolderId
      } else if (typeof rawFolderId === 'string' && rawFolderId.trim()) {
        const parsed = Number(rawFolderId)
        if (!Number.isNaN(parsed) && parsed > 0) {
          resolvedFolderId = parsed
        }
      }

      if (!resolvedFolderId && typeof doc.folder === 'string' && doc.folder.trim()) {
        resolvedFolderId = await ensureLegacyFolderId(doc.folder.trim())
      }

      if (resolvedFolderId && folderIdRemap.has(resolvedFolderId)) {
        resolvedFolderId = folderIdRemap.get(resolvedFolderId) ?? resolvedFolderId
      }

      await database.execute(
        `INSERT INTO documents (id, case_id, client_id, name, file_path, extracted_text, folder_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [doc.id, doc.case_id, doc.client_id, doc.name, doc.file_path, doc.extracted_text, resolvedFolderId, doc.created_at, doc.updated_at ?? doc.created_at]
      )
    }

    // Insert deadlines
    for (const deadline of backup.deadlines as Record<string, unknown>[]) {
      await database.execute(
        `INSERT INTO deadlines (id, case_id, client_id, title, description, due_date, reminder_date, completed, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [deadline.id, deadline.case_id, deadline.client_id, deadline.title, deadline.description, deadline.due_date, deadline.reminder_date, deadline.completed, deadline.priority, deadline.created_at]
      )
    }

    // Insert chat sessions
    for (const session of backup.chat_sessions as Record<string, unknown>[]) {
      await database.execute(
        `INSERT INTO chat_sessions (id, case_id, title, provider, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [session.id, session.case_id, session.title, session.provider, session.model, session.created_at]
      )
    }

    // Insert chat messages (including Claude-specific fields)
    for (const msg of backup.chat_messages as Record<string, unknown>[]) {      
      await database.execute(
        `INSERT INTO chat_messages (id, session_id, role, content, created_at, thinking_content, web_search_results, cost_usd, intent_profile)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [msg.id, msg.session_id, msg.role, msg.content, msg.created_at, msg.thinking_content ?? null, msg.web_search_results ?? null, msg.cost_usd ?? null, msg.intent_profile ?? null]
      )
    }

    // Insert chat attachments
    if (backup.chat_attachments) {
      for (const attachment of backup.chat_attachments as Record<string, unknown>[]) {
        await database.execute(
          `INSERT INTO chat_attachments (id, session_id, name, file_path, file_type, extracted_text, size_bytes, error, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            attachment.id,
            attachment.session_id,
            attachment.name,
            attachment.file_path ?? null,
            attachment.file_type,
            attachment.extracted_text ?? null,
            attachment.size_bytes ?? 0,
            attachment.error ?? null,
            attachment.created_at,
          ]
        )
      }
    }

    // Insert settings
    for (const setting of backup.settings as Record<string, unknown>[]) {
      await database.execute(
        `INSERT INTO settings (key, value) VALUES (?, ?)`,
        [setting.key, setting.value]
      )
    }

    // Insert activity_logs
    if (backup.activity_logs) {
      for (const log of backup.activity_logs as Record<string, unknown>[]) {
        await database.execute(
          `INSERT INTO activity_logs (id, entity_type, entity_id, action, entity_name, details, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [log.id, log.entity_type, log.entity_id, log.action, log.entity_name, log.details, log.created_at]
        )
      }
    }

    // Insert ai_usage_logs
    if (backup.ai_usage_logs) {
      for (const log of backup.ai_usage_logs as Record<string, unknown>[]) {
        await database.execute(
          `INSERT INTO ai_usage_logs (id, session_id, input_tokens, output_tokens, thinking_tokens, cache_read_tokens, cache_write_tokens, cost_usd, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [log.id, log.session_id, log.input_tokens, log.output_tokens, log.thinking_tokens, log.cache_read_tokens, log.cache_write_tokens, log.cost_usd, log.created_at]
        )
      }
    }

    // Re-enable foreign keys and verify integrity
    await database.execute('PRAGMA foreign_keys = ON')

    // Commit transaction - all changes are now permanent
    await database.execute('COMMIT')
    emitDatabaseChanged('import')
  } catch (error) {
    // Rollback transaction - restore database to previous state
    try {
      await database.execute('ROLLBACK')
      await database.execute('PRAGMA foreign_keys = ON')
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError)
    }
    console.error('Error importing database:', error)
    throw new Error('Falha ao importar backup. Nenhuma alteração foi feita no banco de dados.')
  }
}

/**
 * Exporta uma tabela específica como CSV
 * @param tableName - Nome da tabela ('clients', 'cases', 'documents', 'deadlines')
 * @returns String CSV com headers e dados
 * @throws Error se tabela não for permitida
 * @example
 * const csv = await exportTableAsCSV('clients')
 * // Download como arquivo .csv
 */
export async function exportTableAsCSV(tableName: string): Promise<string> {
  const allowedTables = ['clients', 'cases', 'documents', 'deadlines']
  if (!allowedTables.includes(tableName)) {
    throw new Error(`Tabela não permitida: ${tableName}`)
  }

  const database = await getDatabase()
  const rows = await database.select(`SELECT * FROM ${tableName}`) as Record<string, unknown>[]

  if (rows.length === 0) {
    return ''
  }

  // Get headers from first row
  const headers = Object.keys(rows[0])

  // Build CSV
  const csvLines: string[] = []
  csvLines.push(headers.join(','))

  for (const row of rows) {
    const values = headers.map(header => {
      const value = row[header]
      if (value === null || value === undefined) {
        return ''
      }
      // Escape quotes and wrap in quotes if contains comma or newline
      const strValue = String(value)
      if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
        return `"${strValue.replace(/"/g, '""')}"`
      }
      return strValue
    })
    csvLines.push(values.join(','))
  }

  return csvLines.join('\n')
}

/**
 * Retorna estatísticas de contagem de registros do banco
 * @returns Objeto com contagem de cada tabela principal
 * @example
 * const stats = await getDatabaseStats()
 * console.log(`Total de clientes: ${stats.clients}`)
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  const database = await getDatabase()

  const [clients, cases, documents, deadlines, chatSessions, chatMessages] = await Promise.all([
    database.select('SELECT COUNT(*) as count FROM clients') as Promise<{ count: number }[]>,
    database.select('SELECT COUNT(*) as count FROM cases') as Promise<{ count: number }[]>,
    database.select('SELECT COUNT(*) as count FROM documents') as Promise<{ count: number }[]>,
    database.select('SELECT COUNT(*) as count FROM deadlines') as Promise<{ count: number }[]>,
    database.select('SELECT COUNT(*) as count FROM chat_sessions') as Promise<{ count: number }[]>,
    database.select('SELECT COUNT(*) as count FROM chat_messages') as Promise<{ count: number }[]>,
  ])

  return {
    clients: clients[0]?.count ?? 0,
    cases: cases[0]?.count ?? 0,
    documents: documents[0]?.count ?? 0,
    deadlines: deadlines[0]?.count ?? 0,
    chat_sessions: chatSessions[0]?.count ?? 0,
    chat_messages: chatMessages[0]?.count ?? 0,
  }
}

// ============================================================================
// Performance Optimized Queries
// ============================================================================

/**
 * Document metadata type without extracted_text for performance
 */
export interface DocumentMetadata {
  id: number
  case_id: number | null
  client_id: number
  name: string
  file_path: string
  folder_id: number | null
  created_at: string
  updated_at: string
  has_extracted_text: boolean
}

/**
 * Fetches document metadata without the heavy extracted_text field.
 * Use this for listings to reduce memory usage.
 *
 * @param clientId - Optional filter by client
 * @returns Array of document metadata (without extracted_text)
 */
export async function getDocumentsMetadata(clientId?: number): Promise<DocumentMetadata[]> {
  const database = await getDatabase()

  let query = `
    SELECT
      id, case_id, client_id, name, file_path, folder_id, created_at, updated_at,
      CASE WHEN extracted_text IS NOT NULL AND extracted_text != '' THEN 1 ELSE 0 END as has_extracted_text
    FROM documents
  `
  const params: unknown[] = []

  if (clientId) {
    query += ' WHERE client_id = ?'
    params.push(clientId)
  }

  query += ' ORDER BY created_at DESC'

  const results = await database.select(query, params) as Array<{
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

  return results.map(row => ({
    ...row,
    has_extracted_text: row.has_extracted_text === 1
  }))
}

/**
 * Fetches only the extracted_text for a specific document.
 * Use this for on-demand loading when text is needed.
 *
 * @param id - Document ID
 * @returns The extracted text or null if not available
 */
export async function getDocumentExtractedText(id: number): Promise<string | null> {
  const database = await getDatabase()

  const results = await database.select(
    'SELECT extracted_text FROM documents WHERE id = ?',
    [id]
  ) as Array<{ extracted_text: string | null }>

  if (results.length === 0) return null
  return results[0]?.extracted_text ?? null
}

export interface ChatAttachmentRecord {
  id: number
  session_id: number
  name: string
  file_path: string | null
  file_type: string
  extracted_text: string | null
  size_bytes: number | null
  error: string | null
  created_at: string
}

export async function getChatAttachmentsBySession(sessionId: number): Promise<ChatAttachmentRecord[]> {
  const database = await getDatabase()
  return database.select(
    `SELECT id, session_id, name, file_path, file_type, extracted_text, size_bytes, error, created_at
     FROM chat_attachments
     WHERE session_id = ?
     ORDER BY created_at ASC`,
    [sessionId]
  ) as Promise<ChatAttachmentRecord[]>
}

export async function createChatAttachment(
  sessionId: number,
  data: {
    name: string
    file_path?: string | null
    file_type: string
    extracted_text: string
    size_bytes: number
    error?: string | null
  }
): Promise<number> {
  return executeInsert(
    `INSERT INTO chat_attachments (session_id, name, file_path, file_type, extracted_text, size_bytes, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      data.name,
      data.file_path ?? null,
      data.file_type,
      data.extracted_text,
      data.size_bytes,
      data.error ?? null,
    ]
  )
}

export async function deleteChatAttachment(id: number): Promise<number> {
  return executeDelete('DELETE FROM chat_attachments WHERE id = ?', [id])
}

export async function deleteChatAttachmentsBySession(sessionId: number): Promise<number> {
  return executeDelete('DELETE FROM chat_attachments WHERE session_id = ?', [sessionId])
}
