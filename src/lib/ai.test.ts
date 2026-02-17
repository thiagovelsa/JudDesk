import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockFetch, resetMocks } from '@/test/setup'
import {
  isOllamaRunning,
  getOllamaModels,
  sendToOllama,
  sendToClaude,
  sendToOpenAI,
  sendToGPT5Mini,
  sendToGemini,
  sendMessage,
  sendMessageAdvanced,
  testAPIConnection,
  RECOMMENDED_MODELS,
  type GPT5RequestConfig,
  type GeminiRequestConfig,
} from './ai'

describe('AI Integration', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('isOllamaRunning', () => {
    it('should return true when Ollama is running', async () => {
      mockFetch({ models: [] }, true)

      const result = await isOllamaRunning()

      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('should return false when Ollama is not running', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection refused')
      )

      const result = await isOllamaRunning()

      expect(result).toBe(false)
    })
  })

  describe('getOllamaModels', () => {
    it('should return list of models', async () => {
      const mockModels = [
        { name: 'llama3.1', size: 1000000, modified_at: '2024-01-01' },
        { name: 'mistral', size: 2000000, modified_at: '2024-01-02' },
      ]

      mockFetch({ models: mockModels }, true)

      const result = await getOllamaModels()

      expect(result).toEqual(mockModels)
    })

    it('should return empty array on error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection refused')
      )

      const result = await getOllamaModels()

      expect(result).toEqual([])
    })
  })

  describe('sendToOllama', () => {
    it('should send message to Ollama and return response', async () => {
      mockFetch({ message: { content: 'Hello from Ollama!' } }, true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const result = await sendToOllama('llama3.1', messages)

      expect(result).toBe('Hello from Ollama!')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('llama3.1'),
        })
      )
    })

    it('should include context in system prompt', async () => {
      mockFetch({ message: { content: 'Response' } }, true)

      const messages = [{ role: 'user', content: 'Question' }]
      await sendToOllama('llama3.1', messages, 'Document context here')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Document context here'),
        })
      )
    })

    it('should throw error on non-ok response', async () => {
      mockFetch({ error: 'Model not found' }, false)

      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(sendToOllama('invalid', messages)).rejects.toThrow('Ollama error')
    })
  })

  describe('sendToClaude', () => {
    it('should send message to Claude API', async () => {
      mockFetch(
        {
          content: [{ type: 'text', text: 'Hello from Claude!' }],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        },
        true
      )

      const messages = [{ role: 'user', content: 'Hello' }]
      const response = await sendToClaude('claude-sonnet-4-20250514', 'sk-test', messages)

      expect(response.content).toBe('Hello from Claude!')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'sk-test',
            'anthropic-version': '2023-06-01',
          }),
        })
      )
    })

    it('should throw error on API failure', async () => {
      mockFetch({ error: 'Invalid API key' }, false)

      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(
        sendToClaude('claude-sonnet-4-20250514', 'invalid', messages)
      ).rejects.toThrow('Claude error')
    })
  })

  describe('sendToOpenAI', () => {
    it('should send message to OpenAI API', async () => {
      mockFetch(
        { choices: [{ message: { content: 'Hello from OpenAI!' } }] },
        true
      )

      const messages = [{ role: 'user', content: 'Hello' }]
      const result = await sendToOpenAI('gpt-4o', 'sk-test', messages)

      expect(result).toBe('Hello from OpenAI!')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test',
          }),
        })
      )
    })
  })

  describe('sendMessage', () => {
    it('should route to Ollama when provider is ollama', async () => {
      mockFetch({ message: { content: 'Ollama response' } }, true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const result = await sendMessage('ollama', 'llama3.1', messages)

      expect(result).toBe('Ollama response')
    })

    it('should route to Claude when provider is claude', async () => {
      mockFetch({
        content: [{ type: 'text', text: 'Claude response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        }
      }, true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const result = await sendMessage('claude', 'claude-sonnet-4-20250514', messages, 'api-key')

      expect(result).toBe('Claude response')
    })

    it('should route to OpenAI when provider is openai', async () => {
      mockFetch(
        { choices: [{ message: { content: 'OpenAI response' } }] },
        true
      )

      const messages = [{ role: 'user', content: 'Hello' }]
      const result = await sendMessage('openai', 'gpt-4o', messages, 'api-key')

      expect(result).toBe('OpenAI response')
    })

    it('should throw error when Claude API key is missing', async () => {
      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(
        sendMessage('claude', 'claude-sonnet-4-20250514', messages)
      ).rejects.toThrow('Claude API key is required')
    })

    it('should throw error when OpenAI API key is missing', async () => {
      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(
        sendMessage('openai', 'gpt-4o', messages)
      ).rejects.toThrow('OpenAI API key is required')
    })
  })

  describe('RECOMMENDED_MODELS', () => {
    it('should have models for all providers', () => {
      expect(RECOMMENDED_MODELS.ollama).toContain('llama3.1')
      expect(RECOMMENDED_MODELS.claude).toContain('claude-sonnet-4-20250514')
      expect(RECOMMENDED_MODELS.openai).toContain('gpt-5-mini')
    })
  })

  describe('getOllamaModels', () => {
    it('should return empty array when response is not ok', async () => {
      mockFetch({ error: 'Not found' }, false)

      const result = await getOllamaModels()

      expect(result).toEqual([])
    })
  })

  describe('sendToClaude with context', () => {
    it('should include context in system prompt', async () => {
      mockFetch({
        content: [{ type: 'text', text: 'Response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        }
      }, true)

      const messages = [{ role: 'user', content: 'Question' }]
      await sendToClaude('claude-sonnet-4-20250514', 'sk-test', messages, 'Document context')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Document context'),
        })
      )
    })
  })

  describe('sendToClaude with beta headers', () => {
    it('should add web-search beta header when useWebSearch is enabled', async () => {
      mockFetch({
        content: [{ type: 'text', text: 'Response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        }
      }, true)

      const messages = [{ role: 'user', content: 'Search something' }]
      await sendToClaude('claude-sonnet-4-20250514', 'sk-test', messages, undefined, {
        useWebSearch: true
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'web-search-2025-03-05',
          }),
        })
      )
    })

    it('should add interleaved-thinking beta header when thinking is enabled', async () => {
      mockFetch({
        content: [{ type: 'text', text: 'Response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        }
      }, true)

      const messages = [{ role: 'user', content: 'Analyze this' }]
      await sendToClaude('claude-sonnet-4-20250514', 'sk-test', messages, undefined, {
        thinking: { enabled: true, budget_tokens: 10000 }
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'interleaved-thinking-2025-05-14',
          }),
        })
      )
    })

    it('should combine beta headers when both thinking and webSearch are enabled', async () => {
      mockFetch({
        content: [{ type: 'text', text: 'Response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        }
      }, true)

      const messages = [{ role: 'user', content: 'Search and analyze' }]
      await sendToClaude('claude-sonnet-4-20250514', 'sk-test', messages, undefined, {
        thinking: { enabled: true, budget_tokens: 10000 },
        useWebSearch: true
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'interleaved-thinking-2025-05-14,web-search-2025-03-05',
          }),
        })
      )
    })

    it('should not include anthropic-beta header when neither thinking nor webSearch is enabled', async () => {
      mockFetch({
        content: [{ type: 'text', text: 'Response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        }
      }, true)

      const messages = [{ role: 'user', content: 'Hello' }]
      await sendToClaude('claude-sonnet-4-20250514', 'sk-test', messages)

      const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      const lastCall = fetchCalls[fetchCalls.length - 1]
      const headers = lastCall[1].headers

      expect(headers['anthropic-beta']).toBeUndefined()
    })
  })

  describe('sendToOpenAI', () => {
    it('should include context in system prompt', async () => {
      mockFetch({ choices: [{ message: { content: 'Response' } }] }, true)

      const messages = [{ role: 'user', content: 'Question' }]
      await sendToOpenAI('gpt-4o', 'sk-test', messages, 'Context info')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Context info'),
        })
      )
    })

    it('should throw error on API failure', async () => {
      mockFetch({ error: 'Rate limit exceeded' }, false)

      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(
        sendToOpenAI('gpt-4o', 'invalid', messages)
      ).rejects.toThrow('OpenAI error')
    })
  })

  describe('sendMessage', () => {
    it('should throw error for unknown provider', async () => {
      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(
        sendMessage('unknown' as 'ollama', 'model', messages)
      ).rejects.toThrow('Unknown provider')
    })

    it('should pass context to provider', async () => {
      mockFetch({ message: { content: 'Response' } }, true)

      const messages = [{ role: 'user', content: 'Hello' }]
      await sendMessage('ollama', 'llama3.1', messages, undefined, 'My context')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('My context'),
        })
      )
    })
  })

  describe('testAPIConnection', () => {
    it('should test Ollama connection - success', async () => {
      mockFetch({ models: [] }, true)

      const result = await testAPIConnection('ollama', '')

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should test Ollama connection - failure', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection refused')
      )

      const result = await testAPIConnection('ollama', '')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Ollama não está rodando')
    })

    it('should test Claude connection - success', async () => {
      mockFetch({ content: [{ text: 'Hi' }] }, true)

      const result = await testAPIConnection('claude', 'sk-ant-test')

      expect(result.success).toBe(true)
    })

    it('should test Claude connection - invalid API key', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ error: { message: 'Invalid API key' } }),
        text: vi.fn().mockResolvedValue('Unauthorized'),
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await testAPIConnection('claude', 'invalid-key')

      expect(result.success).toBe(false)
      expect(result.error).toBe('API key inválida')
    })

    it('should test Claude connection - bad request (400)', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue({ error: { message: 'Bad request error' } }),
        text: vi.fn().mockResolvedValue('Bad Request'),
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await testAPIConnection('claude', 'sk-test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Bad request error')
    })

    it('should test Claude connection - other error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: vi.fn().mockResolvedValue({ error: { message: 'Internal error' } }),
        text: vi.fn().mockResolvedValue('Server Error'),
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await testAPIConnection('claude', 'sk-test')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Internal error')
    })

    it('should test Claude connection - json parse error fallback', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
        text: vi.fn().mockResolvedValue('Server Error'),
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await testAPIConnection('claude', 'sk-test')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Server Error')
    })

    it('should test OpenAI connection - success', async () => {
      mockFetch({ data: [{ id: 'gpt-4' }] }, true)

      const result = await testAPIConnection('openai', 'sk-test')

      expect(result.success).toBe(true)
    })

    it('should test OpenAI connection - invalid API key', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ error: { message: 'Invalid API key' } }),
        text: vi.fn().mockResolvedValue('Unauthorized'),
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await testAPIConnection('openai', 'invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('API key inválida')
    })

    it('should test OpenAI connection - other error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: vi.fn().mockResolvedValue({ error: { message: 'Rate limit' } }),
        text: vi.fn().mockResolvedValue('Server Error'),
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await testAPIConnection('openai', 'sk-test')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Rate limit')
    })

    it('should handle unsupported provider', async () => {
      const result = await testAPIConnection('unknown' as 'ollama', 'key')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Provider não suportado')
    })

    it('should handle network errors', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )

      const result = await testAPIConnection('claude', 'sk-test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should handle non-Error exceptions', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue('Unknown error')

      const result = await testAPIConnection('claude', 'sk-test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Erro de conexão')
    })
  })

  // =========================================
  // GPT-5 Mini Tests
  // =========================================

  describe('sendToGPT5Mini', () => {
    // Helper to create GPT-5 API response format
    const createGPT5Response = (text: string, usage: Record<string, number>, reasoning?: string) => ({
      output: [
        ...(reasoning ? [{
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: reasoning }]
        }] : []),
        {
          type: 'message',
          content: [{ type: 'output_text', text }]
        }
      ],
      usage: {
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        reasoning_tokens: usage.reasoning_tokens || 0,
        cached_tokens: usage.cached_tokens || 0
      }
    })

    it('should send message to GPT-5 Mini using Responses API', async () => {
      mockFetch(createGPT5Response('Hello from GPT-5 Mini!', {
        input_tokens: 100,
        output_tokens: 50,
        reasoning_tokens: 10,
        cached_tokens: 20
      }), true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const response = await sendToGPT5Mini('gpt-5-mini', 'sk-test', messages)

      expect(response.content).toBe('Hello from GPT-5 Mini!')
      expect(response.usage.input_tokens).toBe(100)
      expect(response.usage.output_tokens).toBe(50)
      expect(response.usage.reasoning_tokens).toBe(10)
      expect(response.usage.cached_tokens).toBe(20)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/responses',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test',
          }),
        })
      )
    })

    it('should include reasoning_effort in request', async () => {
      mockFetch(createGPT5Response('Response', {
        input_tokens: 50, output_tokens: 25, reasoning_tokens: 5
      }), true)

      const messages = [{ role: 'user', content: 'Analyze this' }]
      const config: GPT5RequestConfig = {
        reasoning_effort: 'high',
        verbosity: 'medium',
        max_output_tokens: 4096,
        useWebSearch: false
      }

      await sendToGPT5Mini('gpt-5-mini', 'sk-test', messages, undefined, config)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"effort":"high"'),
        })
      )
    })

    it('should include verbosity in request', async () => {
      mockFetch(createGPT5Response('Response', {
        input_tokens: 50, output_tokens: 25
      }), true)

      const messages = [{ role: 'user', content: 'Question' }]
      const config: GPT5RequestConfig = {
        reasoning_effort: 'medium',
        verbosity: 'high',
        max_output_tokens: 8192,
        useWebSearch: false
      }

      await sendToGPT5Mini('gpt-5-mini', 'sk-test', messages, undefined, config)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"verbosity":"high"'),
        })
      )
    })

    it('should include web_search tool when enabled', async () => {
      mockFetch(createGPT5Response('Response with search', {
        input_tokens: 100, output_tokens: 50
      }), true)

      const messages = [{ role: 'user', content: 'Search for something' }]
      const config: GPT5RequestConfig = {
        reasoning_effort: 'low',
        verbosity: 'medium',
        max_output_tokens: 4096,
        useWebSearch: true
      }

      await sendToGPT5Mini('gpt-5-mini', 'sk-test', messages, undefined, config)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('web_search'),
        })
      )
    })

    it('should include context in developer prompt', async () => {
      mockFetch(createGPT5Response('Response', {
        input_tokens: 150, output_tokens: 50
      }), true)

      const messages = [{ role: 'user', content: 'Question about the document' }]
      await sendToGPT5Mini('gpt-5-mini', 'sk-test', messages, 'Document context here')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Document context here'),
        })
      )
    })

    it('should throw error on API failure', async () => {
      mockFetch({ error: 'Invalid API key' }, false)

      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(
        sendToGPT5Mini('gpt-5-mini', 'invalid', messages)
      ).rejects.toThrow('GPT-5 error')
    })

    it('should extract reasoning content when present', async () => {
      mockFetch(createGPT5Response('Final answer', {
        input_tokens: 100, output_tokens: 50, reasoning_tokens: 30
      }, 'This is my reasoning process'), true)

      const messages = [{ role: 'user', content: 'Analyze this' }]
      const config: GPT5RequestConfig = {
        reasoning_effort: 'high',
        verbosity: 'medium',
        max_output_tokens: 4096,
        useWebSearch: false
      }

      const response = await sendToGPT5Mini('gpt-5-mini', 'sk-test', messages, undefined, config)

      expect(response.content).toBe('Final answer')
      expect(response.reasoning_content).toBe('This is my reasoning process')
    })

    it('should handle missing reasoning_tokens in usage', async () => {
      mockFetch({
        output: [{
          type: 'message',
          content: [{ type: 'output_text', text: 'Response' }]
        }],
        usage: { input_tokens: 100, output_tokens: 50 }
      }, true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const response = await sendToGPT5Mini('gpt-5-mini', 'sk-test', messages)

      // Implementation passes through undefined from API when fields are missing
      expect(response.usage.reasoning_tokens).toBeUndefined()
      expect(response.usage.cached_tokens).toBeUndefined()
    })

    it('should use default max_output_tokens when no config provided', async () => {
      mockFetch(createGPT5Response('Response', {
        input_tokens: 50, output_tokens: 25
      }), true)

      const messages = [{ role: 'user', content: 'Hello' }]
      await sendToGPT5Mini('gpt-5-mini', 'sk-test', messages)

      // Should use default max_output_tokens: 4096
      // Reasoning is NOT added to request when no config is provided
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"max_output_tokens":4096'),
        })
      )
    })
  })

  describe('sendMessageAdvanced with GPT-5', () => {
    // Helper to create GPT-5 API response format
    const createGPT5Response = (text: string, usage: Record<string, number>) => ({
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text }]
      }],
      usage: {
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        reasoning_tokens: usage.reasoning_tokens || 0,
        cached_tokens: usage.cached_tokens || 0
      }
    })

    it('should route to GPT-5 Mini for gpt-5 models', async () => {
      mockFetch(createGPT5Response('GPT-5 response', {
        input_tokens: 100, output_tokens: 50, reasoning_tokens: 10
      }), true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const result = await sendMessageAdvanced('openai', 'gpt-5-mini', messages, 'api-key')

      expect(result.content).toBe('GPT-5 response')
      expect(result.gpt5_usage).toBeDefined()
      expect(result.gpt5_usage?.reasoning_tokens).toBe(10)
    })

    it('should pass gpt5Config to GPT-5 request', async () => {
      mockFetch(createGPT5Response('Response', {
        input_tokens: 50, output_tokens: 25
      }), true)

      const messages = [{ role: 'user', content: 'Busque jurisprudência' }]
      const gpt5Config: GPT5RequestConfig = {
        reasoning_effort: 'high',
        verbosity: 'high',
        max_output_tokens: 8192,
        useWebSearch: true
      }

      await sendMessageAdvanced('openai', 'gpt-5-mini', messages, 'api-key', undefined, undefined, gpt5Config)

      // Should include web_search tool since useWebSearch is true
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('web_search'),
        })
      )
    })

    it('should send reasoning.effort = none when reasoning_effort is none', async () => {
      mockFetch(createGPT5Response('Response', {
        input_tokens: 50, output_tokens: 25
      }), true)

      const messages = [{ role: 'user', content: 'Olá' }]
      const gpt5Config: GPT5RequestConfig = {
        reasoning_effort: 'none',
        verbosity: 'low',
        max_output_tokens: 4096,
        useWebSearch: false
      }

      await sendMessageAdvanced('openai', 'gpt-5-mini', messages, 'api-key', undefined, undefined, gpt5Config)

      // When reasoning_effort is 'none', we should explicitly send it to override API default
      const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      const lastCall = fetchCalls[fetchCalls.length - 1]
      const body = JSON.parse(lastCall[1].body)

      // reasoning.effort should be 'none' to disable reasoning
      expect(body.reasoning).toEqual({ effort: 'none' })
    })

    it('should fallback to Chat Completions API for non-GPT-5 models', async () => {
      mockFetch(
        { choices: [{ message: { content: 'GPT-4o response' } }] },
        true
      )

      const messages = [{ role: 'user', content: 'Hello' }]
      const result = await sendMessageAdvanced('openai', 'gpt-4o', messages, 'api-key')

      expect(result.content).toBe('GPT-4o response')
      expect(result.gpt5_usage).toBeUndefined()
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.anything()
      )
    })
  })

  // =========================================
  // Google Gemini 3 Flash Tests
  // =========================================

  describe('sendToGemini', () => {
    // Helper to create Gemini API response format
    const createGeminiResponse = (
      text: string,
      usage: { prompt: number; candidates: number; thoughts?: number },
      thinkingContent?: string
    ) => ({
      candidates: [{
        content: {
          parts: [
            ...(thinkingContent ? [{ text: thinkingContent, thought: true }] : []),
            { text }
          ],
          role: 'model'
        },
        finishReason: 'STOP'
      }],
      usageMetadata: {
        promptTokenCount: usage.prompt,
        candidatesTokenCount: usage.candidates,
        totalTokenCount: usage.prompt + usage.candidates,
        thoughtsTokenCount: usage.thoughts
      }
    })

    it('should send message to Gemini using generateContent API', async () => {
      mockFetch(createGeminiResponse('Hello from Gemini!', {
        prompt: 100,
        candidates: 50
      }), true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const response = await sendToGemini('models/gemini-3-flash-preview', 'AIza-test', messages)

      expect(response.content).toBe('Hello from Gemini!')
      expect(response.usage.input_tokens).toBe(100)
      expect(response.usage.output_tokens).toBe(50)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': 'AIza-test',
          }
        })
      )
    })

    it('should include API key in header (not URL) for security', async () => {
      mockFetch(createGeminiResponse('Response', { prompt: 50, candidates: 25 }), true)

      const messages = [{ role: 'user', content: 'Test' }]
      await sendToGemini('models/gemini-3-flash-preview', 'AIza-my-key', messages)

      // API key should be in header, not URL (security improvement)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.not.stringContaining('key='),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-goog-api-key': 'AIza-my-key'
          })
        })
      )
    })

    it('should include thinking_level in request', async () => {
      mockFetch(createGeminiResponse('Response', { prompt: 50, candidates: 25, thoughts: 100 }), true)

      const messages = [{ role: 'user', content: 'Analyze this' }]
      const config: GeminiRequestConfig = {
        thinking_level: 'high',
        max_output_tokens: 4096,
        useWebSearch: false
      }

      await sendToGemini('models/gemini-3-flash-preview', 'AIza-test', messages, undefined, config)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"thinkingBudget":"high"')
        })
      )
    })

    it('should include Google Search grounding when enabled', async () => {
      mockFetch(createGeminiResponse('Search result', { prompt: 100, candidates: 50 }), true)

      const messages = [{ role: 'user', content: 'Search for something' }]
      const config: GeminiRequestConfig = {
        thinking_level: 'low',
        max_output_tokens: 4096,
        useWebSearch: true
      }

      await sendToGemini('models/gemini-3-flash-preview', 'AIza-test', messages, undefined, config)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('googleSearch')
        })
      )
    })

    it('should include context in system prompt', async () => {
      mockFetch(createGeminiResponse('Response', { prompt: 150, candidates: 50 }), true)

      const messages = [{ role: 'user', content: 'Question about the document' }]
      await sendToGemini('models/gemini-3-flash-preview', 'AIza-test', messages, 'Document context here')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Document context here')
        })
      )
    })

    it('should throw error on API failure', async () => {
      mockFetch({ error: { message: 'Invalid API key' } }, false)

      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(
        sendToGemini('models/gemini-3-flash-preview', 'invalid', messages)
      ).rejects.toThrow('Gemini error')
    })

    it('should extract thinking content when present', async () => {
      mockFetch(createGeminiResponse('Final answer', {
        prompt: 100, candidates: 50, thoughts: 200
      }, 'This is my thinking process'), true)

      const messages = [{ role: 'user', content: 'Analyze this' }]
      const config: GeminiRequestConfig = {
        thinking_level: 'high',
        max_output_tokens: 4096,
        useWebSearch: false
      }

      const response = await sendToGemini('models/gemini-3-flash-preview', 'AIza-test', messages, undefined, config)

      expect(response.content).toBe('Final answer')
      expect(response.thinking_content).toBe('This is my thinking process')
      expect(response.usage.thinking_tokens).toBe(200)
    })

    it('should handle missing thinking_tokens in usage', async () => {
      mockFetch({
        candidates: [{
          content: {
            parts: [{ text: 'Response' }],
            role: 'model'
          },
          finishReason: 'STOP'
        }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
      }, true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const response = await sendToGemini('models/gemini-3-flash-preview', 'AIza-test', messages)

      expect(response.usage.thinking_tokens).toBeUndefined()
    })

    it('should use default max_output_tokens when no config provided', async () => {
      mockFetch(createGeminiResponse('Response', { prompt: 50, candidates: 25 }), true)

      const messages = [{ role: 'user', content: 'Hello' }]
      await sendToGemini('models/gemini-3-flash-preview', 'AIza-test', messages)

      // Should use default max_output_tokens: 4096
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"maxOutputTokens":4096')
        })
      )
    })

    it('should convert assistant role to model role', async () => {
      mockFetch(createGeminiResponse('Response', { prompt: 100, candidates: 50 }), true)

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ]
      await sendToGemini('models/gemini-3-flash-preview', 'AIza-test', messages)

      const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      const lastCall = fetchCalls[fetchCalls.length - 1]
      const body = JSON.parse(lastCall[1].body)

      // Check that assistant was converted to model
      const modelMessage = body.contents.find((c: { role: string }) => c.role === 'model')
      expect(modelMessage).toBeDefined()
    })
  })

  describe('testAPIConnection for Gemini', () => {
    it('should test Gemini connection - success', async () => {
      mockFetch({ models: [{ name: 'models/gemini-3-flash-preview' }] }, true)

      const result = await testAPIConnection('gemini', 'AIza-test')

      expect(result.success).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com/v1beta/models'),
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('should test Gemini connection - invalid API key', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue({ error: { message: 'API key not valid' } }),
        text: vi.fn().mockResolvedValue('Bad Request')
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await testAPIConnection('gemini', 'invalid-key')

      expect(result.success).toBe(false)
      expect(result.error).toBe('API key inválida')
    })

    it('should test Gemini connection - 403 forbidden', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: vi.fn().mockResolvedValue({ error: { message: 'Permission denied' } }),
        text: vi.fn().mockResolvedValue('Forbidden')
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await testAPIConnection('gemini', 'blocked-key')

      expect(result.success).toBe(false)
      expect(result.error).toBe('API key inválida')
    })

    it('should test Gemini connection - other error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: vi.fn().mockResolvedValue({ error: { message: 'Internal error' } }),
        text: vi.fn().mockResolvedValue('Server Error')
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await testAPIConnection('gemini', 'AIza-test')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Internal error')
    })
  })

  describe('sendMessageAdvanced with Gemini', () => {
    // Helper to create Gemini API response format
    const createGeminiResponse = (text: string, usage: { prompt: number; candidates: number; thoughts?: number }) => ({
      candidates: [{
        content: {
          parts: [{ text }],
          role: 'model'
        },
        finishReason: 'STOP'
      }],
      usageMetadata: {
        promptTokenCount: usage.prompt,
        candidatesTokenCount: usage.candidates,
        totalTokenCount: usage.prompt + usage.candidates,
        thoughtsTokenCount: usage.thoughts
      }
    })

    it('should route to Gemini for gemini provider', async () => {
      mockFetch(createGeminiResponse('Gemini response', {
        prompt: 100, candidates: 50, thoughts: 30
      }), true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const result = await sendMessageAdvanced('gemini', 'models/gemini-3-flash-preview', messages, 'AIza-test')

      expect(result.content).toBe('Gemini response')
      expect(result.gemini_usage).toBeDefined()
      expect(result.gemini_usage?.input_tokens).toBe(100)
      expect(result.gemini_usage?.output_tokens).toBe(50)
    })

    it('should pass geminiConfig to Gemini request', async () => {
      mockFetch(createGeminiResponse('Response', { prompt: 50, candidates: 25 }), true)

      const messages = [{ role: 'user', content: 'Busque jurisprudência' }]
      const geminiConfig: GeminiRequestConfig = {
        thinking_level: 'high',
        max_output_tokens: 8192,
        useWebSearch: true
      }

      await sendMessageAdvanced('gemini', 'models/gemini-3-flash-preview', messages, 'AIza-test', undefined, undefined, undefined, geminiConfig)

      // Should include Google Search grounding since useWebSearch is true
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('googleSearch')
        })
      )
    })

    it('should use minimal thinking for simple questions', async () => {
      mockFetch(createGeminiResponse('Response', { prompt: 50, candidates: 25 }), true)

      const messages = [{ role: 'user', content: 'Olá' }]
      const geminiConfig: GeminiRequestConfig = {
        thinking_level: 'minimal',
        max_output_tokens: 2048,
        useWebSearch: false
      }

      await sendMessageAdvanced('gemini', 'models/gemini-3-flash-preview', messages, 'AIza-test', undefined, undefined, undefined, geminiConfig)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"thinkingBudget":"minimal"')
        })
      )
    })

    it('should require API key for Gemini', async () => {
      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(
        sendMessageAdvanced('gemini', 'models/gemini-3-flash-preview', messages)
      ).rejects.toThrow('Google AI API key is required')
    })

    it('should return thinking_content from Gemini response', async () => {
      mockFetch({
        candidates: [{
          content: {
            parts: [
              { text: 'This is thinking', thought: true },
              { text: 'Final answer' }
            ],
            role: 'model'
          },
          finishReason: 'STOP'
        }],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
          thoughtsTokenCount: 30
        }
      }, true)

      const messages = [{ role: 'user', content: 'Analyze this' }]
      const geminiConfig: GeminiRequestConfig = {
        thinking_level: 'high',
        max_output_tokens: 4096,
        useWebSearch: false
      }

      const result = await sendMessageAdvanced('gemini', 'models/gemini-3-flash-preview', messages, 'AIza-test', undefined, undefined, undefined, geminiConfig)

      expect(result.content).toBe('Final answer')
      expect(result.thinking_content).toBe('This is thinking')
    })
  })

  describe('RECOMMENDED_MODELS includes Gemini', () => {
    it('should have Gemini models in recommendations', () => {
      expect(RECOMMENDED_MODELS.gemini).toBeDefined()
      expect(RECOMMENDED_MODELS.gemini).toContain('models/gemini-3-pro-preview')
      expect(RECOMMENDED_MODELS.gemini).toContain('models/gemini-3-flash-preview')
    })

    it('should have models for all providers', () => {
      expect(RECOMMENDED_MODELS.ollama).toContain('llama3.1')
      expect(RECOMMENDED_MODELS.claude).toContain('claude-sonnet-4-20250514')
      expect(RECOMMENDED_MODELS.openai).toContain('gpt-5-mini')
      expect(RECOMMENDED_MODELS.gemini).toContain('models/gemini-3-flash-preview')
    })
  })

  describe('sendMessage with Gemini', () => {
    it('should route to Gemini when provider is gemini', async () => {
      mockFetch({
        candidates: [{
          content: {
            parts: [{ text: 'Gemini response' }],
            role: 'model'
          },
          finishReason: 'STOP'
        }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
      }, true)

      const messages = [{ role: 'user', content: 'Hello' }]
      const result = await sendMessage('gemini', 'models/gemini-3-flash-preview', messages, 'AIza-test')

      expect(result).toBe('Gemini response')
    })

    it('should throw error when Gemini API key is missing', async () => {
      const messages = [{ role: 'user', content: 'Hello' }]

      await expect(
        sendMessage('gemini', 'models/gemini-3-flash-preview', messages)
      ).rejects.toThrow('Google AI API key is required')
    })
  })
})
