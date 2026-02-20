const DOCUMENTS_ROOT_DIR = 'documents'
const CHAT_ATTACHMENTS_ROOT_DIR = 'chat_attachments'

export interface StorageRoots {
  appDataRoot: string
  documentsRoot: string
  attachmentsRoot: string
}

let storageRootsPromise: Promise<StorageRoots> | null = null

function isTauriAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  } catch {
    return false
  }
}

function normalizeForCompare(value: string): string {
  return value
    .replace(/[\\/]+$/g, '')
    .toLowerCase()
}

async function normalizePath(value: string): Promise<string> {
  const { normalize } = await import('@tauri-apps/api/path')
  return normalize(value)
}

export async function getStorageRoots(): Promise<StorageRoots> {
  if (!isTauriAvailable()) {
    throw new Error('Storage roots are available only in the Tauri environment.')
  }

  if (!storageRootsPromise) {
    storageRootsPromise = (async () => {
      const { appDataDir, join } = await import('@tauri-apps/api/path')
      const appDataRoot = await appDataDir()
      const [documentsRoot, attachmentsRoot] = await Promise.all([
        join(appDataRoot, DOCUMENTS_ROOT_DIR),
        join(appDataRoot, CHAT_ATTACHMENTS_ROOT_DIR),
      ])

      const [normalizedAppDataRoot, normalizedDocumentsRoot, normalizedAttachmentsRoot] = await Promise.all([
        normalizePath(appDataRoot),
        normalizePath(documentsRoot),
        normalizePath(attachmentsRoot),
      ])

      return {
        appDataRoot: normalizedAppDataRoot,
        documentsRoot: normalizedDocumentsRoot,
        attachmentsRoot: normalizedAttachmentsRoot,
      }
    })().catch((error) => {
      storageRootsPromise = null
      throw error
    })
  }

  return storageRootsPromise
}

export async function isPathWithinRoot(candidatePath: string, rootPath: string): Promise<boolean> {
  if (!candidatePath || !rootPath || !isTauriAvailable()) return false

  try {
    const [normalizedCandidatePath, normalizedRootPath] = await Promise.all([
      normalizePath(candidatePath),
      normalizePath(rootPath),
    ])

    const candidate = normalizeForCompare(normalizedCandidatePath)
    const root = normalizeForCompare(normalizedRootPath)

    return (
      candidate === root ||
      candidate.startsWith(`${root}\\`) ||
      candidate.startsWith(`${root}/`)
    )
  } catch {
    return false
  }
}

export async function isManagedDocumentPath(filePath: string): Promise<boolean> {
  if (!filePath || !isTauriAvailable()) return false
  const roots = await getStorageRoots()
  return isPathWithinRoot(filePath, roots.documentsRoot)
}

export async function isManagedAttachmentPath(filePath: string): Promise<boolean> {
  if (!filePath || !isTauriAvailable()) return false
  const roots = await getStorageRoots()
  return isPathWithinRoot(filePath, roots.attachmentsRoot)
}

export async function sanitizeImportedDocumentPath(filePath: unknown): Promise<string> {
  if (typeof filePath !== 'string' || !filePath.trim()) return ''
  if (!isTauriAvailable()) return filePath
  return (await isManagedDocumentPath(filePath)) ? filePath : ''
}

export async function sanitizeImportedAttachmentPath(filePath: unknown): Promise<string | null> {
  if (typeof filePath !== 'string' || !filePath.trim()) return null
  if (!isTauriAvailable()) return filePath
  return (await isManagedAttachmentPath(filePath)) ? filePath : null
}
