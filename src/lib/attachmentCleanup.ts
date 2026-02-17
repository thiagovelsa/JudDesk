import { isTauriEnvironment, getDatabase } from './db'

export interface AttachmentCleanupResult {
  deletedRows: number
  clearedDbPaths: number
  removedFiles: number
  removedDirs: number
}

export async function cleanupOrphanChatAttachments(): Promise<AttachmentCleanupResult> {
  const result: AttachmentCleanupResult = {
    deletedRows: 0,
    clearedDbPaths: 0,
    removedFiles: 0,
    removedDirs: 0,
  }

  if (!isTauriEnvironment()) return result

  try {
    const database = await getDatabase()

    const deleteResult = await database.execute(
      'DELETE FROM chat_attachments WHERE session_id NOT IN (SELECT id FROM chat_sessions)'
    )
    result.deletedRows = deleteResult.rowsAffected ?? 0

    const attachments = await database.select<
      Array<{ id: number; file_path: string | null }>
    >(
      `SELECT id, file_path FROM chat_attachments
       WHERE file_path IS NOT NULL AND file_path != ''`
    )

    const { exists, readDir, remove, stat } = await import('@tauri-apps/plugin-fs')
    const { appDataDir, join } = await import('@tauri-apps/api/path')

    for (const attachment of attachments) {
      if (!attachment.file_path) continue
      const fileExists = await exists(attachment.file_path)
      if (!fileExists) {
        await database.execute(
          'UPDATE chat_attachments SET file_path = NULL WHERE id = ?',
          [attachment.id]
        )
        result.clearedDbPaths += 1
      }
    }

    const appData = await appDataDir()
    const attachmentsRoot = await join(appData, 'chat_attachments')
    const rootExists = await exists(attachmentsRoot)
    if (!rootExists) return result

    const knownPaths = new Set(
      attachments
        .map((attachment) => attachment.file_path)
        .filter((path): path is string => Boolean(path))
    )

    const sessionDirs = await readDir(attachmentsRoot)
    for (const entry of sessionDirs) {
      if (!entry.name) continue
      const sessionDirPath = await join(attachmentsRoot, entry.name)
      try {
        const info = await stat(sessionDirPath)
        if (!info.isDirectory) continue
      } catch {
        continue
      }

      const sessionEntries = await readDir(sessionDirPath)
      for (const fileEntry of sessionEntries) {
        if (!fileEntry.name) continue
        const filePath = await join(sessionDirPath, fileEntry.name)
        if (!knownPaths.has(filePath)) {
          try {
            await remove(filePath)
            result.removedFiles += 1
          } catch (error) {
            console.error('[Attachments] Failed to remove orphan file:', error)
          }
        }
      }

      const remaining = await readDir(sessionDirPath)
      if (remaining.length === 0) {
        try {
          await remove(sessionDirPath)
          result.removedDirs += 1
        } catch (error) {
          console.error('[Attachments] Failed to remove empty dir:', error)
        }
      }
    }
  } catch (error) {
    console.error('[Attachments] Cleanup failed:', error)
  }

  return result
}
