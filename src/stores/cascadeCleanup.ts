import { useDocumentStore } from './documentStore'
import { useFolderStore } from './folderStore'
import { useDeadlineStore } from './deadlineStore'
import { useChatStore } from './chatStore'
import type { DocumentFolder } from '@/types'

export interface CascadeCleanupResult {
  ok: boolean
  warnings: string[]
}

function collectDescendantFolderIds(
  folders: DocumentFolder[],
  initialIds: Set<number>
): Set<number> {
  const idsToRemove = new Set(initialIds)
  const queue = [...initialIds]

  while (queue.length > 0) {
    const parentId = queue.shift()!
    for (const folder of folders) {
      if (folder.parent_id === parentId && !idsToRemove.has(folder.id)) {
        idsToRemove.add(folder.id)
        queue.push(folder.id)
      }
    }
  }

  return idsToRemove
}

async function runCleanupSteps(
  steps: Array<{ label: string; run: () => void }>
): Promise<CascadeCleanupResult> {
  const warnings: string[] = []
  const settled = await Promise.allSettled(
    steps.map(async (step) => {
      step.run()
    })
  )

  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      const message =
        result.reason instanceof Error ? result.reason.message : String(result.reason)
      warnings.push(`${steps[index].label}: ${message}`)
    }
  })

  return {
    ok: warnings.length === 0,
    warnings,
  }
}

export async function cleanupAfterClientDelete(
  clientId: number,
  caseIdsToRemove: number[]
): Promise<CascadeCleanupResult> {
  const caseIdsSet = new Set(caseIdsToRemove)

  return runCleanupSteps([
    {
      label: 'documents',
      run: () => {
        useDocumentStore.setState((state) => {
          const documents = state.documents.filter((d) => d.client_id !== clientId)
          const documentIds = new Set(documents.map((d) => d.id))
          const extractedTextCache = new Map(
            [...state.extractedTextCache.entries()].filter(([docId]) =>
              documentIds.has(docId)
            )
          )
          return { documents, extractedTextCache }
        })
      },
    },
    {
      label: 'folders',
      run: () => {
        useFolderStore.setState((state) => {
          if (state.folders.length === 0) {
            return {}
          }

          const rootIds = new Set<number>()
          state.folders.forEach((folder) => {
            const isClientFolder = folder.client_id === clientId
            const isCaseFolder =
              folder.case_id !== null && caseIdsSet.has(folder.case_id)
            if (isClientFolder || isCaseFolder) {
              rootIds.add(folder.id)
            }
          })

          if (rootIds.size === 0) {
            return {}
          }

          const idsToRemove = collectDescendantFolderIds(state.folders, rootIds)
          const folders = state.folders.filter((folder) => !idsToRemove.has(folder.id))
          const selectedFolderId =
            state.selectedFolderId && idsToRemove.has(state.selectedFolderId)
              ? null
              : state.selectedFolderId
          const expandedIds = new Set(
            [...state.expandedIds].filter((folderId) => !idsToRemove.has(folderId))
          )

          return { folders, selectedFolderId, expandedIds }
        })
      },
    },
    {
      label: 'deadlines',
      run: () => {
        useDeadlineStore.setState((state) => ({
          deadlines: state.deadlines.map((deadline) => {
            const clearClient = deadline.client_id === clientId
            const clearCase =
              deadline.case_id !== null && caseIdsSet.has(deadline.case_id)
            if (!clearClient && !clearCase) return deadline
            return {
              ...deadline,
              client_id: clearClient ? null : deadline.client_id,
              case_id: clearCase ? null : deadline.case_id,
            }
          }),
        }))
      },
    },
    {
      label: 'chat',
      run: () => {
        useChatStore.setState((state) => {
          const sessions = state.sessions.map((session) =>
            session.case_id !== null && caseIdsSet.has(session.case_id)
              ? { ...session, case_id: null }
              : session
          )
          const activeSession =
            state.activeSession &&
            state.activeSession.case_id !== null &&
            caseIdsSet.has(state.activeSession.case_id)
              ? { ...state.activeSession, case_id: null }
              : state.activeSession
          return { sessions, activeSession }
        })
      },
    },
  ])
}

export async function cleanupAfterCaseDelete(
  caseId: number,
  caseFolderIds: number[]
): Promise<CascadeCleanupResult> {
  const folderIdsSet = new Set(caseFolderIds)

  return runCleanupSteps([
    {
      label: 'documents',
      run: () => {
        useDocumentStore.setState((state) => ({
          documents: state.documents.map((document) => {
            const clearCase = document.case_id === caseId
            const clearFolder =
              document.folder_id !== null && folderIdsSet.has(document.folder_id)
            if (!clearCase && !clearFolder) return document
            return {
              ...document,
              case_id: clearCase ? null : document.case_id,
              folder_id: clearFolder ? null : document.folder_id,
            }
          }),
        }))
      },
    },
    {
      label: 'deadlines',
      run: () => {
        useDeadlineStore.setState((state) => ({
          deadlines: state.deadlines.map((deadline) =>
            deadline.case_id === caseId ? { ...deadline, case_id: null } : deadline
          ),
        }))
      },
    },
    {
      label: 'folders',
      run: () => {
        useFolderStore.setState((state) => {
          if (state.folders.length === 0) {
            return {}
          }

          const rootIds = new Set<number>()
          state.folders.forEach((folder) => {
            if (folder.case_id === caseId) {
              rootIds.add(folder.id)
            }
          })

          if (rootIds.size === 0) {
            return {}
          }

          const idsToRemove = collectDescendantFolderIds(state.folders, rootIds)
          const folders = state.folders.filter((folder) => !idsToRemove.has(folder.id))
          const selectedFolderId =
            state.selectedFolderId && idsToRemove.has(state.selectedFolderId)
              ? null
              : state.selectedFolderId
          const expandedIds = new Set(
            [...state.expandedIds].filter((folderId) => !idsToRemove.has(folderId))
          )

          return { folders, selectedFolderId, expandedIds }
        })
      },
    },
    {
      label: 'chat',
      run: () => {
        useChatStore.setState((state) => {
          const sessions = state.sessions.map((session) =>
            session.case_id === caseId ? { ...session, case_id: null } : session
          )
          const activeSession =
            state.activeSession && state.activeSession.case_id === caseId
              ? { ...state.activeSession, case_id: null }
              : state.activeSession
          return { sessions, activeSession }
        })
      },
    },
  ])
}
