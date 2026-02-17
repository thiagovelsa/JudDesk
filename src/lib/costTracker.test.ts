import { describe, it, expect, vi } from 'vitest'
import {
  calculateCost,
  calculateCostGPT5,
  calculateCostGemini,
  formatCost,
  formatCostBRL,
  CLAUDE_PRICING,
  GPT5_MINI_PRICING,
  GEMINI_PRICING,
  type APIUsage,
  type GPT5Usage,
  type GeminiUsage
} from './costTracker'

// Mock do módulo db para testes das funções de banco
vi.mock('./db', () => ({
  getDatabase: vi.fn(),
  executeInsert: vi.fn().mockResolvedValue(1),
  executeQuery: vi.fn().mockResolvedValue([{ total: 0 }])
}))

describe('costTracker', () => {
  describe('CLAUDE_PRICING', () => {
    it('should have correct pricing values', () => {
      expect(CLAUDE_PRICING.input).toBe(3.00)
      expect(CLAUDE_PRICING.output).toBe(15.00)
      expect(CLAUDE_PRICING.thinking).toBe(15.00)
      expect(CLAUDE_PRICING.cache_write).toBe(3.75)
      expect(CLAUDE_PRICING.cache_read).toBe(0.30)
    })
  })

  describe('calculateCost', () => {
    it('should calculate cost for input tokens only', () => {
      const usage: APIUsage = {
        input_tokens: 1_000_000,
        output_tokens: 0
      }
      const cost = calculateCost(usage)
      expect(cost).toBe(3.00) // $3.00 per 1M input tokens
    })

    it('should calculate cost for output tokens only', () => {
      const usage: APIUsage = {
        input_tokens: 0,
        output_tokens: 1_000_000
      }
      const cost = calculateCost(usage)
      expect(cost).toBe(15.00) // $15.00 per 1M output tokens
    })

    it('should calculate cost for thinking tokens', () => {
      const usage: APIUsage = {
        input_tokens: 0,
        output_tokens: 0,
        thinking_tokens: 1_000_000
      }
      const cost = calculateCost(usage)
      expect(cost).toBe(15.00) // $15.00 per 1M thinking tokens
    })

    it('should calculate cost for cache write tokens', () => {
      const usage: APIUsage = {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 1_000_000
      }
      const cost = calculateCost(usage)
      expect(cost).toBe(3.75) // $3.75 per 1M cache write tokens
    })

    it('should calculate cost for cache read tokens', () => {
      const usage: APIUsage = {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 1_000_000
      }
      const cost = calculateCost(usage)
      expect(cost).toBe(0.30) // $0.30 per 1M cache read tokens
    })

    it('should calculate combined cost correctly', () => {
      const usage: APIUsage = {
        input_tokens: 1000,     // $0.003
        output_tokens: 500,     // $0.0075
        thinking_tokens: 2000,  // $0.03
        cache_creation_input_tokens: 100, // $0.000375
        cache_read_input_tokens: 5000     // $0.0015
      }
      const cost = calculateCost(usage)
      // Total: 0.003 + 0.0075 + 0.03 + 0.000375 + 0.0015 = 0.042375
      expect(cost).toBeCloseTo(0.042375, 6)
    })

    it('should handle zero tokens', () => {
      const usage: APIUsage = {
        input_tokens: 0,
        output_tokens: 0
      }
      const cost = calculateCost(usage)
      expect(cost).toBe(0)
    })

    it('should handle undefined optional tokens', () => {
      const usage: APIUsage = {
        input_tokens: 1000,
        output_tokens: 500
      }
      // Should not throw and should only count defined tokens
      const cost = calculateCost(usage)
      expect(cost).toBeGreaterThan(0)
    })

    it('should calculate realistic usage scenario', () => {
      // Typical usage: 2000 input, 1000 output, 5000 thinking
      const usage: APIUsage = {
        input_tokens: 2000,
        output_tokens: 1000,
        thinking_tokens: 5000
      }
      const cost = calculateCost(usage)
      // (2000/1M * 3) + (1000/1M * 15) + (5000/1M * 15)
      // = 0.006 + 0.015 + 0.075 = 0.096
      expect(cost).toBeCloseTo(0.096, 6)
    })
  })

  describe('formatCost', () => {
    it('should format very small costs', () => {
      expect(formatCost(0.00001)).toBe('< $0.0001')
      expect(formatCost(0.00005)).toBe('< $0.0001')
    })

    it('should format small costs with 4 decimals', () => {
      expect(formatCost(0.0001)).toBe('$0.0001')
      expect(formatCost(0.0012)).toBe('$0.0012')
      expect(formatCost(0.0099)).toBe('$0.0099')
    })

    it('should format medium costs with 3 decimals', () => {
      expect(formatCost(0.01)).toBe('$0.010')
      expect(formatCost(0.123)).toBe('$0.123')
      expect(formatCost(0.999)).toBe('$0.999')
    })

    it('should format large costs with 2 decimals', () => {
      expect(formatCost(1.00)).toBe('$1.00')
      expect(formatCost(1.234)).toBe('$1.23')
      expect(formatCost(10.50)).toBe('$10.50')
      expect(formatCost(100.99)).toBe('$100.99')
    })

    it('should format zero cost', () => {
      expect(formatCost(0)).toBe('< $0.0001')
    })
  })

  describe('formatCostBRL', () => {
    it('should convert USD to BRL with default rate', () => {
      // Default rate is 6.0
      expect(formatCostBRL(1.00)).toBe('R$ 6,00')
      expect(formatCostBRL(0.50)).toBe('R$ 3,00')
    })

    it('should use custom exchange rate', () => {
      expect(formatCostBRL(1.00, 5.50)).toBe('R$ 5,50')
      expect(formatCostBRL(2.00, 5.00)).toBe('R$ 10,00')
    })

    it('should format very small BRL values', () => {
      expect(formatCostBRL(0.001)).toBe('< R$ 0,01')
      expect(formatCostBRL(0.0001)).toBe('< R$ 0,01')
    })

    it('should format medium BRL values', () => {
      expect(formatCostBRL(0.10)).toBe('R$ 0,60')
      expect(formatCostBRL(0.05)).toBe('R$ 0,30')
    })

    it('should use comma as decimal separator', () => {
      const result = formatCostBRL(1.50)
      expect(result).toContain(',')
      expect(result).toBe('R$ 9,00')
    })
  })

  describe('cost estimation scenarios', () => {
    it('should estimate cost for simple question', () => {
      // Simple question: ~500 input, ~200 output
      const usage: APIUsage = {
        input_tokens: 500,
        output_tokens: 200
      }
      const cost = calculateCost(usage)
      // Should be very cheap
      expect(cost).toBeLessThan(0.01)
      expect(formatCost(cost)).toMatch(/^\$0\.00/)
    })

    it('should estimate cost for document analysis with thinking', () => {
      // Analysis: ~3000 input (context), ~1000 output, ~8000 thinking
      const usage: APIUsage = {
        input_tokens: 3000,
        output_tokens: 1000,
        thinking_tokens: 8000
      }
      const cost = calculateCost(usage)
      // (3000/1M * 3) + (1000/1M * 15) + (8000/1M * 15)
      // = 0.009 + 0.015 + 0.12 = 0.144
      expect(cost).toBeCloseTo(0.144, 3)
    })

    it('should estimate cost for petition generation', () => {
      // Petition: ~5000 input, ~3000 output, ~15000 thinking
      const usage: APIUsage = {
        input_tokens: 5000,
        output_tokens: 3000,
        thinking_tokens: 15000
      }
      const cost = calculateCost(usage)
      // (5000/1M * 3) + (3000/1M * 15) + (15000/1M * 15)
      // = 0.015 + 0.045 + 0.225 = 0.285
      expect(cost).toBeCloseTo(0.285, 3)
    })

    it('should show cache savings', () => {
      // Without cache
      const withoutCache: APIUsage = {
        input_tokens: 10000,
        output_tokens: 1000
      }
      const costWithoutCache = calculateCost(withoutCache)

      // With cache (90% hit rate)
      const withCache: APIUsage = {
        input_tokens: 1000,
        output_tokens: 1000,
        cache_read_input_tokens: 9000
      }
      const costWithCache = calculateCost(withCache)

      // Cache should be significantly cheaper
      expect(costWithCache).toBeLessThan(costWithoutCache)

      // Calculate savings percentage
      const savings = ((costWithoutCache - costWithCache) / costWithoutCache) * 100
      expect(savings).toBeGreaterThan(50) // At least 50% savings
    })
  })

  // =========================================
  // GPT-5 Mini Pricing Tests
  // =========================================

  describe('GPT5_MINI_PRICING', () => {
    it('should have correct pricing values', () => {
      expect(GPT5_MINI_PRICING.input).toBe(0.25)
      expect(GPT5_MINI_PRICING.output).toBe(2.00)
      expect(GPT5_MINI_PRICING.cache).toBe(0.025)
    })

    it('should be significantly cheaper than Claude', () => {
      // GPT-5 Mini input is 12x cheaper than Claude
      expect(CLAUDE_PRICING.input / GPT5_MINI_PRICING.input).toBe(12)
      // GPT-5 Mini output is 7.5x cheaper than Claude
      expect(CLAUDE_PRICING.output / GPT5_MINI_PRICING.output).toBe(7.5)
    })
  })

  describe('calculateCostGPT5', () => {
    it('should calculate cost for input tokens only', () => {
      const usage: GPT5Usage = {
        input_tokens: 1_000_000,
        output_tokens: 0
      }
      const cost = calculateCostGPT5(usage)
      expect(cost).toBe(0.25) // $0.25 per 1M input tokens
    })

    it('should calculate cost for output tokens only', () => {
      const usage: GPT5Usage = {
        input_tokens: 0,
        output_tokens: 1_000_000
      }
      const cost = calculateCostGPT5(usage)
      expect(cost).toBe(2.00) // $2.00 per 1M output tokens
    })

    it('should include reasoning tokens in output cost', () => {
      const usage: GPT5Usage = {
        input_tokens: 0,
        output_tokens: 500_000,
        reasoning_tokens: 500_000
      }
      const cost = calculateCostGPT5(usage)
      // Total output = 500K + 500K = 1M tokens
      expect(cost).toBe(2.00) // $2.00 per 1M output tokens
    })

    it('should apply cache discount', () => {
      const usage: GPT5Usage = {
        input_tokens: 1_000_000,
        output_tokens: 0,
        cached_tokens: 900_000
      }
      const cost = calculateCostGPT5(usage)
      // Non-cached: 100K at $0.25/MTok = $0.025
      // Cached: 900K at $0.025/MTok = $0.0225
      // Total: $0.0475
      expect(cost).toBeCloseTo(0.0475, 4)
    })

    it('should handle zero tokens', () => {
      const usage: GPT5Usage = {
        input_tokens: 0,
        output_tokens: 0
      }
      const cost = calculateCostGPT5(usage)
      expect(cost).toBe(0)
    })

    it('should calculate combined cost correctly', () => {
      const usage: GPT5Usage = {
        input_tokens: 2000,      // non-cached: 1000 at $0.00025
        output_tokens: 500,      // $0.001
        reasoning_tokens: 1500,  // $0.003
        cached_tokens: 1000      // $0.000025
      }
      const cost = calculateCostGPT5(usage)
      // Non-cached input: (2000-1000)/1M * 0.25 = 0.00025
      // Output + reasoning: (500+1500)/1M * 2.00 = 0.004
      // Cache: 1000/1M * 0.025 = 0.000025
      // Total: 0.004275
      expect(cost).toBeCloseTo(0.004275, 6)
    })

    it('should calculate realistic usage scenario', () => {
      // Typical usage: 3000 input, 1000 output, 2000 reasoning
      const usage: GPT5Usage = {
        input_tokens: 3000,
        output_tokens: 1000,
        reasoning_tokens: 2000
      }
      const cost = calculateCostGPT5(usage)
      // (3000/1M * 0.25) + ((1000+2000)/1M * 2.00)
      // = 0.00075 + 0.006 = 0.00675
      expect(cost).toBeCloseTo(0.00675, 5)
    })
  })

  describe('GPT-5 cost estimation scenarios', () => {
    it('should estimate cost for simple question', () => {
      // Simple question: ~500 input, ~200 output
      const usage: GPT5Usage = {
        input_tokens: 500,
        output_tokens: 200
      }
      const cost = calculateCostGPT5(usage)
      // Should be very cheap
      expect(cost).toBeLessThan(0.001)
    })

    it('should estimate cost for document analysis with reasoning', () => {
      // Analysis: ~3000 input, ~1000 output, ~4000 reasoning
      const usage: GPT5Usage = {
        input_tokens: 3000,
        output_tokens: 1000,
        reasoning_tokens: 4000
      }
      const cost = calculateCostGPT5(usage)
      // (3000/1M * 0.25) + ((1000+4000)/1M * 2.00)
      // = 0.00075 + 0.01 = 0.01075
      expect(cost).toBeCloseTo(0.01075, 5)
    })

    it('should estimate cost for petition generation', () => {
      // Petition: ~5000 input, ~3000 output, ~6000 reasoning
      const usage: GPT5Usage = {
        input_tokens: 5000,
        output_tokens: 3000,
        reasoning_tokens: 6000
      }
      const cost = calculateCostGPT5(usage)
      // (5000/1M * 0.25) + ((3000+6000)/1M * 2.00)
      // = 0.00125 + 0.018 = 0.01925
      expect(cost).toBeCloseTo(0.01925, 5)
    })

    it('should show GPT-5 is cheaper than Claude for same usage', () => {
      // Same token counts for both
      const inputTokens = 3000
      const outputTokens = 1000

      const claudeUsage: APIUsage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        thinking_tokens: 5000
      }

      const gpt5Usage: GPT5Usage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        reasoning_tokens: 5000
      }

      const claudeCost = calculateCost(claudeUsage)
      const gpt5Cost = calculateCostGPT5(gpt5Usage)

      // GPT-5 should be significantly cheaper
      expect(gpt5Cost).toBeLessThan(claudeCost)

      // Calculate savings percentage
      const savings = ((claudeCost - gpt5Cost) / claudeCost) * 100
      expect(savings).toBeGreaterThan(70) // At least 70% savings
    })

    it('should show GPT-5 cache savings', () => {
      // Without cache
      const withoutCache: GPT5Usage = {
        input_tokens: 10000,
        output_tokens: 1000
      }
      const costWithoutCache = calculateCostGPT5(withoutCache)

      // With cache (90% hit rate)
      const withCache: GPT5Usage = {
        input_tokens: 10000,
        output_tokens: 1000,
        cached_tokens: 9000
      }
      const costWithCache = calculateCostGPT5(withCache)

      // Cache should be cheaper
      expect(costWithCache).toBeLessThan(costWithoutCache)

      // Calculate savings percentage on input
      // Without: 10000 * 0.25/1M = 0.0025
      // With: 1000 * 0.25/1M + 9000 * 0.025/1M = 0.00025 + 0.000225 = 0.000475
      // Savings: ~81%
      const inputSavings = (costWithoutCache - costWithCache) / (10000 / 1_000_000 * GPT5_MINI_PRICING.input) * 100
      expect(inputSavings).toBeGreaterThan(75)
    })
  })

  // =========================================
  // Google Gemini 3 Flash Pricing Tests
  // =========================================

  describe('GEMINI_PRICING', () => {
    it('should have correct pricing values', () => {
      expect(GEMINI_PRICING.input).toBe(0.50)
      expect(GEMINI_PRICING.output).toBe(3.00)
      expect(GEMINI_PRICING.audio).toBe(1.00)
    })

    it('should be cheaper than Claude', () => {
      // Gemini input is 6x cheaper than Claude
      expect(CLAUDE_PRICING.input / GEMINI_PRICING.input).toBe(6)
      // Gemini output is 5x cheaper than Claude
      expect(CLAUDE_PRICING.output / GEMINI_PRICING.output).toBe(5)
    })

    it('should be more expensive than GPT-5 Mini for input', () => {
      // Gemini input is 2x more expensive than GPT-5 Mini
      expect(GEMINI_PRICING.input / GPT5_MINI_PRICING.input).toBe(2)
    })
  })

  describe('calculateCostGemini', () => {
    it('should calculate cost for input tokens only', () => {
      const usage: GeminiUsage = {
        input_tokens: 1_000_000,
        output_tokens: 0
      }
      const cost = calculateCostGemini(usage)
      expect(cost).toBe(0.50) // $0.50 per 1M input tokens
    })

    it('should calculate cost for output tokens only', () => {
      const usage: GeminiUsage = {
        input_tokens: 0,
        output_tokens: 1_000_000
      }
      const cost = calculateCostGemini(usage)
      expect(cost).toBe(3.00) // $3.00 per 1M output tokens
    })

    it('should calculate cost for thinking tokens', () => {
      const usage: GeminiUsage = {
        input_tokens: 0,
        output_tokens: 0,
        thinking_tokens: 1_000_000
      }
      const cost = calculateCostGemini(usage)
      expect(cost).toBe(3.00) // $3.00 per 1M thinking tokens (same as output)
    })

    it('should handle cached tokens (no cost)', () => {
      const usage: GeminiUsage = {
        input_tokens: 1_000_000,
        output_tokens: 500_000,
        cached_tokens: 500_000
      }
      const cost = calculateCostGemini(usage)
      // Cached tokens don't add to cost (context caching is separate)
      // Input: $0.50 + Output: $1.50 = $2.00
      expect(cost).toBe(2.00)
    })

    it('should handle zero tokens', () => {
      const usage: GeminiUsage = {
        input_tokens: 0,
        output_tokens: 0
      }
      const cost = calculateCostGemini(usage)
      expect(cost).toBe(0)
    })

    it('should calculate combined cost correctly', () => {
      const usage: GeminiUsage = {
        input_tokens: 2000,       // $0.001
        output_tokens: 500,       // $0.0015
        thinking_tokens: 3000     // $0.009
      }
      const cost = calculateCostGemini(usage)
      // (2000/1M * 0.50) + (500/1M * 3.00) + (3000/1M * 3.00)
      // = 0.001 + 0.0015 + 0.009 = 0.0115
      expect(cost).toBeCloseTo(0.0115, 6)
    })

    it('should calculate realistic usage scenario', () => {
      // Typical usage: 3000 input, 1000 output, 5000 thinking
      const usage: GeminiUsage = {
        input_tokens: 3000,
        output_tokens: 1000,
        thinking_tokens: 5000
      }
      const cost = calculateCostGemini(usage)
      // (3000/1M * 0.50) + (1000/1M * 3.00) + (5000/1M * 3.00)
      // = 0.0015 + 0.003 + 0.015 = 0.0195
      expect(cost).toBeCloseTo(0.0195, 6)
    })
  })

  describe('Gemini cost estimation scenarios', () => {
    it('should estimate cost for simple question', () => {
      // Simple question: ~500 input, ~200 output
      const usage: GeminiUsage = {
        input_tokens: 500,
        output_tokens: 200
      }
      const cost = calculateCostGemini(usage)
      // Should be very cheap
      expect(cost).toBeLessThan(0.001)
    })

    it('should estimate cost for document analysis with thinking', () => {
      // Analysis: ~3000 input, ~1000 output, ~5000 thinking
      const usage: GeminiUsage = {
        input_tokens: 3000,
        output_tokens: 1000,
        thinking_tokens: 5000
      }
      const cost = calculateCostGemini(usage)
      // (3000/1M * 0.50) + (1000/1M * 3.00) + (5000/1M * 3.00)
      // = 0.0015 + 0.003 + 0.015 = 0.0195
      expect(cost).toBeCloseTo(0.0195, 4)
    })

    it('should estimate cost for petition generation', () => {
      // Petition: ~5000 input, ~3000 output, ~8000 thinking
      const usage: GeminiUsage = {
        input_tokens: 5000,
        output_tokens: 3000,
        thinking_tokens: 8000
      }
      const cost = calculateCostGemini(usage)
      // (5000/1M * 0.50) + (3000/1M * 3.00) + (8000/1M * 3.00)
      // = 0.0025 + 0.009 + 0.024 = 0.0355
      expect(cost).toBeCloseTo(0.0355, 4)
    })

    it('should show Gemini is cheaper than Claude for same usage', () => {
      // Same token counts for both
      const inputTokens = 3000
      const outputTokens = 1000
      const thinkingTokens = 5000

      const claudeUsage: APIUsage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        thinking_tokens: thinkingTokens
      }

      const geminiUsage: GeminiUsage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        thinking_tokens: thinkingTokens
      }

      const claudeCost = calculateCost(claudeUsage)
      const geminiCost = calculateCostGemini(geminiUsage)

      // Gemini should be significantly cheaper
      expect(geminiCost).toBeLessThan(claudeCost)

      // Calculate savings percentage
      const savings = ((claudeCost - geminiCost) / claudeCost) * 100
      expect(savings).toBeGreaterThan(70) // At least 70% savings
    })

    it('should show Gemini is more expensive than GPT-5 for reasoning tasks', () => {
      // Same token counts for both
      const inputTokens = 3000
      const outputTokens = 1000
      const reasoningTokens = 5000

      const gpt5Usage: GPT5Usage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        reasoning_tokens: reasoningTokens
      }

      const geminiUsage: GeminiUsage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        thinking_tokens: reasoningTokens
      }

      const gpt5Cost = calculateCostGPT5(gpt5Usage)
      const geminiCost = calculateCostGemini(geminiUsage)

      // Gemini is slightly more expensive than GPT-5 Mini
      expect(geminiCost).toBeGreaterThan(gpt5Cost)
    })

    it('should compare all three providers for petition task', () => {
      // Petition generation: 5000 input, 3000 output, 10000 thinking/reasoning
      const inputTokens = 5000
      const outputTokens = 3000
      const thinkingTokens = 10000

      const claudeUsage: APIUsage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        thinking_tokens: thinkingTokens
      }

      const gpt5Usage: GPT5Usage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        reasoning_tokens: thinkingTokens
      }

      const geminiUsage: GeminiUsage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        thinking_tokens: thinkingTokens
      }

      const claudeCost = calculateCost(claudeUsage)
      const gpt5Cost = calculateCostGPT5(gpt5Usage)
      const geminiCost = calculateCostGemini(geminiUsage)

      // Order should be: GPT-5 < Gemini < Claude
      expect(gpt5Cost).toBeLessThan(geminiCost)
      expect(geminiCost).toBeLessThan(claudeCost)

      // Log relative costs for reference
      // Claude: (5000/1M * 3) + (3000/1M * 15) + (10000/1M * 15) = 0.015 + 0.045 + 0.15 = 0.21
      // Gemini: (5000/1M * 0.5) + (3000/1M * 3) + (10000/1M * 3) = 0.0025 + 0.009 + 0.03 = 0.0415
      // GPT-5:  (5000/1M * 0.25) + ((3000+10000)/1M * 2) = 0.00125 + 0.026 = 0.02725
      expect(claudeCost).toBeCloseTo(0.21, 2)
      expect(geminiCost).toBeCloseTo(0.0415, 3)
      expect(gpt5Cost).toBeCloseTo(0.02725, 4)
    })
  })
})
