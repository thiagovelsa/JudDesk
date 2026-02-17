import { describe, it, expect, beforeEach } from 'vitest'
import { cleanupAfterCaseDelete, cleanupAfterClientDelete } from './cascadeCleanup'
import { useDocumentStore } from './documentStore'
import { useFolderStore } from './folderStore'
import { useDeadlineStore } from './deadlineStore'
import { useChatStore } from './chatStore'
import { resetMocks } from '@/test/setup'

describe('cascadeCleanup', () => {
  beforeEach(() => {
    resetMocks()
    useDocumentStore.setState({
      documents: [],
      extractedTextCache: new Map(),
      loading: false,
      error: null,
      extractionProgress: null,
    })
    useFolderStore.setState({
      folders: [],
      selectedFolderId: null,
      expandedIds: new Set<number>(),
      loading: false,
      error: null,
    })
    useDeadlineStore.setState({
      deadlines: [],
      loading: false,
      error: null,
    })
    useChatStore.setState({
      sessions: [],
      activeSession: null,
      messages: [],
      messagesPagination: { hasMore: false, offset: 0, isLoadingMore: false },
      isLoading: false,
      error: null,
      loadingSessions: false,
      creatingSession: false,
      loadingSession: false,
      deletingSession: false,
      currentIntentProfile: null,
      lastUsage: null,
      lastCost: null,
    })
  })

  it('should cleanup document/deadline/chat references after client delete', async () => {
    useDocumentStore.setState({
      documents: [
        {
          id: 1,
          client_id: 1,
          case_id: 10,
          name: 'a.pdf',
          file_path: '/a.pdf',
          extracted_text: null,
          folder_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          client_id: 2,
          case_id: null,
          name: 'b.pdf',
          file_path: '/b.pdf',
          extracted_text: null,
          folder_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
      extractedTextCache: new Map([
        [1, 'text 1'],
        [2, 'text 2'],
      ]),
    })
    useDeadlineStore.setState({
      deadlines: [
        {
          id: 1,
          title: 'Prazo',
          description: null,
          due_date: '2024-02-02',
          reminder_date: null,
          priority: 'normal',
          completed: false,
          case_id: 10,
          client_id: 1,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    })
    useChatStore.setState({
      sessions: [
        {
          id: 1,
          case_id: 10,
          title: 'Session',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      activeSession: {
        id: 1,
        case_id: 10,
        title: 'Session',
        provider: 'ollama',
        model: 'llama3.1',
        created_at: '2024-01-01T00:00:00Z',
      },
    })

    const result = await cleanupAfterClientDelete(1, [10])

    expect(result.ok).toBe(true)
    expect(useDocumentStore.getState().documents).toHaveLength(1)
    expect(useDocumentStore.getState().documents[0].id).toBe(2)
    expect(useDocumentStore.getState().extractedTextCache.has(1)).toBe(false)
    expect(useDeadlineStore.getState().deadlines[0].client_id).toBeNull()
    expect(useDeadlineStore.getState().deadlines[0].case_id).toBeNull()
    expect(useChatStore.getState().sessions[0].case_id).toBeNull()
    expect(useChatStore.getState().activeSession?.case_id).toBeNull()
  })

  it('should remove case folders recursively after case delete', async () => {
    useFolderStore.setState({
      folders: [
        {
          id: 1,
          name: 'Case Root',
          parent_id: null,
          case_id: 99,
          client_id: null,
          position: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'Child',
          parent_id: 1,
          case_id: null,
          client_id: null,
          position: 1,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 3,
          name: 'Other',
          parent_id: null,
          case_id: 100,
          client_id: null,
          position: 2,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      selectedFolderId: 2,
      expandedIds: new Set([1, 2, 3]),
    })

    const result = await cleanupAfterCaseDelete(99, [1])

    expect(result.ok).toBe(true)
    expect(useFolderStore.getState().folders.map((f) => f.id)).toEqual([3])
    expect(useFolderStore.getState().selectedFolderId).toBeNull()
    expect(useFolderStore.getState().expandedIds.has(1)).toBe(false)
    expect(useFolderStore.getState().expandedIds.has(2)).toBe(false)
  })
})

