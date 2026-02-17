import { isTauriEnvironment } from './db'

const DOCUMENTS_ROOT_DIR = 'documents'

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^\w.-]/g, '_').replace(/^\.+/, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return `document_${Date.now()}`
  }
  return cleaned
}

function splitFileName(fileName: string): { base: string; ext: string } {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot <= 0) {
    return { base: fileName, ext: '' }
  }
  return {
    base: fileName.slice(0, lastDot),
    ext: fileName.slice(lastDot),
  }
}

async function ensureDirectory(path: string): Promise<void> {
  const { exists, mkdir } = await import('@tauri-apps/plugin-fs')
  const dirExists = await exists(path)
  if (!dirExists) {
    await mkdir(path, { recursive: true })
  }
}

export async function ensureClientDocumentDir(clientId: number): Promise<string> {
  if (!isTauriEnvironment()) {
    throw new Error('Document storage is only available in the Tauri environment.')
  }

  const { appDataDir, join } = await import('@tauri-apps/api/path')
  const appData = await appDataDir()
  const clientDir = await join(appData, DOCUMENTS_ROOT_DIR, String(clientId))
  await ensureDirectory(clientDir)
  return clientDir
}

async function resolveUniqueFilePath(dir: string, fileName: string): Promise<string> {
  const { join } = await import('@tauri-apps/api/path')
  const { exists } = await import('@tauri-apps/plugin-fs')

  const safeName = sanitizeFileName(fileName)
  const { base, ext } = splitFileName(safeName)

  let candidateName = safeName
  let candidatePath = await join(dir, candidateName)
  let counter = 1

  while (await exists(candidatePath)) {
    candidateName = `${base}_${counter}${ext}`
    candidatePath = await join(dir, candidateName)
    counter += 1
  }

  return candidatePath
}

export async function saveClientDocumentFile(clientId: number, file: File): Promise<string> {
  if (!isTauriEnvironment()) {
    throw new Error('Document upload is only available in the Tauri environment.')
  }

  const clientDir = await ensureClientDocumentDir(clientId)
  const filePath = await resolveUniqueFilePath(clientDir, file.name)
  const buffer = await file.arrayBuffer()
  const { writeFile } = await import('@tauri-apps/plugin-fs')
  await writeFile(filePath, new Uint8Array(buffer))
  return filePath
}

export async function removeStoredDocumentFile(filePath?: string | null): Promise<void> {
  if (!isTauriEnvironment() || !filePath) return

  try {
    const { exists, remove } = await import('@tauri-apps/plugin-fs')
    if (await exists(filePath)) {
      await remove(filePath)
    }
  } catch (error) {
    console.error('[DocumentStorage] Failed to remove file:', error)
  }
}

export async function removeClientDocumentDirIfEmpty(clientId: number): Promise<void> {
  if (!isTauriEnvironment()) return

  try {
    const { appDataDir, join } = await import('@tauri-apps/api/path')
    const { exists, readDir, remove } = await import('@tauri-apps/plugin-fs')

    const appData = await appDataDir()
    const clientDir = await join(appData, DOCUMENTS_ROOT_DIR, String(clientId))
    const dirExists = await exists(clientDir)
    if (!dirExists) return

    const entries = await readDir(clientDir)
    if (entries.length === 0) {
      await remove(clientDir)
    }
  } catch (error) {
    console.error('[DocumentStorage] Failed to remove client directory:', error)
  }
}
