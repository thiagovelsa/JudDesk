/**
 * Sistema de Tracking de Custos para Claude API
 *
 * Calcula custos baseado no uso de tokens e registra no banco de dados.
 * Preços atualizados para Claude Sonnet 4/4.5 (Dezembro 2024)
 */

import { getDatabase, executeInsert, executeQuery } from './db'

// Preços por 1M tokens (USD) - Claude Sonnet 4/4.5
export const CLAUDE_PRICING = {
  input: 3.00,          // $3.00 / 1M tokens input
  output: 15.00,        // $15.00 / 1M tokens output
  thinking: 15.00,      // $15.00 / 1M tokens thinking (igual output)
  cache_write: 3.75,    // $3.75 / 1M tokens cache write
  cache_read: 0.30      // $0.30 / 1M tokens cache read
}

// Preços por 1M tokens (USD) - GPT-5 Mini (Responses API)
export const GPT5_MINI_PRICING = {
  input: 0.25,          // $0.25 / 1M tokens input
  output: 2.00,         // $2.00 / 1M tokens output (inclui reasoning)
  cache: 0.025          // $0.025 / 1M tokens cached (90% desconto)
}

// Preços por 1M tokens (USD) - Google Gemini 3 Flash Preview
export const GEMINI_PRICING = {
  input: 0.50,          // $0.50 / 1M tokens input
  output: 3.00,         // $3.00 / 1M tokens output (inclui thinking)
  audio: 1.00           // $1.00 / 1M tokens audio input (para uso futuro)
}

export interface APIUsage {
  input_tokens: number
  output_tokens: number
  thinking_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export interface GPT5Usage {
  input_tokens: number
  output_tokens: number
  reasoning_tokens?: number
  cached_tokens?: number
}

export interface GeminiUsage {
  input_tokens: number
  output_tokens: number
  thinking_tokens?: number
  cached_tokens?: number
}

export interface UsageLog {
  id?: number
  session_id: number
  input_tokens: number
  output_tokens: number
  thinking_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost_usd: number
  created_at?: string
}

export interface CostSummary {
  total_cost_usd: number
  total_input_tokens: number
  total_output_tokens: number
  total_thinking_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
  message_count: number
}

/**
 * Calcula o custo em USD baseado no uso de tokens
 *
 * @param usage - Objeto com contagem de tokens
 * @returns Custo em USD
 *
 * @example
 * const cost = calculateCost({
 *   input_tokens: 1000,
 *   output_tokens: 500,
 *   thinking_tokens: 2000
 * })
 * // Returns: ~0.0375 USD
 */
export function calculateCost(usage: APIUsage): number {
  const inputCost = (usage.input_tokens / 1_000_000) * CLAUDE_PRICING.input
  const outputCost = (usage.output_tokens / 1_000_000) * CLAUDE_PRICING.output
  const thinkingCost = ((usage.thinking_tokens || 0) / 1_000_000) * CLAUDE_PRICING.thinking
  const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) / 1_000_000) * CLAUDE_PRICING.cache_write
  const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1_000_000) * CLAUDE_PRICING.cache_read

  return inputCost + outputCost + thinkingCost + cacheWriteCost + cacheReadCost
}

/**
 * Calcula o custo em USD para GPT-5 Mini (Responses API)
 *
 * @param usage - Objeto com contagem de tokens GPT-5
 * @returns Custo em USD
 *
 * @example
 * const cost = calculateCostGPT5({
 *   input_tokens: 1000,
 *   output_tokens: 500,
 *   reasoning_tokens: 2000,
 *   cached_tokens: 800
 * })
 * // Returns: ~0.001 USD
 */
export function calculateCostGPT5(usage: GPT5Usage): number {
  // Custo de input (tokens não-cached)
  const nonCachedInput = usage.input_tokens - (usage.cached_tokens || 0)
  const inputCost = (nonCachedInput / 1_000_000) * GPT5_MINI_PRICING.input

  // Output inclui reasoning tokens (mesmo preço)
  const totalOutput = usage.output_tokens + (usage.reasoning_tokens || 0)
  const outputCost = (totalOutput / 1_000_000) * GPT5_MINI_PRICING.output

  // Cache tem 90% de desconto (pagamos só 10% do preço de input)
  const cacheCost = ((usage.cached_tokens || 0) / 1_000_000) * GPT5_MINI_PRICING.cache

  return inputCost + outputCost + cacheCost
}

/**
 * Calcula o custo em USD para Google Gemini 3 Flash
 *
 * @param usage - Objeto com contagem de tokens Gemini
 * @returns Custo em USD
 *
 * @example
 * const cost = calculateCostGemini({
 *   input_tokens: 1000,
 *   output_tokens: 500,
 *   thinking_tokens: 2000,
 *   cached_tokens: 800
 * })
 * // Returns: ~0.0075 USD
 */
export function calculateCostGemini(usage: GeminiUsage): number {
  // Gemini não cobra por tokens cached (Context Caching é gratuito no preview)
  const inputCost = (usage.input_tokens / 1_000_000) * GEMINI_PRICING.input

  // Output inclui thinking tokens (mesmo preço)
  const totalOutput = usage.output_tokens + (usage.thinking_tokens || 0)
  const outputCost = (totalOutput / 1_000_000) * GEMINI_PRICING.output

  return inputCost + outputCost
}

/**
 * Formata custo em USD para exibição
 *
 * @param costUsd - Custo em USD
 * @returns String formatada (ex: "$0.0012" ou "< $0.0001")
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.0001) {
    return '< $0.0001'
  }
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(4)}`
  }
  if (costUsd < 1) {
    return `$${costUsd.toFixed(3)}`
  }
  return `$${costUsd.toFixed(2)}`
}

/**
 * Formata custo em BRL para exibição
 *
 * @param costUsd - Custo em USD
 * @param exchangeRate - Taxa de câmbio USD/BRL (default: 6.0)
 * @returns String formatada em BRL
 */
export function formatCostBRL(costUsd: number, exchangeRate: number = 6.0): string {
  const costBrl = costUsd * exchangeRate
  if (costBrl < 0.01) {
    return '< R$ 0,01'
  }
  return `R$ ${costBrl.toFixed(2).replace('.', ',')}`
}

/**
 * Registra o uso de tokens no banco de dados
 *
 * @param sessionId - ID da sessão de chat
 * @param usage - Objeto com contagem de tokens
 * @returns ID do registro criado
 */
export async function logUsage(sessionId: number, usage: APIUsage): Promise<number> {
  const cost = calculateCost(usage)

  const id = await executeInsert(
    `INSERT INTO ai_usage_logs (
      session_id, input_tokens, output_tokens, thinking_tokens,
      cache_read_tokens, cache_write_tokens, cost_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      usage.input_tokens,
      usage.output_tokens,
      usage.thinking_tokens || 0,
      usage.cache_read_input_tokens || 0,
      usage.cache_creation_input_tokens || 0,
      cost
    ]
  )

  return id
}

/**
 * Obtém custo total do dia atual
 *
 * @returns Custo total em USD
 */
export async function getDailyCost(): Promise<number> {
  const result = await executeQuery<{ total: number }>(
    `SELECT COALESCE(SUM(cost_usd), 0) as total
     FROM ai_usage_logs
     WHERE date(created_at) = date('now', 'localtime')`
  )
  return result[0]?.total || 0
}

/**
 * Obtém custo total do mês atual
 *
 * @returns Custo total em USD
 */
export async function getMonthlyCost(): Promise<number> {
  const result = await executeQuery<{ total: number }>(
    `SELECT COALESCE(SUM(cost_usd), 0) as total
     FROM ai_usage_logs
     WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')`
  )
  return result[0]?.total || 0
}

/**
 * Obtém resumo de custos do dia atual
 *
 * @returns Resumo completo com tokens e custo
 */
export async function getDailySummary(): Promise<CostSummary> {
  const result = await executeQuery<CostSummary>(
    `SELECT
      COALESCE(SUM(cost_usd), 0) as total_cost_usd,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(thinking_tokens), 0) as total_thinking_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens,
      COALESCE(SUM(cache_write_tokens), 0) as total_cache_write_tokens,
      COUNT(*) as message_count
     FROM ai_usage_logs
     WHERE date(created_at) = date('now', 'localtime')`
  )
  return result[0] || {
    total_cost_usd: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_thinking_tokens: 0,
    total_cache_read_tokens: 0,
    total_cache_write_tokens: 0,
    message_count: 0
  }
}

/**
 * Obtém resumo de custos do mês atual
 *
 * @returns Resumo completo com tokens e custo
 */
export async function getMonthlySummary(): Promise<CostSummary> {
  const result = await executeQuery<CostSummary>(
    `SELECT
      COALESCE(SUM(cost_usd), 0) as total_cost_usd,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(thinking_tokens), 0) as total_thinking_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens,
      COALESCE(SUM(cache_write_tokens), 0) as total_cache_write_tokens,
      COUNT(*) as message_count
     FROM ai_usage_logs
     WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')`
  )
  return result[0] || {
    total_cost_usd: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_thinking_tokens: 0,
    total_cache_read_tokens: 0,
    total_cache_write_tokens: 0,
    message_count: 0
  }
}

/**
 * Obtém custo por sessão
 *
 * @param sessionId - ID da sessão
 * @returns Custo total da sessão em USD
 */
export async function getSessionCost(sessionId: number): Promise<number> {
  const result = await executeQuery<{ total: number }>(
    `SELECT COALESCE(SUM(cost_usd), 0) as total
     FROM ai_usage_logs
     WHERE session_id = ?`,
    [sessionId]
  )
  return result[0]?.total || 0
}

/**
 * Verifica se o limite diário foi atingido
 *
 * @param limitUsd - Limite em USD
 * @returns true se o limite foi atingido
 */
export async function isDailyLimitReached(limitUsd: number): Promise<boolean> {
  if (limitUsd <= 0) return false
  const dailyCost = await getDailyCost()
  return dailyCost >= limitUsd
}

/**
 * Obtém percentual do limite diário usado
 *
 * @param limitUsd - Limite em USD
 * @returns Percentual de 0 a 100 (ou mais se ultrapassou)
 */
export async function getDailyLimitPercentage(limitUsd: number): Promise<number> {
  if (limitUsd <= 0) return 0
  const dailyCost = await getDailyCost()
  return (dailyCost / limitUsd) * 100
}

/**
 * Limpa registros antigos (mais de N dias)
 *
 * @param daysToKeep - Número de dias para manter (default: 90)
 * @returns Número de registros removidos
 */
export async function cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
  const db = await getDatabase()
  const result = await db.execute(
    `DELETE FROM ai_usage_logs
     WHERE created_at < datetime('now', '-' || ? || ' days')`,
    [daysToKeep]
  )
  return result.rowsAffected
}
