/**
 * Classificador de Intenção para Chat com Claude
 *
 * Detecta automaticamente o tipo de solicitação do usuário e configura
 * os parâmetros ideais para Extended Thinking e Web Search.
 */

export type IntentProfile = 'simples' | 'pesquisa' | 'analise' | 'peca'

export interface ThinkingConfig {
  enabled: boolean
  budget_tokens: number
}

export interface IntentConfig {
  profile: IntentProfile
  thinking: ThinkingConfig
  useWebSearch: boolean
  max_tokens: number
}

// Keywords para cada perfil
const KEYWORDS = {
  peca: [
    'elabore', 'redija', 'escreva', 'faça', 'crie', 'monte', 'prepare',
    'petição', 'peticao', 'recurso', 'contestação', 'contestacao',
    'apelação', 'apelacao', 'agravo', 'embargo', 'mandado', 'inicial',
    'contrarrazões', 'contrarrazoes', 'réplica', 'replica', 'defesa',
    'parecer', 'minuta', 'contrato', 'procuração', 'procuracao',
    'notificação', 'notificacao', 'interpelação', 'interpelacao'
  ],
  analise: [
    'analise', 'avalie', 'examine', 'verifique', 'revise', 'compare',
    'estratégia', 'estrategia', 'viabilidade', 'probabilidade', 'chances',
    'riscos', 'prós e contras', 'pros e contras', 'fundamentação',
    'fundamentacao', 'argumentação', 'argumentacao', 'tese', 'antítese',
    'melhor abordagem', 'como proceder', 'qual caminho', 'recomendação',
    'recomendacao', 'opinião', 'opiniao', 'entendimento'
  ],
  pesquisa: [
    'busque', 'pesquise', 'encontre', 'procure', 'localize',
    'jurisprudência', 'jurisprudencia', 'decisões', 'decisoes', 'julgados',
    'súmula', 'sumula', 'precedente', 'entendimento', 'posição',
    'posicao', 'tribunal', 'stf', 'stj', 'trf', 'tjsp', 'tjrj',
    'recente', 'atual', 'atualizado', '2024', '2025', 'última',
    'ultima', 'novo', 'nova', 'mudança', 'mudanca', 'alteração', 'alteracao'
  ]
}

// Configurações por perfil (Claude)
const PROFILE_CONFIGS: Record<IntentProfile, Omit<IntentConfig, 'profile'>> = {
  simples: {
    thinking: { enabled: false, budget_tokens: 0 },
    useWebSearch: false,
    max_tokens: 4096
  },
  pesquisa: {
    thinking: { enabled: false, budget_tokens: 0 },
    useWebSearch: true,
    max_tokens: 8192
  },
  analise: {
    thinking: { enabled: true, budget_tokens: 10000 },
    useWebSearch: false,
    max_tokens: 8192
  },
  peca: {
    thinking: { enabled: true, budget_tokens: 16000 },
    useWebSearch: false,
    max_tokens: 16384
  }
}

// Configurações por perfil (GPT-5 Mini)
// Valores válidos da OpenAI Responses API: 'none' | 'low' | 'medium' | 'high'
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high'
export type Verbosity = 'low' | 'medium' | 'high'

export interface GPT5IntentConfig {
  profile: IntentProfile
  reasoning_effort: ReasoningEffort
  verbosity: Verbosity
  max_output_tokens: number
  useWebSearch: boolean
}

const GPT5_PROFILE_CONFIGS: Record<IntentProfile, Omit<GPT5IntentConfig, 'profile'>> = {
  simples: {
    reasoning_effort: 'none',
    verbosity: 'low',
    max_output_tokens: 2048,
    useWebSearch: false
  },
  pesquisa: {
    reasoning_effort: 'low',
    verbosity: 'medium',
    max_output_tokens: 4096,
    useWebSearch: true
  },
  analise: {
    reasoning_effort: 'medium',
    verbosity: 'medium',
    max_output_tokens: 4096,
    useWebSearch: false
  },
  peca: {
    reasoning_effort: 'high',
    verbosity: 'high',
    max_output_tokens: 8192,
    useWebSearch: false
  }
}

// Configurações por perfil (Google Gemini 3 Flash)
// Thinking levels válidos: 'minimal' | 'low' | 'high' (default)
export type GeminiThinkingLevel = 'minimal' | 'low' | 'high'

export interface GeminiIntentConfig {
  profile: IntentProfile
  thinking_level: GeminiThinkingLevel
  max_output_tokens: number
  useWebSearch: boolean  // Google Search grounding
}

const GEMINI_PROFILE_CONFIGS: Record<IntentProfile, Omit<GeminiIntentConfig, 'profile'>> = {
  simples: {
    thinking_level: 'minimal',
    max_output_tokens: 2048,
    useWebSearch: false
  },
  pesquisa: {
    thinking_level: 'low',
    max_output_tokens: 4096,
    useWebSearch: true  // Google Search grounding
  },
  analise: {
    thinking_level: 'high',
    max_output_tokens: 4096,
    useWebSearch: false
  },
  peca: {
    thinking_level: 'high',
    max_output_tokens: 8192,
    useWebSearch: false
  }
}

/**
 * Normaliza texto para comparação (remove acentos e converte para minúsculas)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Conta quantas keywords de cada perfil aparecem no texto
 */
function countKeywords(text: string): Record<IntentProfile, number> {
  const normalizedText = normalizeText(text)

  return {
    simples: 0,
    peca: KEYWORDS.peca.filter(k => normalizedText.includes(normalizeText(k))).length,
    analise: KEYWORDS.analise.filter(k => normalizedText.includes(normalizeText(k))).length,
    pesquisa: KEYWORDS.pesquisa.filter(k => normalizedText.includes(normalizeText(k))).length
  }
}

/**
 * Classifica a intenção do usuário baseado no texto da mensagem
 *
 * @param message - Mensagem do usuário
 * @returns Configuração de intenção com thinking, web search e max_tokens
 *
 * @example
 * const config = classifyIntent("Elabore uma petição inicial de danos morais")
 * // Returns: { profile: 'peca', thinking: { enabled: true, budget_tokens: 16000 }, ... }
 */
export function classifyIntent(message: string): IntentConfig {
  if (!message || message.trim().length === 0) {
    return { profile: 'simples', ...PROFILE_CONFIGS.simples }
  }

  const counts = countKeywords(message)

  // Determina o perfil com mais keywords
  let maxProfile: IntentProfile = 'simples'
  let maxCount = 0

  for (const [profile, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      maxProfile = profile as IntentProfile
    }
  }

  // Se não encontrou keywords específicas, classifica como simples
  if (maxCount === 0) {
    return { profile: 'simples', ...PROFILE_CONFIGS.simples }
  }

  return {
    profile: maxProfile,
    ...PROFILE_CONFIGS[maxProfile]
  }
}

/**
 * Classifica a intenção do usuário para GPT-5 Mini (Responses API)
 *
 * @param message - Mensagem do usuário
 * @returns Configuração de intenção com reasoning_effort, verbosity e max_output_tokens
 *
 * @example
 * const config = classifyIntentGPT5("Elabore uma petição inicial de danos morais")
 * // Returns: { profile: 'peca', reasoning_effort: 'high', verbosity: 'high', ... }
 */
export function classifyIntentGPT5(message: string): GPT5IntentConfig {
  if (!message || message.trim().length === 0) {
    return { profile: 'simples', ...GPT5_PROFILE_CONFIGS.simples }
  }

  const counts = countKeywords(message)

  // Determina o perfil com mais keywords
  let maxProfile: IntentProfile = 'simples'
  let maxCount = 0

  for (const [profile, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      maxProfile = profile as IntentProfile
    }
  }

  // Se não encontrou keywords específicas, classifica como simples
  if (maxCount === 0) {
    return { profile: 'simples', ...GPT5_PROFILE_CONFIGS.simples }
  }

  return {
    profile: maxProfile,
    ...GPT5_PROFILE_CONFIGS[maxProfile]
  }
}

/**
 * Classifica a intenção do usuário para Google Gemini 3 Flash
 *
 * @param message - Mensagem do usuário
 * @returns Configuração de intenção com thinking_level e max_output_tokens
 *
 * @example
 * const config = classifyIntentGemini("Elabore uma petição inicial de danos morais")
 * // Returns: { profile: 'peca', thinking_level: 'high', max_output_tokens: 8192, ... }
 */
export function classifyIntentGemini(message: string): GeminiIntentConfig {
  if (!message || message.trim().length === 0) {
    return { profile: 'simples', ...GEMINI_PROFILE_CONFIGS.simples }
  }

  const counts = countKeywords(message)

  // Determina o perfil com mais keywords
  let maxProfile: IntentProfile = 'simples'
  let maxCount = 0

  for (const [profile, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      maxProfile = profile as IntentProfile
    }
  }

  // Se não encontrou keywords específicas, classifica como simples
  if (maxCount === 0) {
    return { profile: 'simples', ...GEMINI_PROFILE_CONFIGS.simples }
  }

  return {
    profile: maxProfile,
    ...GEMINI_PROFILE_CONFIGS[maxProfile]
  }
}

/**
 * Verifica se a mensagem requer reasoning para GPT-5
 */
export function requiresReasoningGPT5(message: string): boolean {
  const config = classifyIntentGPT5(message)
  return config.reasoning_effort !== 'none'
}

/**
 * Verifica se a mensagem requer thinking para Gemini
 */
export function requiresThinkingGemini(message: string): boolean {
  const config = classifyIntentGemini(message)
  return config.thinking_level !== 'minimal'
}

/**
 * Verifica se a mensagem requer Extended Thinking
 */
export function requiresThinking(message: string): boolean {
  const config = classifyIntent(message)
  return config.thinking.enabled
}

/**
 * Verifica se a mensagem pode se beneficiar de Web Search
 */
export function requiresWebSearch(message: string): boolean {
  const config = classifyIntent(message)
  return config.useWebSearch
}

/**
 * Retorna descrição amigável do perfil
 */
export function getProfileDescription(profile: IntentProfile): string {
  switch (profile) {
    case 'simples':
      return 'Dúvida simples'
    case 'pesquisa':
      return 'Pesquisa jurídica'
    case 'analise':
      return 'Análise estratégica'
    case 'peca':
      return 'Elaboração de peça'
    default:
      return 'Consulta'
  }
}

/**
 * Retorna ícone sugerido para o perfil (nome do Lucide icon)
 */
export function getProfileIcon(profile: IntentProfile): string {
  switch (profile) {
    case 'simples':
      return 'MessageCircle'
    case 'pesquisa':
      return 'Search'
    case 'analise':
      return 'Brain'
    case 'peca':
      return 'FileText'
    default:
      return 'MessageCircle'
  }
}
