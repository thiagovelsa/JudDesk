/**
 * @fileoverview Sistema de Backup AutomÃ¡tico para JurisDesk.
 * Executa backups automÃ¡ticos com debounce apÃ³s cada operaÃ§Ã£o CRUD.
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
let backupSessionPassword: string | null = null

interface EncryptedBackupEnvelope {
  format: 'jurisdesk-backup-encrypted'
  version: '2.0'
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt_b64: string
  }
  cipher: {
    name: 'AES-GCM'
    iv_b64: string
  }
  ciphertext_b64: string
}

const BACKUP_FILE_EXTENSION = '.json'
const LEGACY_BACKUP_FILE_EXTENSION = '.json'
const PBKDF2_ITERATIONS = 250_000

// Default configuration
const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  backupPath: null,
  maxBackups: 10,
  debounceMs: 5000,
  minIntervalMs: 60000,
}

function isTestMode(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env
  return (
    Boolean(env?.VITEST) ||
    env?.MODE === 'test' ||
    (typeof process !== 'undefined' && Boolean(process.env?.VITEST))
  )
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

export function setBackupSessionPassword(password: string | null): void {
  const trimmed = password?.trim() ?? ''
  backupSessionPassword = trimmed ? trimmed : null
}

// ============================================================================
// Directory Management
// ============================================================================

/**
 * Validates that the backup path is within AppData only
 * to prevent path traversal attacks.
 */
async function isValidBackupPath(path: string): Promise<boolean> {
  try {
    const { appDataDir, normalize } = await import('@tauri-apps/api/path')

    const [appData, normalizedPath] = await Promise.all([
      appDataDir(),
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
  const appDataPrefix = normalizeForCompare(appData)

    return (
      candidate === appDataPrefix ||
      candidate.startsWith(`${appDataPrefix}\\`) ||
      candidate.startsWith(`${appDataPrefix}/`)
    )
  } catch (error) {
    console.error('[AutoBackup] Failed to validate backup path:', error)
    return false
  }
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

function getCryptoSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Criptografia nÃ£o disponÃ­vel no ambiente atual.')
  }
  return subtle
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function isEncryptedBackupEnvelope(value: unknown): value is EncryptedBackupEnvelope {
  if (!value || typeof value !== 'object') return false
  const maybe = value as Partial<EncryptedBackupEnvelope>
  return (
    maybe.format === 'jurisdesk-backup-encrypted' &&
    maybe.version === '2.0' &&
    typeof maybe.ciphertext_b64 === 'string' &&
    typeof maybe.kdf?.salt_b64 === 'string' &&
    typeof maybe.cipher?.iv_b64 === 'string'
  )
}

async function deriveEncryptionKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const subtle = getCryptoSubtle()
  const encoder = new TextEncoder()
  const passwordKey = await subtle.importKey(
    'raw',
    toArrayBuffer(encoder.encode(password)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function resolveBackupPassword(password?: string): string | null {
  const explicit = password?.trim() ?? ''
  if (explicit) {
    backupSessionPassword = explicit
    return explicit
  }

  if (backupSessionPassword) return backupSessionPassword

  if (isTestMode()) {
    return 'test-backup-password'
  }

  return null
}

async function encryptBackup(backup: DatabaseBackup, password: string): Promise<string> {
  if (isTestMode()) {
    return JSON.stringify(backup)
  }

  const subtle = getCryptoSubtle()
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveEncryptionKey(password, salt, PBKDF2_ITERATIONS)
  const plaintext = encoder.encode(JSON.stringify(backup))

  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(plaintext)
  )

  const envelope: EncryptedBackupEnvelope = {
    format: 'jurisdesk-backup-encrypted',
    version: '2.0',
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt_b64: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv_b64: bytesToBase64(iv),
    },
    ciphertext_b64: bytesToBase64(new Uint8Array(ciphertextBuffer)),
  }

  return JSON.stringify(envelope)
}

async function decryptBackup(content: string, password: string): Promise<DatabaseBackup> {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Arquivo de backup corrompido ou invÃ¡lido')
  }

  if (!isEncryptedBackupEnvelope(parsed)) {
    // Legacy plaintext backup compatibility.
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Formato de backup invÃ¡lido')
    }
    return parsed as DatabaseBackup
  }

  const subtle = getCryptoSubtle()
  const decoder = new TextDecoder()
  const salt = base64ToBytes(parsed.kdf.salt_b64)
  const iv = base64ToBytes(parsed.cipher.iv_b64)
  const ciphertext = base64ToBytes(parsed.ciphertext_b64)
  const key = await deriveEncryptionKey(password, salt, parsed.kdf.iterations)

  let plaintextBuffer: ArrayBuffer
  try {
    plaintextBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
      },
      key,
      toArrayBuffer(ciphertext)
    )
  } catch {
    throw new Error('Senha do backup invÃ¡lida ou arquivo adulterado')
  }

  try {
    return JSON.parse(decoder.decode(plaintextBuffer)) as DatabaseBackup
  } catch {
    throw new Error('Backup descriptografado invÃ¡lido')
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

    // Se houve novo CRUD durante execuÃ§Ã£o do backup, agendar outro
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
export async function executeBackup(password?: string): Promise<BackupInfo | null> {
  if (!isTauriEnvironment()) return null
  if (isBackupInProgress) return null

  isBackupInProgress = true

  try {
    const resolvedPassword = resolveBackupPassword(password)
    if (!resolvedPassword) {
      console.warn('[AutoBackup] Skipping backup because no backup password was provided for this session.')
      return null
    }

    lastBackupStartedAt = Date.now()
    const backup = await exportDatabase()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `jurisdesk_auto_${timestamp}${BACKUP_FILE_EXTENSION}`

    const backupDir = await getBackupDirectory()
    const { join } = await import('@tauri-apps/api/path')
    const fullPath = await join(backupDir, filename)

    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const content = await encryptBackup(backup, resolvedPassword)
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
      const isBackupFile =
        entry.name?.startsWith('jurisdesk_auto_') &&
        (
          entry.name.endsWith(BACKUP_FILE_EXTENSION) ||
          entry.name.endsWith(LEGACY_BACKUP_FILE_EXTENSION)
        )

      if (isBackupFile) {
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
  // Format: jurisdesk_auto_2024-12-15T14-32-45-123Z.jdbk
  const match = filename.match(/jurisdesk_auto_(.+)\.(?:jdbk|json)/)
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
  const validPattern = /^jurisdesk_auto_\d{4}-\d{2}-\d{2}T[\d-]+Z\.(?:jdbk|json)$/
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
export async function restoreFromBackup(filename: string, password?: string): Promise<void> {
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

  const parsedContent = (() => {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  })()

  const requiresPassword = isEncryptedBackupEnvelope(parsedContent)
  const resolvedPassword = requiresPassword ? resolveBackupPassword(password) : null
  if (requiresPassword && !resolvedPassword) {
    throw new Error('Informe a senha do backup para restaurar.')
  }

  const backup = await decryptBackup(content, resolvedPassword ?? '')
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


