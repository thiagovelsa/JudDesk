import { create } from 'zustand'
import { executeQuery, executeInsert, executeUpdate, executeDelete } from '@/lib/db'
import { triggerBackup } from '@/lib/autoBackup'
import { getErrorMessage } from '@/lib/errorUtils'
import { useDocumentStore } from './documentStore'
import type { DocumentFolder } from '@/types'

interface FolderStore {
  folders: DocumentFolder[]
  selectedFolderId: number | null
  expandedIds: Set<number>
  loading: boolean
  error: string | null

  fetchFolders: (caseId?: number) => Promise<void>
  getFolderTree: () => DocumentFolder[]
  createFolder: (name: string, parentId?: number, caseId?: number, clientId?: number) => Promise<DocumentFolder>
  createClientFolder: (clientId: number, clientName: string) => Promise<DocumentFolder>
  getClientFolder: (clientId: number) => Promise<DocumentFolder | null>
  renameFolder: (id: number, name: string) => Promise<void>
  moveFolder: (id: number, newParentId: number | null) => Promise<void>
  deleteFolder: (id: number) => Promise<void>
  reorderFolder: (id: number, newPosition: number) => Promise<void>
  toggleExpanded: (id: number) => void
  setSelectedFolder: (id: number | null) => void
  expandAll: () => void
  collapseAll: () => void
}

/**
 * Builds a tree structure from flat folder array
 */
function buildFolderTree(folders: DocumentFolder[]): DocumentFolder[] {
  const folderMap = new Map<number, DocumentFolder>()
  const roots: DocumentFolder[] = []

  // First pass: create map with children arrays
  folders.forEach((folder) => {
    folderMap.set(folder.id, { ...folder, children: [] })
  })

  const createsCycle = (childId: number, parentId: number): boolean => {
    const seen = new Set<number>([childId])
    let current: number | null = parentId
    while (current !== null) {
      if (seen.has(current)) return true
      seen.add(current)
      const parent = folderMap.get(current)
      current = parent?.parent_id ?? null
    }
    return false
  }

  // Second pass: build tree
  folders.forEach((folder) => {
    const node = folderMap.get(folder.id)!
    if (folder.parent_id === null) {
      roots.push(node)
    } else {
      const parent = folderMap.get(folder.parent_id)
      if (parent && !createsCycle(folder.id, folder.parent_id)) {
        parent.children = parent.children || []
        parent.children.push(node)
      } else {
        // Orphan - add to roots
        roots.push(node)
      }
    }
  })

  // Sort by position at each level
  const sortByPosition = (nodes: DocumentFolder[], path = new Set<number>()) => {
    nodes.sort((a, b) => a.position - b.position)
    nodes.forEach((node) => {
      if (node.children?.length) {
        if (path.has(node.id)) return
        const nextPath = new Set(path)
        nextPath.add(node.id)
        sortByPosition(node.children, nextPath)
      }
    })
  }

  sortByPosition(roots)
  return roots
}

export const useFolderStore = create<FolderStore>((set, get) => ({
  folders: [],
  selectedFolderId: null,
  expandedIds: new Set<number>(),
  loading: false,
  error: null,

  fetchFolders: async (caseId?: number) => {
    set({ loading: true, error: null })
    try {
      let query = 'SELECT * FROM document_folders'
      const params: unknown[] = []

      if (caseId !== undefined) {
        query += ' WHERE case_id = ? OR case_id IS NULL'
        params.push(caseId)
      }

      query += ' ORDER BY position ASC, name ASC'

      const folders = await executeQuery<DocumentFolder>(query, params)
      set({ folders, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  getFolderTree: () => {
    const { folders } = get()
    return buildFolderTree(folders)
  },

  createFolder: async (name: string, parentId?: number, caseId?: number, clientId?: number) => {
    set({ loading: true, error: null })
    try {
      // Get max position for siblings
      let positionQuery = 'SELECT MAX(position) as maxPos FROM document_folders WHERE '
      const positionParams: unknown[] = []

      if (parentId) {
        positionQuery += 'parent_id = ?'
        positionParams.push(parentId)
      } else {
        positionQuery += 'parent_id IS NULL'
      }

      const [result] = await executeQuery<{ maxPos: number | null }>(
        positionQuery,
        positionParams
      )
      const position = (result?.maxPos ?? -1) + 1

      const id = await executeInsert(
        `INSERT INTO document_folders (name, parent_id, case_id, client_id, position)
         VALUES (?, ?, ?, ?, ?)`,
        [name, parentId || null, caseId || null, clientId || null, position]
      )

      const [newFolder] = await executeQuery<DocumentFolder>(
        'SELECT * FROM document_folders WHERE id = ?',
        [id]
      )

      set((state) => ({
        folders: [...state.folders, newFolder],
        loading: false,
      }))

      // Expand parent if it exists
      if (parentId) {
        set((state) => ({
          expandedIds: new Set([...state.expandedIds, parentId]),
        }))
      }

      triggerBackup()
      return newFolder
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  createClientFolder: async (clientId: number, clientName: string) => {
    // Check if folder already exists for this client in store (fast path)
    // Note: This is a best-effort check. The actual uniqueness is enforced
    // by the INSERT OR IGNORE below which prevents race conditions.
    const existing = get().folders.find(f => f.client_id === clientId)
    if (existing) return existing

    set({ loading: true, error: null })
    try {
      // Acquire a simple lock to prevent concurrent creation attempts
      const lockKey = `creating_folder_${clientId}`
      if ((window as unknown as Record<string, boolean>)[lockKey]) {
        // Another call is already creating this folder, wait and fetch result
        await new Promise(resolve => setTimeout(resolve, 100))
        const folder = await get().getClientFolder(clientId)
        if (folder) return folder
        throw new Error(`Falha ao criar pasta para o cliente: ${clientName}`)
      }
      ;(window as unknown as Record<string, boolean>)[lockKey] = true
      // Use INSERT OR IGNORE to handle race conditions atomically
      // This ensures only one folder is created even with concurrent calls
      await executeInsert(
        `INSERT OR IGNORE INTO document_folders (name, parent_id, case_id, client_id, position)
         SELECT ?, NULL, NULL, ?, COALESCE((SELECT MAX(position) + 1 FROM document_folders WHERE parent_id IS NULL), 0)
         WHERE NOT EXISTS (SELECT 1 FROM document_folders WHERE client_id = ?)`,
        [clientName, clientId, clientId]
      )

      // Fetch the folder (either just created or already existing)
      const [folder] = await executeQuery<DocumentFolder>(
        'SELECT * FROM document_folders WHERE client_id = ?',
        [clientId]
      )

      if (folder) {
        // Add to store if not present
        set((state) => {
          const exists = state.folders.some(f => f.id === folder.id)
          return exists
            ? { loading: false }
            : { folders: [...state.folders, folder], loading: false }
        })
        return folder
      }

      set({ loading: false })
      // Throw error instead of recursive fallback to avoid potential folder duplication
      throw new Error(`Falha ao criar pasta para o cliente: ${clientName}`)
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    } finally {
      // Release lock
      const lockKey = `creating_folder_${clientId}`
      ;(window as unknown as Record<string, boolean>)[lockKey] = false
    }
  },

  getClientFolder: async (clientId: number) => {
    // First check in store (synchronous, no loading needed)
    const existing = get().folders.find(f => f.client_id === clientId)
    if (existing) return existing

    set({ loading: true })
    try {
      // Then check in database
      const [folder] = await executeQuery<DocumentFolder>(
        'SELECT * FROM document_folders WHERE client_id = ?',
        [clientId]
      )

      if (folder) {
        // Add to store if not present
        set((state) => {
          const exists = state.folders.some(f => f.id === folder.id)
          return exists
            ? { loading: false }
            : { folders: [...state.folders, folder], loading: false }
        })
      } else {
        set({ loading: false })
      }

      return folder || null
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  renameFolder: async (id: number, name: string) => {
    set({ loading: true, error: null })
    try {
      await executeUpdate(
        'UPDATE document_folders SET name = ? WHERE id = ?',
        [name, id]
      )

      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === id ? { ...f, name } : f
        ),
        loading: false,
      }))

      triggerBackup()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  moveFolder: async (id: number, newParentId: number | null) => {
    set({ loading: true, error: null })
    try {
      // Prevent moving to self or descendant
      const { folders } = get()
      const folder = folders.find((f) => f.id === id)
      if (!folder) throw new Error('Pasta não encontrada')

      // Check if newParentId is a descendant of id
      const isDescendant = (parentId: number | null, targetId: number): boolean => {
        if (parentId === null) return false
        if (parentId === targetId) return true
        const parent = folders.find((f) => f.id === parentId)
        return parent ? isDescendant(parent.parent_id, targetId) : false
      }

      if (newParentId !== null && isDescendant(newParentId, id)) {
        throw new Error('Não é possível mover pasta para dentro de si mesma')
      }

      // Get position for new location
      let positionQuery = 'SELECT MAX(position) as maxPos FROM document_folders WHERE '
      const positionParams: unknown[] = []

      if (newParentId) {
        positionQuery += 'parent_id = ?'
        positionParams.push(newParentId)
      } else {
        positionQuery += 'parent_id IS NULL'
      }

      const [result] = await executeQuery<{ maxPos: number | null }>(
        positionQuery,
        positionParams
      )
      const position = (result?.maxPos ?? -1) + 1

      await executeUpdate(
        'UPDATE document_folders SET parent_id = ?, position = ? WHERE id = ?',
        [newParentId, position, id]
      )

      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === id ? { ...f, parent_id: newParentId, position } : f
        ),
        loading: false,
      }))

      // Expand new parent
      if (newParentId) {
        set((state) => ({
          expandedIds: new Set([...state.expandedIds, newParentId]),
        }))
      }

      triggerBackup()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  deleteFolder: async (id: number) => {
    set({ loading: true, error: null })
    try {
      // Remove from state (including children)
      const { folders } = get()
      const idsToRemove = new Set<number>([id])

      // Find all descendants
      const findDescendants = (parentId: number) => {
        folders.forEach((f) => {
          if (f.parent_id === parentId) {
            idsToRemove.add(f.id)
            findDescendants(f.id)
          }
        })
      }
      findDescendants(id)

      if (idsToRemove.size > 0) {
        const placeholders = Array.from(idsToRemove).map(() => '?').join(', ')
        await executeUpdate(
          `UPDATE documents SET folder_id = NULL WHERE folder_id IN (${placeholders})`,
          Array.from(idsToRemove)
        )
      }

      // CASCADE will delete children
      await executeDelete('DELETE FROM document_folders WHERE id = ?', [id])

      useDocumentStore.setState((state) => ({
        documents: state.documents.map((document) =>
          document.folder_id !== null && idsToRemove.has(document.folder_id)
            ? { ...document, folder_id: null }
            : document
        ),
      }))

      set((state) => ({
        folders: state.folders.filter((f) => !idsToRemove.has(f.id)),
        selectedFolderId:
          state.selectedFolderId && idsToRemove.has(state.selectedFolderId)
            ? null
            : state.selectedFolderId,
        expandedIds: new Set(
          [...state.expandedIds].filter((folderId) => !idsToRemove.has(folderId))
        ),
        loading: false,
      }))

      triggerBackup()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  reorderFolder: async (id: number, newPosition: number) => {
    set({ loading: true, error: null })
    try {
      const { folders } = get()
      const folder = folders.find((f) => f.id === id)
      if (!folder) throw new Error('Pasta não encontrada')

      // Get siblings
      const siblings = folders.filter(
        (f) => f.parent_id === folder.parent_id && f.id !== id
      )

      // Reorder siblings
      const reorderedSiblings = [...siblings]
      reorderedSiblings.splice(newPosition, 0, folder)

      // Update positions in database
      for (let i = 0; i < reorderedSiblings.length; i++) {
        if (reorderedSiblings[i].position !== i) {
          await executeUpdate(
            'UPDATE document_folders SET position = ? WHERE id = ?',
            [i, reorderedSiblings[i].id]
          )
        }
      }

      await get().fetchFolders()
      triggerBackup()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  toggleExpanded: (id: number) => {
    set((state) => {
      const newExpanded = new Set(state.expandedIds)
      if (newExpanded.has(id)) {
        newExpanded.delete(id)
      } else {
        newExpanded.add(id)
      }
      return { expandedIds: newExpanded }
    })
  },

  setSelectedFolder: (id: number | null) => {
    set({ selectedFolderId: id })
  },

  expandAll: () => {
    const { folders } = get()
    const allIds = folders.filter((f) => {
      // Only expand folders that have children
      return folders.some((child) => child.parent_id === f.id)
    }).map((f) => f.id)
    set({ expandedIds: new Set(allIds) })
  },

  collapseAll: () => {
    set({ expandedIds: new Set() })
  },
}))
