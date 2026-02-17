/**
 * @fileoverview Sistema de Backup Automático para JurisDesk.
 * Executa backups automáticos com debounce após cada operação CRUD.
 *
 * @module autoBackup
 */

import { exportDatabase, isTauriEnvironment, type DatabaseBackup } from './db'

// ============================================================================
// Types
// ============================================================================

export interface BackupConfig {
  enabled: boolean
  backupPath: string | null
  maxBackups: number
  debounceMs: number
  minIntervalMs: number
}

export interface BackupInfo {
  filename: string
  path: string
  size: number
  createdAt: string
}

// ============================================================================
// State
// ============================================================================

let backupTimeout: ReturnType<typeof setTimeout> | null = null
let pendingBackup = false
let isBackupInProgress = false
let cachedConfig: BackupConfig | null = null
let lastBackupStartedAt: number | null = null

// Default configuration
const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  backupPath: null,
  maxBackups: 10,
  debounceMs: 5000,
  minIntervalMs: 60000,
}

// ============================================================================
// Settings Helpers (avoid circular dependency with settingsStore)
// ============================================================================

async function getSettingValue(key: string): Promise<string | null> {
  if (!isTauriEnvironment()) return null

  try {
    const { executeQuery } = await import('./db')
    const rows = await executeQuery<{ value: string | null }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    )
    return rows[0]?.value ?? null
  } catch {
    return null
  }
}

async function setSettingValue(key: string, value: string | null): Promise<void> {
  if (!isTauriEnvironment()) return

  try {
    const { getDatabase } = await import('./db')
    const database = await getDatabase()
    await database.execute(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    )
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('jurisdesk:database-changed', {
          detail: { operation: 'update', timestamp: Date.now() },
        })
      )
    }
  } catch (error) {
    console.error('[AutoBackup] Failed to save setting:', error)
  }
}

// ============================================================================
// Configuration
// ============================================================================

export async function loadBackupConfig(): Promise<BackupConfig> {
  if (!isTauriEnvironment()) return DEFAULT_CONFIG

  const [enabled, backupPath, maxBackups, debounceMs, minIntervalMs] = await Promise.all([
    getSettingValue('auto_backup_enabled'),
    getSettingValue('auto_backup_path'),
    getSettingValue('auto_backup_max_count'),
    getSettingValue('auto_backup_debounce'),
    getSettingValue('auto_backup_min_interval_ms'),
  ])

  const parsedMaxBackups = maxBackups ? parseInt(maxBackups, 10) : NaN
  const parsedDebounce = debounceMs ? parseInt(debounceMs, 10) : NaN
  const parsedMinInterval = minIntervalMs ? parseInt(minIntervalMs, 10) : NaN

  cachedConfig = {
    enabled: enabled !== 'false', // Default to true
    backupPath: backupPath,
    maxBackups:
      Number.isFinite(parsedMaxBackups) && parsedMaxBackups > 0
        ? parsedMaxBackups
        : DEFAULT_CONFIG.maxBackups,
    debounceMs:
      Number.isFinite(parsedDebounce) && parsedDebounce > 0
        ? parsedDebounce
        : DEFAULT_CONFIG.debounceMs,
    minIntervalMs:
      Number.isFinite(parsedMinInterval) && parsedMinInterval > 0
        ? parsedMinInterval
        : DEFAULT_CONFIG.minIntervalMs,
  }

  return cachedConfig
}

export function getBackupConfig(): BackupConfig {
  return cachedConfig ?? DEFAULT_CONFIG
}

export async function setBackupEnabled(enabled: boolean): Promise<void> {
  await setSettingValue('auto_backup_enabled', enabled ? 'true' : 'false')
  if (cachedConfig) cachedConfig.enabled = enabled
}

export async function setBackupPath(path: string | null): Promise<void> {
  await setSettingValue('auto_backup_path', path)
  if (cachedConfig) cachedConfig.backupPath = path
}

export async function setMaxBackups(count: number): Promise<void> {
  const normalizedCount =
    Number.isFinite(count) && count > 0
      ? Math.floor(count)
      : DEFAULT_CONFIG.maxBackups
  await setSettingValue('auto_backup_max_count', String(normalizedCount))
  if (cachedConfig) cachedConfig.maxBackups = normalizedCount
}

// ============================================================================
// Directory Management
// ============================================================================

/**
 * Validates that the backup path is within allowed directories (AppData, Desktop, Download)
 * to prevent path traversal attacks.
 */
async function isValidBackupPath(path: string): Promise<boolean> {
  const { appDataDir, desktopDir, downloadDir, normalize } = await import('@tauri-apps/api/path')

  const [appData, desktop, download, normalizedPath] = await Promise.all([
    appDataDir(),
    desktopDir(),
    downloadDir(),
    normalize(path),
  ])

  // Check if path is within allowed directories using directory boundary checks.
  // This prevents false positives like:
  // - allowed: C:\Users\User\AppData
  // - candidate: C:\Users\User\AppData_malicious
  const normalizeForCompare = (value: string) =>
    value
      .replace(/[\\/]+$/g, '')
      .toLowerCase()

  const candidate = normalizeForCompare(normalizedPath)
  const allowedPrefixes = [appData, desktop, download].map(normalizeForCompare)

  return allowedPrefixes.some((prefix) =>
    candidate === prefix ||
    candidate.startsWith(`${prefix}\\`) ||
    candidate.startsWith(`${prefix}/`)
  )
}

async function getBackupDirectory(): Promise<string> {
  const config = getBackupConfig()

  if (config.backupPath) {
    // Validate path to prevent path traversal
    const isValid = await isValidBackupPath(config.backupPath)
    if (!isValid) {
      console.error('[AutoBackup] Invalid backup path (path traversal detected):', config.backupPath)
      console.warn('[AutoBackup] Falling back to default backup directory')
    } else {
      await ensureDirectory(config.backupPath)
      return config.backupPath
    }
  }

  // Default: AppData/JurisDesk/backups
  const { appDataDir, join } = await import('@tauri-apps/api/path')
  const appData = await appDataDir()
  const backupDir = await join(appData, 'backups')
  await ensureDirectory(backupDir)
  return backupDir
}

async function ensureDirectory(path: string): Promise<void> {
  try {
    const { mkdir, exists } = await import('@tauri-apps/plugin-fs')
    const dirExists = await exists(path)
    if (!dirExists) {
      await mkdir(path, { recursive: true })
    }
  } catch (error) {
    console.error('[AutoBackup] Failed to create directory:', error)
  }
}

// ============================================================================
// Backup Operations
// ============================================================================

/**
 * Triggers a debounced backup.
 * Call this after any CRUD operation.
 */
export function triggerBackup(): void {
  if (!isTauriEnvironment()) return

  const config = getBackupConfig()
  if (!config.enabled) return

  pendingBackup = true

  if (backupTimeout) {
    clearTimeout(backupTimeout)
  }

  const executeWhenReady = async () => {
    backupTimeout = null

    if (!pendingBackup) return

    if (isBackupInProgress) {
      // Backup em andamento - re-agendar para depois
      if (import.meta.env.DEV) console.log('[AutoBackup] Backup in progress, rescheduling...')
      triggerBackup()
      return
    }

    const elapsedSinceLast =
      lastBackupStartedAt === null ? Number.POSITIVE_INFINITY : Date.now() - lastBackupStartedAt
    const waitForInterval = Math.max(0, config.minIntervalMs - elapsedSinceLast)
    if (waitForInterval > 0) {
      backupTimeout = setTimeout(() => {
        void executeWhenReady()
      }, waitForInterval)
      return
    }

    pendingBackup = false
    try {
      await executeBackup()
    } catch (error) {
      console.error('[AutoBackup] Backup failed:', error)
    }

    // Se houve novo CRUD durante execução do backup, agendar outro
    if (pendingBackup) {
      triggerBackup()
    }
  }

  backupTimeout = setTimeout(() => {
    void executeWhenReady()
  }, config.debounceMs)
}

/**
 * Executes a backup immediately.
 * @returns BackupInfo with details about the created backup
 */
export async function executeBackup(): Promise<BackupInfo | null> {
  if (!isTauriEnvironment()) return null
  if (isBackupInProgress) return null

  isBackupInProgress = true

  try {
    lastBackupStartedAt = Date.now()
    const backup = await exportDatabase()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `jurisdesk_auto_${timestamp}.json`

    const backupDir = await getBackupDirectory()
    const { join } = await import('@tauri-apps/api/path')
    const fullPath = await join(backupDir, filename)

    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const content = JSON.stringify(backup)
    await writeTextFile(fullPath, content)

    // Update last backup timestamp
    await setSettingValue('last_auto_backup', new Date().toISOString())

    // Rotate old backups
    await rotateBackups()

    if (import.meta.env.DEV) console.log('[AutoBackup] Backup created:', filename)

    return {
      filename,
      path: fullPath,
      size: content.length,
      createdAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[AutoBackup] Failed to execute backup:', error)
    return null
  } finally {
    isBackupInProgress = false
  }
}

/**
 * Gets the list of available backups.
 */
export async function getBackupList(): Promise<BackupInfo[]> {
  if (!isTauriEnvironment()) return []

  try {
    const backupDir = await getBackupDirectory()
    const { readDir, stat } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')

    const entries = await readDir(backupDir)
    const backups: BackupInfo[] = []

    for (const entry of entries) {
      if (entry.name?.startsWith('jurisdesk_auto_') && entry.name.endsWith('.json')) {
        const fullPath = await join(backupDir, entry.name)
        try {
          const fileInfo = await stat(fullPath)
          backups.push({
            filename: entry.name,
            path: fullPath,
            size: fileInfo.size,
            createdAt: extractDateFromFilename(entry.name),
          })
        } catch {
          // Skip files we can't stat
        }
      }
    }

    // Sort by date (newest first)
    return backups.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  } catch (error) {
    console.error('[AutoBackup] Failed to list backups:', error)
    return []
  }
}

function extractDateFromFilename(filename: string): string {
  // Format: jurisdesk_auto_2024-12-15T14-32-45-123Z.json
  const match = filename.match(/jurisdesk_auto_(.+)\.json/)
  if (match) {
    // Convert back to ISO format
    const parts = match[1].split('T')
    if (parts.length === 2) {
      const datePart = parts[0]
      const timePart = parts[1].replace(/-/g, ':').replace(/:(\d{3})Z?$/, '.$1Z')
      return `${datePart}T${timePart}`
    }
  }
  return new Date().toISOString()
}

/**
 * Validates backup filename to prevent path traversal attacks.
 */
function isValidBackupFilename(filename: string): boolean {
  if (!filename || filename.length > 255) return false
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return false
  // Only allow expected backup filename pattern
  const validPattern = /^jurisdesk_auto_\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/
  return validPattern.test(filename)
}

/**
 * Deletes a specific backup file.
 */
export async function deleteBackup(filename: string): Promise<void> {
  if (!isTauriEnvironment()) return

  // Validate filename to prevent path traversal
  if (!isValidBackupFilename(filename)) {
    console.error('[AutoBackup] Invalid backup filename:', filename)
    return
  }

  try {
    const backupDir = await getBackupDirectory()
    const { join } = await import('@tauri-apps/api/path')
    const fullPath = await join(backupDir, filename)

    const { remove } = await import('@tauri-apps/plugin-fs')
    await remove(fullPath)

    if (import.meta.env.DEV) console.log('[AutoBackup] Deleted backup:', filename)
  } catch (error) {
    console.error('[AutoBackup] Failed to delete backup:', error)
  }
}

/**
 * Restores the database from a backup file.
 */
export async function restoreFromBackup(filename: string): Promise<void> {
  if (!isTauriEnvironment()) return

  // Validate filename to prevent path traversal
  if (!isValidBackupFilename(filename)) {
    throw new Error('Nome de arquivo de backup inválido')
  }

  const backupDir = await getBackupDirectory()
  const { join } = await import('@tauri-apps/api/path')
  const fullPath = await join(backupDir, filename)

  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  const content = await readTextFile(fullPath)

  // Safely parse JSON with validation
  let backup: DatabaseBackup
  try {
    backup = JSON.parse(content)
  } catch {
    throw new Error('Arquivo de backup corrompido ou inválido')
  }

  // Basic schema validation
  if (!backup || typeof backup !== 'object') {
    throw new Error('Formato de backup inválido')
  }

  const { importDatabase } = await import('./db')
  await importDatabase(backup)

  if (import.meta.env.DEV) console.log('[AutoBackup] Restored from backup:', filename)
}

/**
 * Rotates backups, keeping only the most recent N backups.
 */
async function rotateBackups(): Promise<void> {
  const config = getBackupConfig()
  const backups = await getBackupList()

  if (backups.length > config.maxBackups) {
    // Backups are already sorted newest first
    const toDelete = backups.slice(config.maxBackups)

    for (const backup of toDelete) {
      await deleteBackup(backup.filename)
    }
  }
}

/**
 * Gets the timestamp of the last automatic backup.
 */
export async function getLastBackupTime(): Promise<string | null> {
  return getSettingValue('last_auto_backup')
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the auto-backup system.
 * Call this when the app starts.
 */
export async function initAutoBackup(): Promise<void> {
  if (!isTauriEnvironment()) return

  await loadBackupConfig()
  const config = getBackupConfig()

  if (!config.enabled) {
    if (import.meta.env.DEV) console.log('[AutoBackup] Auto-backup is disabled')
    return
  }

  if (import.meta.env.DEV) console.log('[AutoBackup] System initialized')

  // Check if we need an immediate backup (more than 24h since last)
  const lastBackup = await getLastBackupTime()
  if (lastBackup) {
    const lastDate = new Date(lastBackup)
    const hoursSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60)

    if (hoursSince > 24) {
      if (import.meta.env.DEV) console.log('[AutoBackup] More than 24h since last backup, executing now...')
      await executeBackup()
    }
  } else {
    // First backup ever
    if (import.meta.env.DEV) console.log('[AutoBackup] No previous backup found, creating initial backup...')
    await executeBackup()
  }
}

/**
 * Formats file size to human readable string.
 * Re-exported from utils.ts for backwards compatibility
 */
export { formatFileSize } from './utils'
