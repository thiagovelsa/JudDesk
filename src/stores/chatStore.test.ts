import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from './chatStore'
import { mockDatabase, resetMocks, mockDatabaseSelect, mockDatabaseExecute, mockFetch } from '@/test/setup'
import type { ChatSession } from '@/types'

describe('chatStore', () => {
  beforeEach(() => {
    resetMocks()
    // Reset store state
    useChatStore.setState({
      sessions: [],
      activeSession: null,
      messages: [],
      messagesPagination: {
        hasMore: false,
        offset: 0,
        isLoadingMore: false,
      },
      isLoading: false,
      error: null,
    })
  })

  describe('fetchSessions', () => {
    it('should fetch sessions from database', async () => {
      const mockSessions: ChatSession[] = [
        {
          id: 1,
          case_id: null,
          title: 'Test Session',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockSessions)

      await useChatStore.getState().fetchSessions()

      const state = useChatStore.getState()
      expect(state.sessions).toEqual(mockSessions)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM chat_sessions ORDER BY created_at DESC',
        []
      )
    })

    it('should handle errors', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Database error'))

      await useChatStore.getState().fetchSessions()

      const state = useChatStore.getState()
      expect(state.error).toBe('Database error')
    })
  })

  describe('createSession', () => {
    it('should create a new session', async () => {
      const newSession: ChatSession = {
        id: 1,
        case_id: null,
        title: expect.stringContaining('Nova conversa'),
        provider: 'ollama',
        model: 'llama3.1',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseExecute(1, 1)
      mockDatabase.select.mockResolvedValueOnce([newSession])

      const result = await useChatStore.getState().createSession('ollama', 'llama3.1')

      expect(result).toEqual(newSession)
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_sessions'),
        expect.arrayContaining(['ollama', 'llama3.1'])
      )

      const state = useChatStore.getState()
      expect(state.activeSession).toEqual(newSession)
      expect(state.messages).toEqual([])
    })

    it('should create session with case_id', async () => {
      const newSession: ChatSession = {
        id: 1,
        case_id: 5,
        title: 'Test',
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseExecute(1, 1)
      mockDatabase.select.mockResolvedValueOnce([newSession])

      await useChatStore.getState().createSession('claude', 'claude-sonnet-4-20250514', 5)

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5])
      )
    })
  })

  describe('loadSession', () => {
    it('should load session and its messages with pagination', async () => {
      const session: ChatSession = {
        id: 1,
        case_id: null,
        title: 'Test',
        provider: 'ollama',
        model: 'llama3.1',
        created_at: '2024-01-01T00:00:00Z',
      }

      // Messages are returned in DESC order from DB and reversed in store
      const dbMessages = [
        { id: 2, role: 'assistant', content: 'Hi!', created_at: '2024-01-01T00:01:00Z' },
        { id: 1, role: 'user', content: 'Hello', created_at: '2024-01-01T00:00:00Z' },
      ]

      mockDatabase.select
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(dbMessages)

      await useChatStore.getState().loadSession(1)

      const state = useChatStore.getState()
      expect(state.activeSession).toEqual(session)
      expect(state.messages).toHaveLength(2)
      // After reversing, user message should be first
      expect(state.messages[0].role).toBe('user')
      expect(state.messages[1].role).toBe('assistant')
      // Pagination state should be set
      expect(state.messagesPagination.offset).toBe(2)
      expect(state.messagesPagination.hasMore).toBe(false) // Less than page size
    })

    it('should handle session not found', async () => {
      mockDatabaseSelect([])

      await useChatStore.getState().loadSession(999)

      const state = useChatStore.getState()
      expect(state.error).toBe('Session not found')
    })
  })

  describe('updateSessionProviderModel', () => {
    it('should update provider/model in database and active session', async () => {
      useChatStore.setState({
        sessions: [
          {
            id: 1,
            case_id: null,
            title: 'Sessão',
            provider: 'ollama',
            model: 'llama3.1',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Sessão',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
      })

      mockDatabaseExecute(0, 1)

      await useChatStore.getState().updateSessionProviderModel(1, 'claude', 'claude-sonnet-4-20250514')

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'UPDATE chat_sessions SET provider = ?, model = ? WHERE id = ?',
        ['claude', 'claude-sonnet-4-20250514', 1]
      )
      const state = useChatStore.getState()
      expect(state.activeSession?.provider).toBe('claude')
      expect(state.activeSession?.model).toBe('claude-sonnet-4-20250514')
      expect(state.sessions[0].provider).toBe('claude')
      expect(state.sessions[0].model).toBe('claude-sonnet-4-20250514')
    })

    it('should update only sessions list when target is not active', async () => {
      useChatStore.setState({
        sessions: [
          {
            id: 1,
            case_id: null,
            title: 'Sessão 1',
            provider: 'ollama',
            model: 'llama3.1',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            case_id: null,
            title: 'Sessão 2',
            provider: 'openai',
            model: 'gpt-5-mini',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        activeSession: {
          id: 2,
          case_id: null,
          title: 'Sessão 2',
          provider: 'openai',
          model: 'gpt-5-mini',
          created_at: '2024-01-01T00:00:00Z',
        },
      })

      mockDatabaseExecute(0, 1)

      await useChatStore.getState().updateSessionProviderModel(1, 'gemini', 'models/gemini-3-flash-preview')

      const state = useChatStore.getState()
      expect(state.sessions.find((s) => s.id === 1)?.provider).toBe('gemini')
      expect(state.sessions.find((s) => s.id === 1)?.model).toBe('models/gemini-3-flash-preview')
      expect(state.activeSession?.id).toBe(2)
      expect(state.activeSession?.provider).toBe('openai')
    })

    it('should keep state unchanged when update fails', async () => {
      useChatStore.setState({
        sessions: [
          {
            id: 1,
            case_id: null,
            title: 'Sessão',
            provider: 'ollama',
            model: 'llama3.1',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Sessão',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
      })

      mockDatabase.execute.mockRejectedValue(new Error('Update failed'))

      await expect(
        useChatStore.getState().updateSessionProviderModel(1, 'claude', 'claude-sonnet-4-20250514')
      ).rejects.toThrow('Update failed')

      const state = useChatStore.getState()
      expect(state.error).toBe('Update failed')
      expect(state.activeSession?.provider).toBe('ollama')
      expect(state.activeSession?.model).toBe('llama3.1')
      expect(state.sessions[0].provider).toBe('ollama')
      expect(state.sessions[0].model).toBe('llama3.1')
    })
  })

  describe('deleteSession', () => {
    it('should delete session and its messages', async () => {
      useChatStore.setState({
        sessions: [
          {
            id: 1,
            case_id: null,
            title: 'Test',
            provider: 'ollama',
            model: 'llama3.1',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: [{ id: 1, role: 'user', content: 'Test', timestamp: new Date() }],
      })

      mockDatabaseExecute(0, 1)

      await useChatStore.getState().deleteSession(1)

      expect(mockDatabase.execute).toHaveBeenCalledTimes(2)
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'DELETE FROM chat_messages WHERE session_id = ?',
        [1]
      )
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'DELETE FROM chat_sessions WHERE id = ?',
        [1]
      )

      const state = useChatStore.getState()
      expect(state.sessions).toHaveLength(0)
      expect(state.activeSession).toBeNull()
      expect(state.messages).toHaveLength(0)
    })
  })

  describe('send', () => {
    it('should send message and receive response', async () => {
      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: [],
      })

      mockDatabaseExecute(1, 1)
      mockFetch({ message: { content: 'AI Response' } }, true)

      await useChatStore.getState().send('Hello')

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(2)
      expect(state.messages[0].role).toBe('user')
      expect(state.messages[0].content).toBe('Hello')
      expect(state.messages[1].role).toBe('assistant')
      expect(state.messages[1].content).toBe('AI Response')
      expect(state.isLoading).toBe(false)
    })

    it('should handle error when no active session', async () => {
      useChatStore.setState({ activeSession: null })

      await useChatStore.getState().send('Hello')

      const state = useChatStore.getState()
      expect(state.error).toBe('No active session')
    })

    it('should handle API errors', async () => {
      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: [],
      })

      mockDatabaseExecute(1, 1)
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )

      await useChatStore.getState().send('Hello')

      const state = useChatStore.getState()
      expect(state.error).toBe('Network error')
      expect(state.isLoading).toBe(false)
    })
  })

  describe('clearMessages', () => {
    it('should clear messages and active session', () => {
      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: [{ id: 1, role: 'user', content: 'Test', timestamp: new Date() }],
      })

      useChatStore.getState().clearMessages()

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(0)
      expect(state.activeSession).toBeNull()
      expect(state.messagesPagination.hasMore).toBe(false)
      expect(state.messagesPagination.offset).toBe(0)
    })
  })

  describe('loadMoreMessages', () => {
    it('should not load if no active session', async () => {
      useChatStore.setState({
        activeSession: null,
        messagesPagination: { hasMore: true, offset: 50, isLoadingMore: false },
      })

      await useChatStore.getState().loadMoreMessages()

      // Should not make any database calls
      expect(mockDatabase.select).not.toHaveBeenCalled()
    })

    it('should not load if hasMore is false', async () => {
      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messagesPagination: { hasMore: false, offset: 50, isLoadingMore: false },
      })

      await useChatStore.getState().loadMoreMessages()

      expect(mockDatabase.select).not.toHaveBeenCalled()
    })

    it('should not load if already loading', async () => {
      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messagesPagination: { hasMore: true, offset: 50, isLoadingMore: true },
      })

      await useChatStore.getState().loadMoreMessages()

      expect(mockDatabase.select).not.toHaveBeenCalled()
    })

    it('should load older messages and prepend them', async () => {
      const existingMessages = [
        { id: 3, role: 'user' as const, content: 'Third', timestamp: new Date() },
      ]

      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: existingMessages,
        messagesPagination: { hasMore: true, offset: 1, isLoadingMore: false },
      })

      // Older messages from DB (DESC order)
      const olderDbMessages = [
        { id: 2, role: 'assistant', content: 'Second', created_at: '2024-01-01T00:01:00Z' },
        { id: 1, role: 'user', content: 'First', created_at: '2024-01-01T00:00:00Z' },
      ]

      mockDatabase.select.mockResolvedValueOnce(olderDbMessages)

      await useChatStore.getState().loadMoreMessages()

      const state = useChatStore.getState()
      // Should have prepended older messages (reversed)
      expect(state.messages).toHaveLength(3)
      expect(state.messages[0].content).toBe('First')
      expect(state.messages[1].content).toBe('Second')
      expect(state.messages[2].content).toBe('Third')
      expect(state.messagesPagination.offset).toBe(3)
      expect(state.messagesPagination.isLoadingMore).toBe(false)
    })

    it('should set hasMore to false when fewer than page size returned', async () => {
      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: [],
        messagesPagination: { hasMore: true, offset: 50, isLoadingMore: false },
      })

      // Return fewer messages than page size (50)
      mockDatabase.select.mockResolvedValueOnce([
        { id: 1, role: 'user', content: 'Only one', created_at: '2024-01-01T00:00:00Z' },
      ])

      await useChatStore.getState().loadMoreMessages()

      const state = useChatStore.getState()
      expect(state.messagesPagination.hasMore).toBe(false)
    })

    it('should handle errors when loading more messages', async () => {
      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: [],
        messagesPagination: { hasMore: true, offset: 0, isLoadingMore: false },
      })

      mockDatabase.select.mockRejectedValue(new Error('Load failed'))

      await useChatStore.getState().loadMoreMessages()

      const state = useChatStore.getState()
      expect(state.error).toBe('Load failed')
      expect(state.messagesPagination.isLoadingMore).toBe(false)
    })

    it('should keep only the latest 100 messages in memory', async () => {
      const existingMessages = Array.from({ length: 100 }, (_, idx) => ({
        id: idx + 101,
        role: 'user' as const,
        content: `Message ${idx + 101}`,
        timestamp: new Date(),
      }))

      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: existingMessages,
        messagesPagination: { hasMore: true, offset: 100, isLoadingMore: false },
      })

      mockDatabase.select.mockResolvedValueOnce([
        { id: 2, role: 'assistant', content: 'Second', created_at: '2024-01-01T00:01:00Z' },
        { id: 1, role: 'user', content: 'First', created_at: '2024-01-01T00:00:00Z' },
      ])

      await useChatStore.getState().loadMoreMessages()

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(100)
      expect(state.messages[0].id).toBe(101)
      expect(state.messages[state.messages.length - 1].id).toBe(200)
    })
  })

  describe('send with context', () => {
    it('should send message with context', async () => {
      useChatStore.setState({
        activeSession: {
          id: 1,
          case_id: null,
          title: 'Test',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: [],
      })

      mockDatabaseExecute(1, 1)
      mockFetch({ message: { content: 'Response with context' } }, true)

      const context = 'This is additional context from documents'
      await useChatStore.getState().send('Hello', { context })

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(2)
      expect(state.messages[1].content).toBe('Response with context')

      // Check that fetch was called with context
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(context),
        })
      )
    })
  })

  describe('createSession error handling', () => {
    it('should handle errors when creating session', async () => {
      mockDatabase.execute.mockRejectedValue(new Error('Create failed'))

      await expect(
        useChatStore.getState().createSession('ollama', 'llama3.1')
      ).rejects.toThrow('Create failed')

      const state = useChatStore.getState()
      expect(state.error).toBe('Create failed')
    })
  })

  describe('deleteSession with non-active session', () => {
    it('should delete session without clearing messages if not active', async () => {
      useChatStore.setState({
        sessions: [
          {
            id: 1,
            case_id: null,
            title: 'Session 1',
            provider: 'ollama',
            model: 'llama3.1',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            case_id: null,
            title: 'Session 2',
            provider: 'ollama',
            model: 'llama3.1',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        activeSession: {
          id: 2,
          case_id: null,
          title: 'Session 2',
          provider: 'ollama',
          model: 'llama3.1',
          created_at: '2024-01-01T00:00:00Z',
        },
        messages: [{ id: 1, role: 'user', content: 'Test', timestamp: new Date() }],
      })

      mockDatabaseExecute(0, 1)

      // Delete session 1 (not active)
      await useChatStore.getState().deleteSession(1)

      const state = useChatStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].id).toBe(2)
      // Active session and messages should remain
      expect(state.activeSession?.id).toBe(2)
      expect(state.messages).toHaveLength(1)
    })
  })
})
