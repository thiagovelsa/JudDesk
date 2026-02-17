import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetMocks } from '@/test/setup'
import type { DocumentFolder } from '@/types'

// Mock db module directly
const mockExecuteQuery = vi.fn()
const mockExecuteInsert = vi.fn()
const mockExecuteUpdate = vi.fn()
const mockExecuteDelete = vi.fn()

vi.mock('@/lib/db', () => ({
  executeQuery: (...args: unknown[]) => mockExecuteQuery(...args),
  executeInsert: (...args: unknown[]) => mockExecuteInsert(...args),
  executeUpdate: (...args: unknown[]) => mockExecuteUpdate(...args),
  executeDelete: (...args: unknown[]) => mockExecuteDelete(...args),
  isTauriEnvironment: () => true,
}))

import { useFolderStore } from './folderStore'

describe('folderStore', () => {
  const mockFolders: DocumentFolder[] = [
    { id: 1, name: 'Geral', parent_id: null, case_id: null, client_id: null, position: 0, created_at: '2024-01-01' },
    { id: 2, name: 'Contratos', parent_id: null, case_id: null, client_id: null, position: 1, created_at: '2024-01-01' },
    { id: 3, name: '2024', parent_id: 2, case_id: null, client_id: null, position: 0, created_at: '2024-01-01' },
    { id: 4, name: 'Janeiro', parent_id: 3, case_id: null, client_id: null, position: 0, created_at: '2024-01-01' },
    { id: 5, name: 'Peticoes', parent_id: null, case_id: null, client_id: null, position: 2, created_at: '2024-01-01' },
  ]

  beforeEach(() => {
    resetMocks()
    vi.clearAllMocks()
    mockExecuteQuery.mockReset()
    mockExecuteInsert.mockReset()
    mockExecuteUpdate.mockReset()
    mockExecuteDelete.mockReset()
    // Default resolved values
    mockExecuteInsert.mockResolvedValue(1)
    mockExecuteUpdate.mockResolvedValue(undefined)
    mockExecuteDelete.mockResolvedValue(undefined)
    // Reset store state
    useFolderStore.setState({
      folders: [],
      selectedFolderId: null,
      expandedIds: new Set(),
      loading: false,
      error: null,
    })
  })

  describe('fetchFolders', () => {
    it('should fetch all folders', async () => {
      mockExecuteQuery.mockResolvedValue(mockFolders)

      await useFolderStore.getState().fetchFolders()

      const state = useFolderStore.getState()
      expect(state.folders).toEqual(mockFolders)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should fetch folders by case id', async () => {
      const caseSpecificFolders = mockFolders.filter((f) => f.case_id === 1 || f.case_id === null)
      mockExecuteQuery.mockResolvedValue(caseSpecificFolders)

      await useFolderStore.getState().fetchFolders(1)

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE case_id = ? OR case_id IS NULL'),
        [1]
      )
    })

    it('should set loading state during fetch', async () => {
      mockExecuteQuery.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockFolders), 100))
      )

      const fetchPromise = useFolderStore.getState().fetchFolders()
      expect(useFolderStore.getState().loading).toBe(true)

      await fetchPromise
      expect(useFolderStore.getState().loading).toBe(false)
    })

    it('should handle errors', async () => {
      mockExecuteQuery.mockRejectedValue(new Error('Database error'))

      await useFolderStore.getState().fetchFolders()

      const state = useFolderStore.getState()
      expect(state.error).toBe('Database error')
      expect(state.loading).toBe(false)
    })
  })

  describe('getFolderTree', () => {
    it('should build tree structure from flat folders', () => {
      useFolderStore.setState({ folders: mockFolders })

      const tree = useFolderStore.getState().getFolderTree()

      // Should have 3 root folders: Geral, Contratos, Peticoes
      expect(tree).toHaveLength(3)
      expect(tree.map((f) => f.name)).toEqual(['Geral', 'Contratos', 'Peticoes'])
    })

    it('should nest children correctly', () => {
      useFolderStore.setState({ folders: mockFolders })

      const tree = useFolderStore.getState().getFolderTree()
      const contratos = tree.find((f) => f.name === 'Contratos')

      expect(contratos?.children).toHaveLength(1)
      expect(contratos?.children?.[0].name).toBe('2024')
      expect(contratos?.children?.[0].children?.[0].name).toBe('Janeiro')
    })

    it('should sort by position', () => {
      const unorderedFolders: DocumentFolder[] = [
        { id: 1, name: 'C', parent_id: null, case_id: null, client_id: null, position: 2, created_at: '2024-01-01' },
        { id: 2, name: 'A', parent_id: null, case_id: null, client_id: null, position: 0, created_at: '2024-01-01' },
        { id: 3, name: 'B', parent_id: null, case_id: null, client_id: null, position: 1, created_at: '2024-01-01' },
      ]
      useFolderStore.setState({ folders: unorderedFolders })

      const tree = useFolderStore.getState().getFolderTree()

      expect(tree.map((f) => f.name)).toEqual(['A', 'B', 'C'])
    })

    it('should handle orphan folders by adding to roots', () => {
      const foldersWithOrphan: DocumentFolder[] = [
        { id: 1, name: 'Root', parent_id: null, case_id: null, client_id: null, position: 0, created_at: '2024-01-01' },
        { id: 2, name: 'Orphan', parent_id: 999, case_id: null, client_id: null, position: 0, created_at: '2024-01-01' },
      ]
      useFolderStore.setState({ folders: foldersWithOrphan })

      const tree = useFolderStore.getState().getFolderTree()

      // Orphan should be added to roots
      expect(tree).toHaveLength(2)
      expect(tree.map((f) => f.name)).toContain('Orphan')
    })
  })

  describe('createFolder', () => {
    it('should create folder at root level', async () => {
      const newFolder: DocumentFolder = {
        id: 10,
        name: 'Nova Pasta',
        parent_id: null,
        case_id: null,
        client_id: null,
        position: 0,
        created_at: '2024-01-01',
      }

      mockExecuteQuery
        .mockResolvedValueOnce([{ maxPos: null }]) // Position query
        .mockResolvedValueOnce([newFolder]) // Fetch created folder
      mockExecuteInsert.mockResolvedValue(10)

      const result = await useFolderStore.getState().createFolder('Nova Pasta')

      expect(result).toEqual(newFolder)
      expect(useFolderStore.getState().folders).toContainEqual(newFolder)
      expect(mockExecuteInsert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO document_folders'),
        ['Nova Pasta', null, null, null, 0]
      )
    })

    it('should create folder with parent', async () => {
      const newFolder: DocumentFolder = {
        id: 10,
        name: 'Subfolder',
        parent_id: 2,
        case_id: null,
        client_id: null,
        position: 1,
        created_at: '2024-01-01',
      }

      mockExecuteQuery
        .mockResolvedValueOnce([{ maxPos: 0 }]) // Position query
        .mockResolvedValueOnce([newFolder]) // Fetch created folder
      mockExecuteInsert.mockResolvedValue(10)

      await useFolderStore.getState().createFolder('Subfolder', 2)

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO document_folders'),
        ['Subfolder', 2, null, null, 1]
      )
    })

    it('should create folder with client_id', async () => {
      const newFolder: DocumentFolder = {
        id: 10,
        name: 'Cliente Folder',
        parent_id: null,
        case_id: null,
        client_id: 5,
        position: 0,
        created_at: '2024-01-01',
      }

      mockExecuteQuery
        .mockResolvedValueOnce([{ maxPos: null }]) // Position query
        .mockResolvedValueOnce([newFolder]) // Fetch created folder
      mockExecuteInsert.mockResolvedValue(10)

      await useFolderStore.getState().createFolder('Cliente Folder', undefined, undefined, 5)

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO document_folders'),
        ['Cliente Folder', null, null, 5, 0]
      )
    })

    it('should expand parent when creating subfolder', async () => {
      const newFolder: DocumentFolder = {
        id: 10,
        name: 'Subfolder',
        parent_id: 2,
        case_id: null,
        client_id: null,
        position: 0,
        created_at: '2024-01-01',
      }

      mockExecuteQuery
        .mockResolvedValueOnce([{ maxPos: null }])
        .mockResolvedValueOnce([newFolder])
      mockExecuteInsert.mockResolvedValue(10)

      await useFolderStore.getState().createFolder('Subfolder', 2)

      expect(useFolderStore.getState().expandedIds.has(2)).toBe(true)
    })

    it('should handle errors during creation', async () => {
      mockExecuteQuery.mockResolvedValueOnce([{ maxPos: null }])
      mockExecuteInsert.mockRejectedValue(new Error('Insert failed'))

      await expect(
        useFolderStore.getState().createFolder('Folder')
      ).rejects.toThrow('Insert failed')

      expect(useFolderStore.getState().error).toBe('Insert failed')
    })
  })

  describe('createClientFolder', () => {
    it('should create a folder for a client using atomic INSERT OR IGNORE', async () => {
      const clientFolder: DocumentFolder = {
        id: 10,
        name: 'João Silva',
        parent_id: null,
        case_id: null,
        client_id: 42,
        position: 0,
        created_at: '2024-01-01',
      }

      // INSERT OR IGNORE is called atomically
      mockExecuteInsert.mockResolvedValue(10)
      // Then SELECT to get the folder (either just created or already existing)
      mockExecuteQuery.mockResolvedValueOnce([clientFolder])

      const result = await useFolderStore.getState().createClientFolder(42, 'João Silva')

      expect(result).toEqual(clientFolder)
      expect(result.client_id).toBe(42)
      expect(useFolderStore.getState().folders).toContainEqual(clientFolder)
      expect(mockExecuteInsert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE'),
        expect.any(Array)
      )
    })

    it('should return existing folder if client already has one in store', async () => {
      const existingFolder: DocumentFolder = {
        id: 5,
        name: 'Cliente Existente',
        parent_id: null,
        case_id: null,
        client_id: 42,
        position: 0,
        created_at: '2024-01-01',
      }

      useFolderStore.setState({ folders: [existingFolder] })

      const result = await useFolderStore.getState().createClientFolder(42, 'Novo Nome')

      expect(result).toEqual(existingFolder)
      expect(mockExecuteInsert).not.toHaveBeenCalled()
    })

    it('should return existing folder from database if not in store', async () => {
      const dbFolder: DocumentFolder = {
        id: 5,
        name: 'Cliente DB',
        parent_id: null,
        case_id: null,
        client_id: 42,
        position: 0,
        created_at: '2024-01-01',
      }

      // INSERT OR IGNORE is now called atomically (but does nothing if folder exists)
      mockExecuteInsert.mockResolvedValueOnce(0)
      // Database query returns existing folder
      mockExecuteQuery.mockResolvedValueOnce([dbFolder])

      const result = await useFolderStore.getState().createClientFolder(42, 'Novo Nome')

      expect(result).toEqual(dbFolder)
      // INSERT OR IGNORE is now always called for atomicity (prevents race conditions)
      expect(mockExecuteInsert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE'),
        expect.any(Array)
      )
      // Should add to store
      expect(useFolderStore.getState().folders).toContainEqual(dbFolder)
    })
  })

  describe('getClientFolder', () => {
    it('should return folder from store if exists', async () => {
      const clientFolder: DocumentFolder = {
        id: 5,
        name: 'Cliente Store',
        parent_id: null,
        case_id: null,
        client_id: 42,
        position: 0,
        created_at: '2024-01-01',
      }

      useFolderStore.setState({ folders: [clientFolder] })

      const result = await useFolderStore.getState().getClientFolder(42)

      expect(result).toEqual(clientFolder)
      expect(mockExecuteQuery).not.toHaveBeenCalled()
    })

    it('should query database if folder not in store', async () => {
      const dbFolder: DocumentFolder = {
        id: 5,
        name: 'Cliente DB',
        parent_id: null,
        case_id: null,
        client_id: 42,
        position: 0,
        created_at: '2024-01-01',
      }

      mockExecuteQuery.mockResolvedValueOnce([dbFolder])

      const result = await useFolderStore.getState().getClientFolder(42)

      expect(result).toEqual(dbFolder)
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        'SELECT * FROM document_folders WHERE client_id = ?',
        [42]
      )
      // Should add to store
      expect(useFolderStore.getState().folders).toContainEqual(dbFolder)
    })

    it('should return null if client has no folder', async () => {
      mockExecuteQuery.mockResolvedValueOnce([])

      const result = await useFolderStore.getState().getClientFolder(999)

      expect(result).toBeNull()
    })
  })

  describe('renameFolder', () => {
    it('should rename folder', async () => {
      useFolderStore.setState({ folders: mockFolders })

      await useFolderStore.getState().renameFolder(1, 'Geral Renomeado')

      const state = useFolderStore.getState()
      expect(state.folders.find((f) => f.id === 1)?.name).toBe('Geral Renomeado')
      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE document_folders SET name = ?'),
        ['Geral Renomeado', 1]
      )
    })

    it('should handle errors during rename', async () => {
      useFolderStore.setState({ folders: mockFolders })
      mockExecuteUpdate.mockRejectedValue(new Error('Update failed'))

      await expect(
        useFolderStore.getState().renameFolder(1, 'New Name')
      ).rejects.toThrow('Update failed')

      expect(useFolderStore.getState().error).toBe('Update failed')
    })
  })

  describe('moveFolder', () => {
    beforeEach(() => {
      useFolderStore.setState({ folders: mockFolders })
    })

    it('should move folder to new parent', async () => {
      mockExecuteQuery.mockResolvedValueOnce([{ maxPos: 0 }])

      await useFolderStore.getState().moveFolder(5, 2) // Move Peticoes under Contratos

      const movedFolder = useFolderStore.getState().folders.find((f) => f.id === 5)
      expect(movedFolder?.parent_id).toBe(2)
    })

    it('should move folder to root', async () => {
      mockExecuteQuery.mockResolvedValueOnce([{ maxPos: 2 }])

      await useFolderStore.getState().moveFolder(3, null) // Move 2024 to root

      const movedFolder = useFolderStore.getState().folders.find((f) => f.id === 3)
      expect(movedFolder?.parent_id).toBeNull()
    })

    it('should expand new parent after move', async () => {
      mockExecuteQuery.mockResolvedValueOnce([{ maxPos: 0 }])

      await useFolderStore.getState().moveFolder(1, 2)

      expect(useFolderStore.getState().expandedIds.has(2)).toBe(true)
    })

    it('should prevent moving folder into itself', async () => {
      await expect(
        useFolderStore.getState().moveFolder(2, 2)
      ).rejects.toThrow('Não é possível mover pasta para dentro de si mesma')
    })

    it('should prevent moving folder into its descendant', async () => {
      await expect(
        useFolderStore.getState().moveFolder(2, 4) // Move Contratos into Janeiro (its descendant)
      ).rejects.toThrow('Não é possível mover pasta para dentro de si mesma')
    })

    it('should throw error for non-existent folder', async () => {
      await expect(
        useFolderStore.getState().moveFolder(999, null)
      ).rejects.toThrow('Pasta não encontrada')
    })
  })

  describe('deleteFolder', () => {
    beforeEach(() => {
      useFolderStore.setState({ folders: mockFolders })
    })

    it('should delete folder', async () => {
      await useFolderStore.getState().deleteFolder(5)

      expect(useFolderStore.getState().folders.find((f) => f.id === 5)).toBeUndefined()
      expect(mockExecuteDelete).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM document_folders'),
        [5]
      )
    })

    it('should remove folder and its descendants from state', async () => {
      await useFolderStore.getState().deleteFolder(2) // Delete Contratos (has children)

      const state = useFolderStore.getState()
      // Should remove Contratos (2), 2024 (3), Janeiro (4)
      expect(state.folders.find((f) => f.id === 2)).toBeUndefined()
      expect(state.folders.find((f) => f.id === 3)).toBeUndefined()
      expect(state.folders.find((f) => f.id === 4)).toBeUndefined()
      // Should keep Geral (1) and Peticoes (5)
      expect(state.folders.find((f) => f.id === 1)).toBeDefined()
      expect(state.folders.find((f) => f.id === 5)).toBeDefined()
    })

    it('should clear selected folder if deleted', async () => {
      useFolderStore.setState({ selectedFolderId: 2 })

      await useFolderStore.getState().deleteFolder(2)

      expect(useFolderStore.getState().selectedFolderId).toBeNull()
    })

    it('should clear selected folder if it was a descendant of deleted folder', async () => {
      useFolderStore.setState({ selectedFolderId: 4 }) // Janeiro is descendant of Contratos

      await useFolderStore.getState().deleteFolder(2)

      expect(useFolderStore.getState().selectedFolderId).toBeNull()
    })

    it('should keep selected folder if unrelated to deleted', async () => {
      useFolderStore.setState({ selectedFolderId: 1 })

      await useFolderStore.getState().deleteFolder(2)

      expect(useFolderStore.getState().selectedFolderId).toBe(1)
    })
  })

  describe('reorderFolder', () => {
    beforeEach(() => {
      useFolderStore.setState({ folders: mockFolders })
    })

    it('should reorder folder position', async () => {
      mockExecuteQuery.mockResolvedValue(mockFolders) // For fetchFolders call

      await useFolderStore.getState().reorderFolder(5, 0) // Move Peticoes to position 0

      expect(mockExecuteUpdate).toHaveBeenCalled()
    })

    it('should throw error for non-existent folder', async () => {
      await expect(
        useFolderStore.getState().reorderFolder(999, 0)
      ).rejects.toThrow('Pasta não encontrada')
    })
  })

  describe('toggleExpanded', () => {
    it('should expand collapsed folder', () => {
      useFolderStore.getState().toggleExpanded(1)

      expect(useFolderStore.getState().expandedIds.has(1)).toBe(true)
    })

    it('should collapse expanded folder', () => {
      useFolderStore.setState({ expandedIds: new Set([1]) })

      useFolderStore.getState().toggleExpanded(1)

      expect(useFolderStore.getState().expandedIds.has(1)).toBe(false)
    })
  })

  describe('setSelectedFolder', () => {
    it('should set selected folder', () => {
      useFolderStore.getState().setSelectedFolder(5)

      expect(useFolderStore.getState().selectedFolderId).toBe(5)
    })

    it('should clear selected folder', () => {
      useFolderStore.setState({ selectedFolderId: 5 })

      useFolderStore.getState().setSelectedFolder(null)

      expect(useFolderStore.getState().selectedFolderId).toBeNull()
    })
  })

  describe('expandAll', () => {
    it('should expand all folders that have children', () => {
      useFolderStore.setState({ folders: mockFolders })

      useFolderStore.getState().expandAll()

      const expandedIds = useFolderStore.getState().expandedIds
      // Contratos (2) and 2024 (3) have children
      expect(expandedIds.has(2)).toBe(true)
      expect(expandedIds.has(3)).toBe(true)
      // Geral (1), Janeiro (4), Peticoes (5) don't have children
      expect(expandedIds.has(1)).toBe(false)
      expect(expandedIds.has(4)).toBe(false)
      expect(expandedIds.has(5)).toBe(false)
    })
  })

  describe('collapseAll', () => {
    it('should collapse all folders', () => {
      useFolderStore.setState({ expandedIds: new Set([1, 2, 3]) })

      useFolderStore.getState().collapseAll()

      expect(useFolderStore.getState().expandedIds.size).toBe(0)
    })
  })
})
