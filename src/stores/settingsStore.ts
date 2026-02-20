import { create } from 'zustand'
import { executeQuery, executeInsert, saveSettingsBatch, type SettingBatchEntry } from '@/lib/db'
import { getErrorMessage } from '@/lib/errorUtils'
import { isSensitiveKey, migrateLegacySensitiveSettings, setSecretForSettingKey } from '@/lib/secureSecrets'
import type { AIProvider } from '@/types'

interface SettingsStore {
  settings: Record<string, string | null>
  loading: boolean
  saving: boolean
  error: string | null

  fetchSettings: () => Promise<void>
  getSetting: (key: string) => string | null
  getSettingBoolean: (key: string, defaultValue?: boolean) => boolean
  getSettingNumber: (key: string, defaultValue?: number) => number
  setSetting: (key: string, value: string | null) => Promise<void>
  setSettingsBatch: (entries: SettingBatchEntry[]) => Promise<void>

  // Convenience methods
  getClaudeApiKey: () => string | null
  getOpenAIApiKey: () => string | null
  getOllamaUrl: () => string
  getDefaultProvider: () => AIProvider
  getDefaultModel: () => string
  getLawyerName: () => string | null
  getLawyerOAB: () => string | null

  // UI
  getUiDensity: () => 'normal' | 'compact'
  setUiDensity: (density: 'normal' | 'compact') => Promise<void>
  getUiMotion: () => 'system' | 'normal' | 'reduced'
  setUiMotion: (mode: 'system' | 'normal' | 'reduced') => Promise<void>
  getAssistantLastSessionId: () => number | null
  setAssistantLastSessionId: (sessionId: number | null) => Promise<void>

  // Claude Advanced Settings
  getClaudeThinkingEnabled: () => boolean
  getClaudeWebSearchEnabled: () => boolean
  getClaudeCacheEnabled: () => boolean
  getClaudeShowCosts: () => boolean
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const DEFAULT_PROVIDER: AIProvider = 'ollama'
const DEFAULT_MODEL = 'llama3.1'
let fetchSettingsInFlight: Promise<void> | null = null

async function persistSensitiveSettingToKeychain(
  key: string,
  value: string | null
): Promise<string | null> {
  if (!isSensitiveKey(key)) {
    return value
  }

  const trimmedValue = value?.trim() ?? ''
  await setSecretForSettingKey(key, trimmedValue || null)

  // Always clear persisted plaintext value in DB
  await saveSettingsBatch([{ key, value: null }])
  return trimmedValue || null
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {},
  loading: false,
  saving: false,
  error: null,

  fetchSettings: async () => {
    if (fetchSettingsInFlight) {
      return fetchSettingsInFlight
    }

    fetchSettingsInFlight = (async () => {
      set({ loading: true, error: null })
      try {
        const rows = await executeQuery<{ key: string; value: string | null }>(
          'SELECT key, value FROM settings'
        )

        const settings: Record<string, string | null> = {}
        rows.forEach((row) => {
          settings[row.key] = row.value
        })

        // Migrate legacy plaintext API keys from DB to keychain.
        const { values: sensitiveValues, migratedKeys } = await migrateLegacySensitiveSettings(settings)
        for (const key of Object.keys(sensitiveValues)) {
          const sensitiveValue = sensitiveValues[key as keyof typeof sensitiveValues]
          if (sensitiveValue) {
            settings[key] = sensitiveValue
          } else {
            delete settings[key]
          }
        }

        if (migratedKeys.length > 0) {
          await saveSettingsBatch(migratedKeys.map((key) => ({ key, value: null })))
        }

        set({ settings, loading: false })
      } catch (error) {
        set({ error: getErrorMessage(error), loading: false })
      } finally {
        fetchSettingsInFlight = null
      }
    })()

    return fetchSettingsInFlight
  },

  getSetting: (key: string) => {
    return get().settings[key] ?? null
  },

  getSettingBoolean: (key: string, defaultValue: boolean = false) => {
    const value = get().settings[key]
    if (value === null || value === undefined) return defaultValue
    return value === 'true' || value === '1'
  },

  getSettingNumber: (key: string, defaultValue: number = 0) => {
    const value = get().settings[key]
    if (value === null || value === undefined) return defaultValue
    const num = parseFloat(value)
    return isNaN(num) ? defaultValue : num
  },

  setSetting: async (key: string, value: string | null) => {
    set({ saving: true, error: null })
    try {
      if (isSensitiveKey(key)) {
        const persistedValue = await persistSensitiveSettingToKeychain(key, value)
        set((state) => ({
          settings: { ...state.settings, [key]: persistedValue },
          saving: false,
        }))
        return
      }

      await executeInsert(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, value]
      )

      set((state) => ({
        settings: { ...state.settings, [key]: value },
        saving: false,
      }))
    } catch (error) {
      set({ error: getErrorMessage(error), saving: false })
      throw error
    }
  },

  setSettingsBatch: async (entries: SettingBatchEntry[]) => {
    if (entries.length === 0) return
    set({ saving: true, error: null })

    try {
      const normalEntries: SettingBatchEntry[] = []
      const resolvedValues: Record<string, string | null> = {}

      for (const entry of entries) {
        if (isSensitiveKey(entry.key)) {
          const persistedValue = await persistSensitiveSettingToKeychain(entry.key, entry.value)
          resolvedValues[entry.key] = persistedValue
          continue
        }

        normalEntries.push(entry)
        resolvedValues[entry.key] = entry.value
      }

      if (normalEntries.length > 0) {
        await saveSettingsBatch(normalEntries)
      }

      set((state) => ({
        settings: { ...state.settings, ...resolvedValues },
        saving: false,
      }))
    } catch (error) {
      set({ error: getErrorMessage(error), saving: false })
      throw error
    }
  },

  getClaudeApiKey: () => get().settings['claude_api_key'] ?? null,

  getOpenAIApiKey: () => get().settings['openai_api_key'] ?? null,

  getOllamaUrl: () => get().settings['ollama_url'] ?? DEFAULT_OLLAMA_URL,

  getDefaultProvider: () =>
    (get().settings['default_provider'] as AIProvider) ?? DEFAULT_PROVIDER,

  getDefaultModel: () => get().settings['default_model'] ?? DEFAULT_MODEL,

  getLawyerName: () => get().settings['lawyer_name'] ?? null,

  getLawyerOAB: () => get().settings['lawyer_oab'] ?? null,

  getUiDensity: () => (get().settings['ui_density'] === 'compact' ? 'compact' : 'normal'),

  setUiDensity: async (density) => {
    await get().setSetting('ui_density', density)
  },

  getUiMotion: () => {
    const value = get().settings['ui_motion']
    if (value === 'normal' || value === 'reduced') return value
    return 'system'
  },

  setUiMotion: async (mode) => {
    await get().setSetting('ui_motion', mode)
  },

  getAssistantLastSessionId: () => {
    const value = get().settings['assistant_last_session_id']
    if (!value) return null
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  },

  setAssistantLastSessionId: async (sessionId) => {
    await get().setSetting(
      'assistant_last_session_id',
      sessionId === null ? null : String(sessionId)
    )
  },

  // Claude Advanced Settings - with sensible defaults
  getClaudeThinkingEnabled: () => get().getSettingBoolean('claude_thinking_enabled', true),

  getClaudeWebSearchEnabled: () => get().getSettingBoolean('claude_web_search_enabled', true),

  getClaudeCacheEnabled: () => get().getSettingBoolean('claude_cache_enabled', true),

  getClaudeShowCosts: () => get().getSettingBoolean('claude_show_costs', true),
}))

