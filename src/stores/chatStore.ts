import { create } from 'zustand'
import { executeQuery, executeInsert, executeDelete, executeUpdate } from '@/lib/db'
import { sendMessageAdvanced, type ClaudeRequestConfig, type GPT5RequestConfig, type GeminiRequestConfig, type WebSearchResult } from '@/lib/ai'
import { classifyIntent, classifyIntentGPT5, classifyIntentGemini, type IntentProfile, type IntentConfig, type GPT5IntentConfig, type GeminiIntentConfig } from '@/lib/intentClassifier'
import { logUsage, logGPT5Usage, logGeminiUsage, calculateCost, calculateCostGPT5, calculateCostGemini, type APIUsage, type GPT5Usage, type GeminiUsage } from '@/lib/costTracker'
import { getErrorMessage } from '@/lib/errorUtils'
import type { AIProvider, ChatSession } from '@/types'

/** Number of messages to load per page */
const MESSAGES_PAGE_SIZE = 50
/** Maximum messages to include in AI context */
const AI_CONTEXT_LIMIT = 30
/** Maximum messages kept in memory for UI rendering */
const UI_WINDOW_SIZE = 100
let fetchSessionsInFlight: Promise<void> | null = null

function capMessageWindow<T>(items: T[]): T[] {
  if (items.length <= UI_WINDOW_SIZE) return items
  return items.slice(items.length - UI_WINDOW_SIZE)
}

/**
 * Safely parses and validates web search results from JSON.
 * Returns undefined if JSON is invalid or doesn't match expected schema.
 */
function parseWebSearchResults(json: string | null): WebSearchResult[] | undefined {
  if (!json) return undefined
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return undefined
    // Validate minimal structure: each item must have title and url
    const validResults = parsed.filter((item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).title === 'string' &&
      typeof (item as Record<string, unknown>).url === 'string'
    )
    return validResults.length > 0 ? (validResults as WebSearchResult[]) : undefined
  } catch {
    return undefined
  }
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  usage?: APIUsage
  gpt5_usage?: GPT5Usage
  gemini_usage?: GeminiUsage
  thinking_content?: string
  reasoning_content?: string  // GPT-5 reasoning summary
  web_search_results?: WebSearchResult[]
  cost_usd?: number
  intent_profile?: IntentProfile
}

interface MessagesPagination {
  hasMore: boolean
  offset: number
  isLoadingMore: boolean
}

export interface SendOptions {
  apiKey?: string
  context?: string
  ollamaUrl?: string
  /** Override auto-detected intent config */
  intentOverride?: Partial<IntentConfig>
  /** Override auto-detected GPT-5 intent config */
  gpt5IntentOverride?: Partial<GPT5IntentConfig>
  /** Override auto-detected Gemini intent config */
  geminiIntentOverride?: Partial<GeminiIntentConfig>
  /** Claude-specific settings from settingsStore */
  claudeSettings?: {
    thinkingEnabled: boolean
    webSearchEnabled: boolean
    cacheEnabled: boolean
  }
  /** OpenAI/GPT-5 specific settings from settingsStore */
  openaiSettings?: {
    reasoningEnabled: boolean
    webSearchEnabled: boolean
    cacheEnabled: boolean
  }
  /** Google Gemini specific settings from settingsStore */
  geminiSettings?: {
    thinkingEnabled: boolean
    webSearchEnabled: boolean
  }
}

interface ChatStore {
  sessions: ChatSession[]
  activeSession: ChatSession | null
  messages: Message[]
  messagesPagination: MessagesPagination
  isLoading: boolean
  error: string | null

  // Loading states for individual operations
  loadingSessions: boolean
  creatingSession: boolean
  loadingSession: boolean
  deletingSession: boolean

  // Current request state
  currentIntentProfile: IntentProfile | null
  lastUsage: APIUsage | null
  lastCost: number | null

  fetchSessions: () => Promise<void>
  createSession: (provider: AIProvider, model: string, caseId?: number) => Promise<ChatSession>
  loadSession: (sessionId: number) => Promise<void>
  updateSessionProviderModel: (sessionId: number, provider: AIProvider, model: string) => Promise<void>
  loadMoreMessages: () => Promise<void>
  deleteSession: (sessionId: number) => Promise<void>
  send: (content: string, options?: SendOptions) => Promise<void>
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
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
  loadingSessions: false,
  creatingSession: false,
  loadingSession: false,
  deletingSession: false,
  currentIntentProfile: null,
  lastUsage: null,
  lastCost: null,

  fetchSessions: async () => {
    if (fetchSessionsInFlight) {
      return fetchSessionsInFlight
    }

    fetchSessionsInFlight = (async () => {
      set({ loadingSessions: true, error: null })
      try {
        const sessions = await executeQuery<ChatSession>(
          'SELECT * FROM chat_sessions ORDER BY created_at DESC'
        )
        set({ sessions, loadingSessions: false })
      } catch (error) {
        set({ error: getErrorMessage(error), loadingSessions: false })
      } finally {
        fetchSessionsInFlight = null
      }
    })()

    return fetchSessionsInFlight
  },

  createSession: async (provider: AIProvider, model: string, caseId?: number) => {
    set({ creatingSession: true, error: null })
    try {
      const title = `Nova conversa - ${new Date().toLocaleDateString('pt-BR')}`
      const id = await executeInsert(
        `INSERT INTO chat_sessions (title, provider, model, case_id) VALUES (?, ?, ?, ?)`,
        [title, provider, model, caseId || null]
      )

      const sessions = await executeQuery<ChatSession>(
        'SELECT * FROM chat_sessions WHERE id = ?',
        [id]
      )
      const newSession = sessions[0]

      set((state) => ({
        sessions: [newSession, ...state.sessions],
        activeSession: newSession,
        messages: [],
        creatingSession: false,
      }))

      return newSession
    } catch (error) {
      set({ error: getErrorMessage(error), creatingSession: false })
      throw error
    }
  },

  loadSession: async (sessionId: number) => {
    set({ loadingSession: true, error: null })
    try {
      const sessions = await executeQuery<ChatSession>(
        'SELECT * FROM chat_sessions WHERE id = ?',
        [sessionId]
      )

      if (sessions.length === 0) {
        throw new Error('Session not found')
      }

      // Load only the last N messages (DESC order, then reverse)
      const dbMessages = await executeQuery<{
        id: number
        role: string
        content: string
        created_at: string
        thinking_content: string | null
        web_search_results: string | null
        cost_usd: number | null
        intent_profile: string | null
      }>(
        `SELECT id, session_id, role, content, created_at, thinking_content, web_search_results, cost_usd, intent_profile
         FROM chat_messages WHERE session_id = ?
         ORDER BY created_at DESC LIMIT ?`,
        [sessionId, MESSAGES_PAGE_SIZE]
      )

      // Reverse to get chronological order
      const messages: Message[] = dbMessages.reverse().map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
        thinking_content: m.thinking_content || undefined,
        web_search_results: parseWebSearchResults(m.web_search_results),
        cost_usd: m.cost_usd || undefined,
        intent_profile: m.intent_profile as IntentProfile | undefined,
      }))

      set({
        activeSession: sessions[0],
        messages: capMessageWindow(messages),
        messagesPagination: {
          hasMore: dbMessages.length === MESSAGES_PAGE_SIZE,
          offset: dbMessages.length,
          isLoadingMore: false,
        },
        loadingSession: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error), loadingSession: false })
    }
  },

  updateSessionProviderModel: async (sessionId: number, provider: AIProvider, model: string) => {
    set({ error: null })
    try {
      await executeUpdate(
        'UPDATE chat_sessions SET provider = ?, model = ? WHERE id = ?',
        [provider, model, sessionId]
      )

      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, provider, model }
            : session
        ),
        activeSession:
          state.activeSession?.id === sessionId
            ? { ...state.activeSession, provider, model }
            : state.activeSession,
      }))
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },

  loadMoreMessages: async () => {
    const { messagesPagination, activeSession, messages } = get()

    if (!activeSession || !messagesPagination.hasMore || messagesPagination.isLoadingMore) {
      return
    }

    set((state) => ({
      messagesPagination: { ...state.messagesPagination, isLoadingMore: true },
    }))

    try {
      const olderMessages = await executeQuery<{
        id: number
        role: string
        content: string
        created_at: string
        thinking_content: string | null
        web_search_results: string | null
        cost_usd: number | null
        intent_profile: string | null
      }>(
        `SELECT id, session_id, role, content, created_at, thinking_content, web_search_results, cost_usd, intent_profile
         FROM chat_messages WHERE session_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [activeSession.id, MESSAGES_PAGE_SIZE, messagesPagination.offset]
      )

      // Reverse to get chronological order, then prepend to existing messages
      const mapped: Message[] = olderMessages.reverse().map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
        thinking_content: m.thinking_content || undefined,
        web_search_results: parseWebSearchResults(m.web_search_results),
        cost_usd: m.cost_usd || undefined,
        intent_profile: m.intent_profile as IntentProfile | undefined,
      }))

      set({
        messages: capMessageWindow([...mapped, ...messages]),
        messagesPagination: {
          hasMore: olderMessages.length === MESSAGES_PAGE_SIZE,
          offset: messagesPagination.offset + olderMessages.length,
          isLoadingMore: false,
        },
      })
    } catch (error) {
      set((state) => ({
        error: getErrorMessage(error),
        messagesPagination: { ...state.messagesPagination, isLoadingMore: false },
      }))
    }
  },

  deleteSession: async (sessionId: number) => {
    set({ deletingSession: true, error: null })
    try {
      await executeDelete('DELETE FROM chat_messages WHERE session_id = ?', [sessionId])
      await executeDelete('DELETE FROM chat_sessions WHERE id = ?', [sessionId])

      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        activeSession:
          state.activeSession?.id === sessionId ? null : state.activeSession,
        messages: state.activeSession?.id === sessionId ? [] : state.messages,
        deletingSession: false,
      }))
    } catch (error) {
      set({ error: getErrorMessage(error), deletingSession: false })
      throw error
    }
  },

  send: async (content: string, options?: SendOptions) => {
    const { activeSession, messages } = get()

    if (!activeSession) {
      set({ error: 'No active session' })
      return
    }

    // Classify intent based on provider
    const intentConfig = classifyIntent(content)
    const gpt5IntentConfig = classifyIntentGPT5(content)
    const geminiIntentConfig = classifyIntentGemini(content)
    const isClaude = activeSession.provider === 'claude'
    const isOpenAI = activeSession.provider === 'openai'
    const isGPT5 = isOpenAI && activeSession.model?.startsWith('gpt-5')
    const isGemini = activeSession.provider === 'gemini'

    // Set loading state
    set({
      isLoading: true,
      error: null,
      currentIntentProfile: (isClaude || isGPT5 || isGemini) ? intentConfig.profile : null,
    })

    try {
      // Save user message to DB FIRST (pessimistic update)
      const userMessageId = await executeInsert(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)',
        [activeSession.id, 'user', content]
      )

      // Add user message to UI with real DB ID
      const userMessage: Message = {
        id: userMessageId,
        role: 'user',
        content,
        timestamp: new Date(),
      }

      set((state) => ({
        messages: capMessageWindow([...state.messages, userMessage]),
      }))

      // Prepare messages for API (limit context to recent messages)
      const recentMessages = messages.slice(-AI_CONTEXT_LIMIT)
      const apiMessages = recentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      apiMessages.push({ role: 'user', content })

      // Build Claude config based on intent and settings
      let claudeConfig: ClaudeRequestConfig | undefined
      if (isClaude && options?.claudeSettings) {
        const { thinkingEnabled, webSearchEnabled, cacheEnabled } = options.claudeSettings

        // Apply intent-based config, but respect user settings
        claudeConfig = {
          thinking: thinkingEnabled && intentConfig.thinking.enabled
            ? intentConfig.thinking
            : { enabled: false, budget_tokens: 0 },
          useWebSearch: webSearchEnabled && intentConfig.useWebSearch,
          useCache: cacheEnabled,
          max_tokens: intentConfig.max_tokens
        }

        // Apply any overrides
        if (options.intentOverride) {
          if (options.intentOverride.thinking) {
            claudeConfig.thinking = options.intentOverride.thinking
          }
          if (options.intentOverride.useWebSearch !== undefined) {
            claudeConfig.useWebSearch = options.intentOverride.useWebSearch
          }
          if (options.intentOverride.max_tokens) {
            claudeConfig.max_tokens = options.intentOverride.max_tokens
          }
        }
      }

      // Build GPT-5 config based on intent and settings
      let gpt5Config: GPT5RequestConfig | undefined
      if (isGPT5 && options?.openaiSettings) {
        const { reasoningEnabled, webSearchEnabled } = options.openaiSettings

        // Apply intent-based config, but respect user settings
        gpt5Config = {
          reasoning_effort: reasoningEnabled && gpt5IntentConfig.reasoning_effort !== 'none'
            ? gpt5IntentConfig.reasoning_effort
            : 'none',
          verbosity: gpt5IntentConfig.verbosity,
          max_output_tokens: gpt5IntentConfig.max_output_tokens,
          useWebSearch: webSearchEnabled && gpt5IntentConfig.useWebSearch
        }

        // Apply any overrides
        if (options.gpt5IntentOverride) {
          if (options.gpt5IntentOverride.reasoning_effort) {
            gpt5Config.reasoning_effort = options.gpt5IntentOverride.reasoning_effort
          }
          if (options.gpt5IntentOverride.verbosity) {
            gpt5Config.verbosity = options.gpt5IntentOverride.verbosity
          }
          if (options.gpt5IntentOverride.max_output_tokens) {
            gpt5Config.max_output_tokens = options.gpt5IntentOverride.max_output_tokens
          }
          if (options.gpt5IntentOverride.useWebSearch !== undefined) {
            gpt5Config.useWebSearch = options.gpt5IntentOverride.useWebSearch
          }
        }
      }

      // Build Gemini config based on intent and settings
      let geminiConfig: GeminiRequestConfig | undefined
      if (isGemini && options?.geminiSettings) {
        const { thinkingEnabled, webSearchEnabled } = options.geminiSettings

        // Apply intent-based config, but respect user settings
        geminiConfig = {
          thinking_level: thinkingEnabled && geminiIntentConfig.thinking_level !== 'minimal'
            ? geminiIntentConfig.thinking_level
            : 'minimal',
          max_output_tokens: geminiIntentConfig.max_output_tokens,
          useWebSearch: webSearchEnabled && geminiIntentConfig.useWebSearch
        }

        // Apply any overrides
        if (options.geminiIntentOverride) {
          if (options.geminiIntentOverride.thinking_level) {
            geminiConfig.thinking_level = options.geminiIntentOverride.thinking_level
          }
          if (options.geminiIntentOverride.max_output_tokens) {
            geminiConfig.max_output_tokens = options.geminiIntentOverride.max_output_tokens
          }
          if (options.geminiIntentOverride.useWebSearch !== undefined) {
            geminiConfig.useWebSearch = options.geminiIntentOverride.useWebSearch
          }
        }
      }

      // Send to AI
      const response = await sendMessageAdvanced(
        activeSession.provider,
        activeSession.model || 'llama3.1',
        apiMessages,
        options?.apiKey,
        options?.context,
        claudeConfig,
        gpt5Config,
        geminiConfig,
        undefined,
        options?.ollamaUrl
      )

      // Calculate cost based on provider
      let cost: number | null = null
      if (isClaude && response.usage) {
        cost = calculateCost(response.usage)
        try {
          await logUsage(activeSession.id, response.usage)
        } catch (err) {
          console.error('Failed to log usage:', err)
        }
      } else if (isGPT5 && response.gpt5_usage) {
        cost = calculateCostGPT5(response.gpt5_usage)
        try {
          await logGPT5Usage(activeSession.id, response.gpt5_usage)
        } catch (err) {
          console.error('Failed to log GPT-5 usage:', err)
        }
      } else if (isGemini && response.gemini_usage) {
        cost = calculateCostGemini(response.gemini_usage)
        try {
          await logGeminiUsage(activeSession.id, response.gemini_usage)
        } catch (err) {
          console.error('Failed to log Gemini usage:', err)
        }
      }

      // Save assistant message to DB (including provider-specific fields)
      // Note: thinking_content is used for Claude thinking, GPT-5 reasoning summary, and Gemini thinking
      const assistantMessageId = await executeInsert(
        `INSERT INTO chat_messages (session_id, role, content, thinking_content, web_search_results, cost_usd, intent_profile)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          activeSession.id,
          'assistant',
          response.content,
          response.thinking_content || response.reasoning_content || null,
          response.web_search_results ? JSON.stringify(response.web_search_results) : null,
          cost,
          (isClaude || isGPT5 || isGemini) ? intentConfig.profile : null
        ]
      )

      // Add assistant message to UI with real DB ID
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        usage: response.usage,
        gpt5_usage: response.gpt5_usage,
        gemini_usage: response.gemini_usage,
        thinking_content: response.thinking_content,
        reasoning_content: response.reasoning_content,
        web_search_results: response.web_search_results,
        cost_usd: cost || undefined,
        intent_profile: (isClaude || isGPT5 || isGemini) ? intentConfig.profile : undefined,
      }

      set((state) => ({
        messages: capMessageWindow([...state.messages, assistantMessage]),
        isLoading: false,
        currentIntentProfile: null,
        lastUsage: response.usage || null,
        lastCost: cost,
      }))
    } catch (error) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
        currentIntentProfile: null,
      })
    }
  },

  clearMessages: () => {
    set({
      messages: [],
      activeSession: null,
      messagesPagination: { hasMore: false, offset: 0, isLoadingMore: false },
    })
  },
}))
