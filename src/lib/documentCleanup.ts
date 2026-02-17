import { isTauriEnvironment, getDatabase } from './db'

export interface DocumentCleanupResult {
  removedFiles: number
  removedDirs: number
}

export async function cleanupOrphanClientDocuments(): Promise<DocumentCleanupResult> {
  const result: DocumentCleanupResult = {
    removedFiles: 0,
    removedDirs: 0,
  }

  if (!isTauriEnvironment()) return result

  try {
    const database = await getDatabase()
    const rows = await database.select<Array<{ file_path: string }>>(
      `SELECT file_path FROM documents
       WHERE file_path IS NOT NULL AND file_path != ''`
    )

    const knownPaths = new Set(
      rows
        .map((row) => row.file_path)
        .filter((path): path is string => Boolean(path))
    )

    const { appDataDir, join } = await import('@tauri-apps/api/path')
    const { exists, readDir, remove, stat } = await import('@tauri-apps/plugin-fs')

    const appData = await appDataDir()
    const documentsRoot = await join(appData, 'documents')

    const rootExists = await exists(documentsRoot)
    if (!rootExists) return result

    const clientDirs = await readDir(documentsRoot)
    for (const entry of clientDirs) {
      if (!entry.name) continue
      const clientDirPath = await join(documentsRoot, entry.name)

      try {
        const info = await stat(clientDirPath)
        if (!info.isDirectory) continue
      } catch {
        continue
      }

      const files = await readDir(clientDirPath)
      for (const fileEntry of files) {
        if (!fileEntry.name) continue
        const filePath = await join(clientDirPath, fileEntry.name)
        if (!knownPaths.has(filePath)) {
          try {
            await remove(filePath)
            result.removedFiles += 1
          } catch (error) {
            console.error('[Documents] Failed to remove orphan file:', error)
          }
        }
      }

      const remaining = await readDir(clientDirPath)
      if (remaining.length === 0) {
        try {
          await remove(clientDirPath)
          result.removedDirs += 1
        } catch (error) {
          console.error('[Documents] Failed to remove empty dir:', error)
        }
      }
    }
  } catch (error) {
    console.error('[Documents] Cleanup failed:', error)
  }

  return result
}
