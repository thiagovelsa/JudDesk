import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetMocks } from '@/test/setup'

// Mock db module directly
const mockExecuteQuery = vi.fn()
const mockExecuteInsert = vi.fn()
const mockExecuteUpdate = vi.fn()

vi.mock('@/lib/db', () => ({
  executeQuery: (...args: unknown[]) => mockExecuteQuery(...args),
  executeInsert: (...args: unknown[]) => mockExecuteInsert(...args),
  executeUpdate: (...args: unknown[]) => mockExecuteUpdate(...args),
  isTauriEnvironment: () => true,
}))

import { useSettingsStore } from './settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    resetMocks()
    vi.clearAllMocks()
    mockExecuteQuery.mockReset()
    mockExecuteInsert.mockReset()
    mockExecuteUpdate.mockReset()
    mockExecuteInsert.mockResolvedValue(1)
    mockExecuteUpdate.mockResolvedValue(undefined)
    // Reset store state
    useSettingsStore.setState({
      settings: {},
      loading: false,
      error: null,
    })
  })

  describe('fetchSettings', () => {
    it('should fetch all settings from database', async () => {
      const mockSettings = [
        { key: 'claude_api_key', value: 'sk-test-123' },
        { key: 'ollama_url', value: 'http://localhost:11434' },
        { key: 'default_provider', value: 'claude' },
      ]
      mockExecuteQuery.mockResolvedValue(mockSettings)

      await useSettingsStore.getState().fetchSettings()

      const state = useSettingsStore.getState()
      expect(state.settings).toEqual({
        claude_api_key: 'sk-test-123',
        ollama_url: 'http://localhost:11434',
        default_provider: 'claude',
      })
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set loading state during fetch', async () => {
      mockExecuteQuery.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      )

      const fetchPromise = useSettingsStore.getState().fetchSettings()
      expect(useSettingsStore.getState().loading).toBe(true)

      await fetchPromise
      expect(useSettingsStore.getState().loading).toBe(false)
    })

    it('should handle empty settings', async () => {
      mockExecuteQuery.mockResolvedValue([])

      await useSettingsStore.getState().fetchSettings()

      expect(useSettingsStore.getState().settings).toEqual({})
    })

    it('should handle errors', async () => {
      mockExecuteQuery.mockRejectedValue(new Error('Database error'))

      await useSettingsStore.getState().fetchSettings()

      const state = useSettingsStore.getState()
      expect(state.error).toBe('Database error')
      expect(state.loading).toBe(false)
    })
  })

  describe('getSetting', () => {
    it('should return setting value by key', () => {
      useSettingsStore.setState({
        settings: { test_key: 'test_value' },
      })

      const result = useSettingsStore.getState().getSetting('test_key')

      expect(result).toBe('test_value')
    })

    it('should return null for non-existent key', () => {
      useSettingsStore.setState({ settings: {} })

      const result = useSettingsStore.getState().getSetting('non_existent')

      expect(result).toBeNull()
    })

    it('should return null when setting value is null', () => {
      useSettingsStore.setState({
        settings: { nullable_key: null },
      })

      const result = useSettingsStore.getState().getSetting('nullable_key')

      expect(result).toBeNull()
    })
  })

  describe('setSetting', () => {
    it('should insert or replace setting atomically', async () => {
      await useSettingsStore.getState().setSetting('new_key', 'new_value')

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['new_key', 'new_value']
      )
      expect(useSettingsStore.getState().settings['new_key']).toBe('new_value')
    })

    it('should update existing setting atomically', async () => {
      await useSettingsStore.getState().setSetting('existing_key', 'updated_value')

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['existing_key', 'updated_value']
      )
      expect(useSettingsStore.getState().settings['existing_key']).toBe('updated_value')
    })

    it('should allow setting null value', async () => {
      await useSettingsStore.getState().setSetting('key_to_null', null)

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['key_to_null', null]
      )
      expect(useSettingsStore.getState().settings['key_to_null']).toBeNull()
    })

    it('should handle errors and throw', async () => {
      mockExecuteInsert.mockRejectedValue(new Error('Insert failed'))

      await expect(
        useSettingsStore.getState().setSetting('key', 'value')
      ).rejects.toThrow('Insert failed')

      expect(useSettingsStore.getState().error).toBe('Insert failed')
    })
  })

  describe('getClaudeApiKey', () => {
    it('should return Claude API key when set', () => {
      useSettingsStore.setState({
        settings: { claude_api_key: 'sk-ant-test123' },
      })

      expect(useSettingsStore.getState().getClaudeApiKey()).toBe('sk-ant-test123')
    })

    it('should return null when not set', () => {
      useSettingsStore.setState({ settings: {} })

      expect(useSettingsStore.getState().getClaudeApiKey()).toBeNull()
    })
  })

  describe('getOpenAIApiKey', () => {
    it('should return OpenAI API key when set', () => {
      useSettingsStore.setState({
        settings: { openai_api_key: 'sk-openai-test123' },
      })

      expect(useSettingsStore.getState().getOpenAIApiKey()).toBe('sk-openai-test123')
    })

    it('should return null when not set', () => {
      useSettingsStore.setState({ settings: {} })

      expect(useSettingsStore.getState().getOpenAIApiKey()).toBeNull()
    })
  })

  describe('getOllamaUrl', () => {
    it('should return custom Ollama URL when set', () => {
      useSettingsStore.setState({
        settings: { ollama_url: 'http://custom:11434' },
      })

      expect(useSettingsStore.getState().getOllamaUrl()).toBe('http://custom:11434')
    })

    it('should return default URL when not set', () => {
      useSettingsStore.setState({ settings: {} })

      expect(useSettingsStore.getState().getOllamaUrl()).toBe('http://localhost:11434')
    })
  })

  describe('getDefaultProvider', () => {
    it('should return custom provider when set', () => {
      useSettingsStore.setState({
        settings: { default_provider: 'claude' },
      })

      expect(useSettingsStore.getState().getDefaultProvider()).toBe('claude')
    })

    it('should return ollama as default when not set', () => {
      useSettingsStore.setState({ settings: {} })

      expect(useSettingsStore.getState().getDefaultProvider()).toBe('ollama')
    })
  })

  describe('getDefaultModel', () => {
    it('should return custom model when set', () => {
      useSettingsStore.setState({
        settings: { default_model: 'gpt-4o' },
      })

      expect(useSettingsStore.getState().getDefaultModel()).toBe('gpt-4o')
    })

    it('should return llama3.1 as default when not set', () => {
      useSettingsStore.setState({ settings: {} })

      expect(useSettingsStore.getState().getDefaultModel()).toBe('llama3.1')
    })
  })

  describe('getLawyerName', () => {
    it('should return lawyer name when set', () => {
      useSettingsStore.setState({
        settings: { lawyer_name: 'Dr. João Silva' },
      })

      expect(useSettingsStore.getState().getLawyerName()).toBe('Dr. João Silva')
    })

    it('should return null when not set', () => {
      useSettingsStore.setState({ settings: {} })

      expect(useSettingsStore.getState().getLawyerName()).toBeNull()
    })
  })

  describe('getLawyerOAB', () => {
    it('should return lawyer OAB when set', () => {
      useSettingsStore.setState({
        settings: { lawyer_oab: 'OAB/RJ 123456' },
      })

      expect(useSettingsStore.getState().getLawyerOAB()).toBe('OAB/RJ 123456')
    })

    it('should return null when not set', () => {
      useSettingsStore.setState({ settings: {} })

      expect(useSettingsStore.getState().getLawyerOAB()).toBeNull()
    })
  })

  describe('getUiMotion', () => {
    it('should return system by default', () => {
      useSettingsStore.setState({ settings: {} })
      expect(useSettingsStore.getState().getUiMotion()).toBe('system')
    })

    it('should return normal when configured', () => {
      useSettingsStore.setState({ settings: { ui_motion: 'normal' } })
      expect(useSettingsStore.getState().getUiMotion()).toBe('normal')
    })

    it('should return reduced when configured', () => {
      useSettingsStore.setState({ settings: { ui_motion: 'reduced' } })
      expect(useSettingsStore.getState().getUiMotion()).toBe('reduced')
    })
  })

  describe('setUiMotion', () => {
    it('should persist ui motion setting', async () => {
      await useSettingsStore.getState().setUiMotion('reduced')

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['ui_motion', 'reduced']
      )
      expect(useSettingsStore.getState().settings.ui_motion).toBe('reduced')
    })
  })

  describe('getAssistantLastSessionId', () => {
    it('should return null when value is missing', () => {
      useSettingsStore.setState({ settings: {} })
      expect(useSettingsStore.getState().getAssistantLastSessionId()).toBeNull()
    })

    it('should return null when value is invalid', () => {
      useSettingsStore.setState({ settings: { assistant_last_session_id: 'abc' } })
      expect(useSettingsStore.getState().getAssistantLastSessionId()).toBeNull()
    })

    it('should parse valid numeric value', () => {
      useSettingsStore.setState({ settings: { assistant_last_session_id: '42' } })
      expect(useSettingsStore.getState().getAssistantLastSessionId()).toBe(42)
    })
  })

  describe('setAssistantLastSessionId', () => {
    it('should persist assistant last session id', async () => {
      await useSettingsStore.getState().setAssistantLastSessionId(77)

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['assistant_last_session_id', '77']
      )
      expect(useSettingsStore.getState().settings.assistant_last_session_id).toBe('77')
    })

    it('should clear assistant last session id', async () => {
      await useSettingsStore.getState().setAssistantLastSessionId(null)

      expect(mockExecuteInsert).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['assistant_last_session_id', null]
      )
      expect(useSettingsStore.getState().settings.assistant_last_session_id).toBeNull()
    })
  })
})
