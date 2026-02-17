import type { AIProvider, OllamaModel } from '@/types'
import type { APIUsage, GPT5Usage, GeminiUsage } from './costTracker'
import type { ReasoningEffort, Verbosity, GeminiThinkingLevel } from './intentClassifier'

const OLLAMA_BASE_URL = 'http://localhost:11434'

const SYSTEM_PROMPT = `Você é um assistente jurídico especializado no direito brasileiro.
Auxilie na análise de casos, elaboração de peças processuais e pesquisa jurisprudencial.
Seja preciso nas citações legais e mantenha linguagem técnica apropriada.
Quando relevante, cite artigos de lei, súmulas e jurisprudência.`

// ============================================================================
// Types for Extended Thinking and Web Search
// ============================================================================

export interface ThinkingConfig {
  enabled: boolean
  budget_tokens: number
}

export interface ClaudeRequestConfig {
  thinking?: ThinkingConfig
  useWebSearch?: boolean
  useCache?: boolean
  max_tokens?: number
}

export interface ClaudeResponse {
  content: string
  usage: APIUsage
  thinking_content?: string
  web_search_results?: WebSearchResult[]
}

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

// ============================================================================
// Types for GPT-5 Mini (Responses API)
// ============================================================================

export interface GPT5RequestConfig {
  reasoning_effort?: ReasoningEffort
  verbosity?: Verbosity
  max_output_tokens?: number
  useWebSearch?: boolean
}

export interface GPT5Response {
  content: string
  usage: GPT5Usage
  reasoning_content?: string
  web_search_results?: WebSearchResult[]
}

// GPT-5 Responses API types
interface GPT5OutputItem {
  type: 'message' | 'reasoning' | 'web_search_call'
  content?: Array<{ type: 'output_text' | 'refusal'; text?: string }>
  summary?: Array<{ type: 'summary_text'; text: string }>
  id?: string
  status?: string
}

interface GPT5APIResponse {
  id: string
  object: string
  created_at: number
  status: string
  output: GPT5OutputItem[]
  usage: {
    input_tokens: number
    output_tokens: number
    reasoning_tokens?: number
    cached_tokens?: number
  }
}

// ============================================================================
// Types for Google Gemini 3 Flash
// ============================================================================

export interface GeminiRequestConfig {
  thinking_level?: GeminiThinkingLevel
  max_output_tokens?: number
  useWebSearch?: boolean  // Google Search grounding
}

export interface GeminiResponse {
  content: string
  usage: GeminiUsage
  thinking_content?: string
  web_search_results?: WebSearchResult[]
}

// Gemini API response types
interface GeminiAPIResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string
        thought?: boolean
      }>
      role: string
    }
    finishReason: string
  }>
  usageMetadata: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
    thoughtsTokenCount?: number
    cachedContentTokenCount?: number
  }
}

// Claude API response types
interface ClaudeContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result'
  text?: string
  thinking?: string
  id?: string
  name?: string
  input?: unknown
  content?: string
}

interface ClaudeAPIResponse {
  id: string
  type: string
  role: string
  content: ClaudeContentBlock[]
  model: string
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    })
    return response.ok
  } catch {
    return false
  }
}

export async function getOllamaModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    if (!response.ok) return []
    const data = await response.json()
    return data.models || []
  } catch {
    return []
  }
}

interface OllamaMessage {
  role: string
  content: string
}

export async function sendToOllama(
  model: string,
  messages: { role: string; content: string }[],
  context?: string,
  signal?: AbortSignal
): Promise<string> {
  const systemPrompt = context
    ? `${SYSTEM_PROMPT}\n\nContexto dos documentos:\n${context}`
    : SYSTEM_PROMPT

  const ollamaMessages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: false,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.message?.content || ''
}

/**
 * Sends a message to Claude API with optional Extended Thinking, Web Search, and Caching
 *
 * @param model - Claude model ID (e.g., 'claude-sonnet-4-20250514')
 * @param apiKey - Anthropic API key
 * @param messages - Conversation messages
 * @param context - Optional document context
 * @param config - Optional configuration for thinking, web search, and caching
 * @returns ClaudeResponse with content, usage, and optional thinking/search results
 */
export async function sendToClaude(
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  context?: string,
  config?: ClaudeRequestConfig,
  signal?: AbortSignal
): Promise<ClaudeResponse> {
  const systemPrompt = context
    ? `${SYSTEM_PROMPT}\n\nContexto dos documentos:\n${context}`
    : SYSTEM_PROMPT

  // Build request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  // Add beta headers for extended thinking and/or web search
  const betaHeaders: string[] = []
  if (config?.thinking?.enabled) {
    betaHeaders.push('interleaved-thinking-2025-05-14')
  }
  if (config?.useWebSearch) {
    betaHeaders.push('web-search-2025-03-05')
  }
  if (betaHeaders.length > 0) {
    headers['anthropic-beta'] = betaHeaders.join(',')
  }

  // Build system message with optional cache control
  const systemMessage = config?.useCache
    ? [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: { type: 'ephemeral' as const }
        }
      ]
    : systemPrompt

  // Build request body
  const body: Record<string, unknown> = {
    model,
    max_tokens: config?.max_tokens || 4096,
    system: systemMessage,
    messages: messages.filter((m) => m.role !== 'system'),
  }

  // Add Extended Thinking if enabled
  if (config?.thinking?.enabled && config.thinking.budget_tokens > 0) {
    body.thinking = {
      type: 'enabled',
      budget_tokens: config.thinking.budget_tokens
    }
    // Thinking requires higher max_tokens
    body.max_tokens = Math.max(
      (config?.max_tokens || 4096),
      config.thinking.budget_tokens + 4096
    )
  }

  // Add Web Search tool if enabled
  if (config?.useWebSearch) {
    body.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5
      }
    ]
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const statusInfo = `${response.status} ${response.statusText}`
    let errorDetail = ''
    try {
      errorDetail = await response.text()
    } catch {
      // Ignore text parsing errors
    }
    throw new Error(`Claude error (${statusInfo}): ${errorDetail || 'Unknown error'}`)
  }

  const data = await response.json() as ClaudeAPIResponse

  // Extract content from response
  let textContent = ''
  let thinkingContent = ''
  const webSearchResults: WebSearchResult[] = []

  for (const block of data.content) {
    if (block.type === 'text' && block.text) {
      textContent += block.text
    } else if (block.type === 'thinking' && block.thinking) {
      thinkingContent += block.thinking
    } else if (block.type === 'tool_result' && block.content) {
      // Parse web search results if present
      try {
        const searchData = JSON.parse(block.content)
        if (Array.isArray(searchData)) {
          for (const result of searchData) {
            webSearchResults.push({
              title: result.title || '',
              url: result.url || '',
              snippet: result.snippet || result.content || ''
            })
          }
        }
      } catch {
        // Not JSON or not search results, ignore
      }
    }
  }

  // Build usage object
  const usage: APIUsage = {
    input_tokens: data.usage.input_tokens,
    output_tokens: data.usage.output_tokens,
    thinking_tokens: thinkingContent ? Math.ceil(thinkingContent.length / 4) : 0, // Estimate
    cache_creation_input_tokens: data.usage.cache_creation_input_tokens,
    cache_read_input_tokens: data.usage.cache_read_input_tokens
  }

  return {
    content: textContent,
    usage,
    thinking_content: thinkingContent || undefined,
    web_search_results: webSearchResults.length > 0 ? webSearchResults : undefined
  }
}

/**
 * Legacy wrapper for backward compatibility - returns only the text content
 */
export async function sendToClaudeLegacy(
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  context?: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await sendToClaude(model, apiKey, messages, context, undefined, signal)
  return response.content
}

export async function sendToOpenAI(
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  context?: string,
  signal?: AbortSignal
): Promise<string> {
  const systemPrompt = context
    ? `${SYSTEM_PROMPT}\n\nContexto dos documentos:\n${context}`
    : SYSTEM_PROMPT

  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.filter((m) => m.role !== 'system'),
  ]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: openaiMessages,
      max_tokens: 4096,
    }),
    signal,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI error: ${error}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Sends a message to GPT-5 Mini using the Responses API
 *
 * @param model - GPT-5 model ID (e.g., 'gpt-5-mini')
 * @param apiKey - OpenAI API key
 * @param messages - Conversation messages
 * @param context - Optional document context
 * @param config - Optional configuration for reasoning, verbosity, and web search
 * @returns GPT5Response with content, usage, and optional reasoning/search results
 */
export async function sendToGPT5Mini(
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  context?: string,
  config?: GPT5RequestConfig,
  signal?: AbortSignal
): Promise<GPT5Response> {
  const systemPrompt = context
    ? `${SYSTEM_PROMPT}\n\nContexto dos documentos:\n${context}`
    : SYSTEM_PROMPT

  // Build input array - GPT-5 uses 'developer' role instead of 'system'
  const input = [
    { role: 'developer', content: systemPrompt },
    ...messages.filter((m) => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content
    }))
  ]

  // Build request body for Responses API
  const body: Record<string, unknown> = {
    model,
    input,
    max_output_tokens: config?.max_output_tokens || 4096,
  }

  // Add reasoning configuration
  // Always send reasoning.effort to override API default ('medium')
  if (config?.reasoning_effort) {
    body.reasoning = {
      effort: config.reasoning_effort
    }
  }

  // Add verbosity configuration
  if (config?.verbosity) {
    body.text = {
      verbosity: config.verbosity
    }
  }

  // Add Web Search tool if enabled
  if (config?.useWebSearch) {
    body.tools = [{ type: 'web_search' }]
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GPT-5 error: ${error}`)
  }

  const data = await response.json() as GPT5APIResponse

  // Extract content from response
  let textContent = ''
  let reasoningContent = ''
  const webSearchResults: WebSearchResult[] = []

  for (const item of data.output || []) {
    if (item.type === 'message' && item.content) {
      for (const block of item.content) {
        if (block.type === 'output_text' && block.text) {
          textContent += block.text
        }
      }
    } else if (item.type === 'reasoning' && item.summary) {
      for (const block of item.summary) {
        if (block.type === 'summary_text' && block.text) {
          reasoningContent += block.text
        }
      }
    } else if (item.type === 'web_search_call') {
      // Web search results would be in a subsequent message
      // For now, we note that search was performed
    }
  }

  // Build usage object
  const usage: GPT5Usage = {
    input_tokens: data.usage.input_tokens,
    output_tokens: data.usage.output_tokens,
    reasoning_tokens: data.usage.reasoning_tokens,
    cached_tokens: data.usage.cached_tokens
  }

  return {
    content: textContent,
    usage,
    reasoning_content: reasoningContent || undefined,
    web_search_results: webSearchResults.length > 0 ? webSearchResults : undefined
  }
}

/**
 * Sends a message to Google Gemini 3 Flash using the Generative Language API
 *
 * @param model - Gemini model ID (e.g., 'models/gemini-3-flash-preview')
 * @param apiKey - Google AI API key
 * @param messages - Conversation messages
 * @param context - Optional document context
 * @param config - Optional configuration for thinking level and web search
 * @returns GeminiResponse with content, usage, and optional thinking/search results
 */
export async function sendToGemini(
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  context?: string,
  config?: GeminiRequestConfig,
  signal?: AbortSignal
): Promise<GeminiResponse> {
  const systemPrompt = context
    ? `${SYSTEM_PROMPT}\n\nContexto dos documentos:\n${context}`
    : SYSTEM_PROMPT

  // Gemini uses 'user' and 'model' roles (not 'assistant')
  // System prompt is sent as first user message
  const contents = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }]
    },
    {
      role: 'model',
      parts: [{ text: 'Entendido. Estou pronto para auxiliar com questões jurídicas.' }]
    },
    ...messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  ]

  // Build request body
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: config?.max_output_tokens || 4096,
      thinkingConfig: {
        thinkingBudget: config?.thinking_level || 'high'
      }
    }
  }

  // Add Google Search grounding if enabled
  if (config?.useWebSearch) {
    body.tools = [{
      googleSearch: {}
    }]
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal,
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini error: ${error}`)
  }

  const data = await response.json() as GeminiAPIResponse

  // Extract content from response
  let textContent = ''
  let thinkingContent = ''

  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.thought) {
        thinkingContent += part.text || ''
      } else {
        textContent += part.text || ''
      }
    }
  }

  // Build usage object
  const usage: GeminiUsage = {
    input_tokens: data.usageMetadata?.promptTokenCount || 0,
    output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
    thinking_tokens: data.usageMetadata?.thoughtsTokenCount,
    cached_tokens: data.usageMetadata?.cachedContentTokenCount
  }

  return {
    content: textContent,
    usage,
    thinking_content: thinkingContent || undefined
  }
}

/**
 * Response from sendMessageAdvanced - unified across providers
 */
export interface AIResponse {
  content: string
  usage?: APIUsage
  gpt5_usage?: GPT5Usage
  gemini_usage?: GeminiUsage
  thinking_content?: string
  reasoning_content?: string  // GPT-5 reasoning summary
  web_search_results?: WebSearchResult[]
}

/**
 * Sends a message to the selected AI provider (legacy - returns string only)
 */
export async function sendMessage(
  provider: AIProvider,
  model: string,
  messages: { role: string; content: string }[],
  apiKey?: string,
  context?: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await sendMessageAdvanced(provider, model, messages, apiKey, context, undefined, undefined, undefined, signal)
  return response.content
}

/**
 * Sends a message to the selected AI provider with full response including usage stats
 *
 * @param provider - AI provider ('ollama', 'claude', 'openai', 'gemini')
 * @param model - Model ID
 * @param messages - Conversation messages
 * @param apiKey - API key (required for claude, openai, and gemini)
 * @param context - Optional document context
 * @param claudeConfig - Optional Claude-specific config for thinking/search/cache
 * @param gpt5Config - Optional GPT-5-specific config for reasoning/verbosity/search
 * @param geminiConfig - Optional Gemini-specific config for thinking level and web search
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Full response with content, usage, and optional thinking/search results
 */
export async function sendMessageAdvanced(
  provider: AIProvider,
  model: string,
  messages: { role: string; content: string }[],
  apiKey?: string,
  context?: string,
  claudeConfig?: ClaudeRequestConfig,
  gpt5Config?: GPT5RequestConfig,
  geminiConfig?: GeminiRequestConfig,
  signal?: AbortSignal
): Promise<AIResponse> {
  switch (provider) {
    case 'ollama': {
      const content = await sendToOllama(model, messages, context, signal)
      return { content }
    }
    case 'claude': {
      if (!apiKey) throw new Error('Claude API key is required')
      const response = await sendToClaude(model, apiKey, messages, context, claudeConfig, signal)
      return {
        content: response.content,
        usage: response.usage,
        thinking_content: response.thinking_content,
        web_search_results: response.web_search_results
      }
    }
    case 'openai': {
      if (!apiKey) throw new Error('OpenAI API key is required')

      // Check if using GPT-5 model (Responses API)
      if (model.startsWith('gpt-5')) {
        const response = await sendToGPT5Mini(model, apiKey, messages, context, gpt5Config, signal)
        return {
          content: response.content,
          gpt5_usage: response.usage,
          reasoning_content: response.reasoning_content,
          web_search_results: response.web_search_results
        }
      }

      // Legacy Chat Completions API for older models
      const content = await sendToOpenAI(model, apiKey, messages, context, signal)
      return { content }
    }
    case 'gemini': {
      if (!apiKey) throw new Error('Google AI API key is required')
      const response = await sendToGemini(model, apiKey, messages, context, geminiConfig, signal)
      return {
        content: response.content,
        gemini_usage: response.usage,
        thinking_content: response.thinking_content,
        web_search_results: response.web_search_results
      }
    }
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

export const RECOMMENDED_MODELS = {
  ollama: ['llama3.1', 'mistral', 'qwen2.5', 'codellama'],
  claude: ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514'],
  openai: ['gpt-5-mini'],
  gemini: ['models/gemini-3-pro-preview', 'models/gemini-3-flash-preview'],
}

/**
 * Resultado do teste de conexão com API
 * @interface APITestResult
 */
export interface APITestResult {
  /** true se a conexão foi bem-sucedida */
  success: boolean
  /** Mensagem de erro em caso de falha */
  error?: string
}

/**
 * Testa a conexão com uma API de IA
 *
 * - Ollama: Verifica se o servidor está rodando
 * - Claude: Faz uma requisição mínima para validar a API key
 * - OpenAI: Lista modelos para validar a API key
 * - Gemini: Lista modelos para validar a API key
 *
 * @param provider - Provider a testar ('ollama', 'claude', 'openai', 'gemini')
 * @param apiKey - API key (não necessária para Ollama)
 * @returns Objeto indicando sucesso ou erro
 * @example
 * const result = await testAPIConnection('claude', 'sk-ant-...')
 * if (!result.success) console.error(result.error)
 */
export async function testAPIConnection(
  provider: AIProvider,
  apiKey: string
): Promise<APITestResult> {
  try {
    switch (provider) {
      case 'ollama': {
        const running = await isOllamaRunning()
        return {
          success: running,
          error: running ? undefined : 'Ollama não está rodando',
        }
      }

      case 'claude': {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        })

        if (response.ok) {
          return { success: true }
        }

        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || response.statusText

        if (response.status === 401) {
          return { success: false, error: 'API key inválida' }
        }
        if (response.status === 400) {
          return { success: false, error: errorMessage }
        }

        return { success: false, error: `Erro: ${errorMessage}` }
      }

      case 'openai': {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })

        if (response.ok) {
          return { success: true }
        }

        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || response.statusText

        if (response.status === 401) {
          return { success: false, error: 'API key inválida' }
        }

        return { success: false, error: `Erro: ${errorMessage}` }
      }

      case 'gemini': {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { method: 'GET' }
        )

        if (response.ok) {
          return { success: true }
        }

        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || response.statusText

        if (response.status === 400 || response.status === 403) {
          return { success: false, error: 'API key inválida' }
        }

        return { success: false, error: `Erro: ${errorMessage}` }
      }

      default:
        return { success: false, error: 'Provider não suportado' }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão',
    }
  }
}
