import { describe, it, expect } from 'vitest'
import {
  classifyIntent,
  classifyIntentGPT5,
  classifyIntentGemini,
  requiresThinking,
  requiresReasoningGPT5,
  requiresThinkingGemini,
  requiresWebSearch,
  getProfileDescription,
  getProfileIcon,
  type IntentProfile
} from './intentClassifier'

describe('intentClassifier', () => {
  describe('classifyIntent', () => {
    describe('perfil simples', () => {
      it('should classify empty message as simples', () => {
        const result = classifyIntent('')
        expect(result.profile).toBe('simples')
        expect(result.thinking.enabled).toBe(false)
        expect(result.useWebSearch).toBe(false)
      })

      it('should classify whitespace message as simples', () => {
        const result = classifyIntent('   ')
        expect(result.profile).toBe('simples')
      })

      it('should classify generic question as simples', () => {
        const result = classifyIntent('Qual é o horário de funcionamento do escritório?')
        expect(result.profile).toBe('simples')
        expect(result.thinking.enabled).toBe(false)
        expect(result.max_tokens).toBe(4096)
      })

      it('should classify greeting as simples', () => {
        const result = classifyIntent('Olá, bom dia!')
        expect(result.profile).toBe('simples')
      })
    })

    describe('perfil pesquisa', () => {
      it('should classify jurisprudencia request as pesquisa', () => {
        const result = classifyIntent('Busque jurisprudência sobre danos morais')
        expect(result.profile).toBe('pesquisa')
        expect(result.useWebSearch).toBe(true)
        expect(result.thinking.enabled).toBe(false)
      })

      it('should classify STJ search as pesquisa', () => {
        const result = classifyIntent('Pesquise decisões recentes do STJ sobre usucapião')
        expect(result.profile).toBe('pesquisa')
      })

      it('should classify sumula search as pesquisa', () => {
        const result = classifyIntent('Encontre súmulas do STF sobre prescrição')
        expect(result.profile).toBe('pesquisa')
      })

      it('should classify recent update search as pesquisa', () => {
        const result = classifyIntent('Qual o entendimento atual do tribunal sobre isso?')
        expect(result.profile).toBe('pesquisa')
      })

      it('should have max_tokens 8192 for pesquisa', () => {
        const result = classifyIntent('Busque jurisprudência')
        expect(result.max_tokens).toBe(8192)
      })
    })

    describe('perfil analise', () => {
      it('should classify strategy request as analise', () => {
        const result = classifyIntent('Analise a estratégia para este caso')
        expect(result.profile).toBe('analise')
        expect(result.thinking.enabled).toBe(true)
        expect(result.thinking.budget_tokens).toBe(10000)
      })

      it('should classify viability check as analise', () => {
        const result = classifyIntent('Avalie a viabilidade desta ação')
        expect(result.profile).toBe('analise')
      })

      it('should classify risk analysis as analise', () => {
        const result = classifyIntent('Quais os riscos e chances de sucesso?')
        expect(result.profile).toBe('analise')
      })

      it('should classify recommendation request as analise', () => {
        const result = classifyIntent('Qual sua recomendação para este caso?')
        expect(result.profile).toBe('analise')
      })

      it('should classify pros and cons as analise', () => {
        const result = classifyIntent('Compare os prós e contras de cada abordagem')
        expect(result.profile).toBe('analise')
      })
    })

    describe('perfil peca', () => {
      it('should classify petition request as peca', () => {
        const result = classifyIntent('Elabore uma petição inicial')
        expect(result.profile).toBe('peca')
        expect(result.thinking.enabled).toBe(true)
        expect(result.thinking.budget_tokens).toBe(16000)
        expect(result.max_tokens).toBe(16384)
      })

      it('should classify recurso request as peca', () => {
        const result = classifyIntent('Redija um recurso de apelação')
        expect(result.profile).toBe('peca')
      })

      it('should classify contestacao as peca', () => {
        const result = classifyIntent('Escreva uma contestação')
        expect(result.profile).toBe('peca')
      })

      it('should classify contrato as peca', () => {
        const result = classifyIntent('Crie uma minuta de contrato')
        expect(result.profile).toBe('peca')
      })

      it('should classify agravo as peca', () => {
        const result = classifyIntent('Monte um agravo de instrumento')
        expect(result.profile).toBe('peca')
      })

      it('should classify embargos as peca', () => {
        const result = classifyIntent('Prepare embargos de declaração')
        expect(result.profile).toBe('peca')
      })

      it('should classify parecer as peca', () => {
        const result = classifyIntent('Faça um parecer jurídico')
        expect(result.profile).toBe('peca')
      })
    })

    describe('prioridade entre perfis', () => {
      it('should prioritize peca over analise when both keywords present', () => {
        // "elabore petição" has peca keywords, even with "analise" word
        const result = classifyIntent('Elabore uma petição inicial analisando o caso')
        // Should be peca because petition keywords are stronger
        expect(result.profile).toBe('peca')
      })

      it('should count keywords to determine profile', () => {
        // Multiple peca keywords should win
        const result = classifyIntent('Elabore redija escreva uma petição recurso')
        expect(result.profile).toBe('peca')
      })
    })

    describe('normalização de texto', () => {
      it('should handle accented characters', () => {
        const result = classifyIntent('Elabore uma peticao')
        expect(result.profile).toBe('peca')
      })

      it('should be case insensitive', () => {
        const result = classifyIntent('ELABORE UMA PETIÇÃO INICIAL')
        expect(result.profile).toBe('peca')
      })

      it('should handle mixed case and accents', () => {
        const result = classifyIntent('Busque JURISPRUDÊNCIA do STJ')
        expect(result.profile).toBe('pesquisa')
      })
    })
  })

  describe('requiresThinking', () => {
    it('should return false for simples', () => {
      expect(requiresThinking('Olá')).toBe(false)
    })

    it('should return false for pesquisa', () => {
      expect(requiresThinking('Busque jurisprudência')).toBe(false)
    })

    it('should return true for analise', () => {
      expect(requiresThinking('Analise a estratégia')).toBe(true)
    })

    it('should return true for peca', () => {
      expect(requiresThinking('Elabore uma petição')).toBe(true)
    })
  })

  describe('requiresWebSearch', () => {
    it('should return false for simples', () => {
      expect(requiresWebSearch('Olá')).toBe(false)
    })

    it('should return true for pesquisa', () => {
      expect(requiresWebSearch('Busque jurisprudência')).toBe(true)
    })

    it('should return false for analise', () => {
      expect(requiresWebSearch('Analise a estratégia')).toBe(false)
    })

    it('should return false for peca', () => {
      expect(requiresWebSearch('Elabore uma petição')).toBe(false)
    })
  })

  describe('getProfileDescription', () => {
    it('should return correct description for each profile', () => {
      expect(getProfileDescription('simples')).toBe('Dúvida simples')
      expect(getProfileDescription('pesquisa')).toBe('Pesquisa jurídica')
      expect(getProfileDescription('analise')).toBe('Análise estratégica')
      expect(getProfileDescription('peca')).toBe('Elaboração de peça')
    })

    it('should return default for unknown profile', () => {
      expect(getProfileDescription('unknown' as IntentProfile)).toBe('Consulta')
    })
  })

  describe('getProfileIcon', () => {
    it('should return correct icon for each profile', () => {
      expect(getProfileIcon('simples')).toBe('MessageCircle')
      expect(getProfileIcon('pesquisa')).toBe('Search')
      expect(getProfileIcon('analise')).toBe('Brain')
      expect(getProfileIcon('peca')).toBe('FileText')
    })

    it('should return default icon for unknown profile', () => {
      expect(getProfileIcon('unknown' as IntentProfile)).toBe('MessageCircle')
    })
  })

  // =========================================
  // GPT-5 Intent Classification Tests
  // =========================================

  describe('classifyIntentGPT5', () => {
    describe('perfil simples', () => {
      it('should classify empty message as simples with no reasoning', () => {
        const result = classifyIntentGPT5('')
        expect(result.profile).toBe('simples')
        expect(result.reasoning_effort).toBe('none')
        expect(result.verbosity).toBe('low')
        expect(result.useWebSearch).toBe(false)
      })

      it('should classify generic question as simples', () => {
        const result = classifyIntentGPT5('Qual é o horário de funcionamento do escritório?')
        expect(result.profile).toBe('simples')
        expect(result.reasoning_effort).toBe('none')
        expect(result.max_output_tokens).toBe(2048)
      })
    })

    describe('perfil pesquisa', () => {
      it('should classify jurisprudencia request as pesquisa', () => {
        const result = classifyIntentGPT5('Busque jurisprudência sobre danos morais')
        expect(result.profile).toBe('pesquisa')
        expect(result.reasoning_effort).toBe('low')
        expect(result.verbosity).toBe('medium')
        expect(result.useWebSearch).toBe(true)
        expect(result.max_output_tokens).toBe(4096)
      })

      it('should classify STJ search as pesquisa', () => {
        const result = classifyIntentGPT5('Pesquise decisões recentes do STJ')
        expect(result.profile).toBe('pesquisa')
        expect(result.useWebSearch).toBe(true)
      })
    })

    describe('perfil analise', () => {
      it('should classify strategy request as analise with medium reasoning', () => {
        const result = classifyIntentGPT5('Analise a estratégia para este caso')
        expect(result.profile).toBe('analise')
        expect(result.reasoning_effort).toBe('medium')
        expect(result.verbosity).toBe('medium')
        expect(result.useWebSearch).toBe(false)
        expect(result.max_output_tokens).toBe(4096)
      })

      it('should classify risk analysis as analise', () => {
        const result = classifyIntentGPT5('Quais os riscos e chances de sucesso?')
        expect(result.profile).toBe('analise')
        expect(result.reasoning_effort).toBe('medium')
      })
    })

    describe('perfil peca', () => {
      it('should classify petition request as peca with high reasoning', () => {
        const result = classifyIntentGPT5('Elabore uma petição inicial')
        expect(result.profile).toBe('peca')
        expect(result.reasoning_effort).toBe('high')
        expect(result.verbosity).toBe('high')
        expect(result.useWebSearch).toBe(false)
        expect(result.max_output_tokens).toBe(8192)
      })

      it('should classify recurso as peca', () => {
        const result = classifyIntentGPT5('Redija um recurso de apelação')
        expect(result.profile).toBe('peca')
        expect(result.reasoning_effort).toBe('high')
      })

      it('should classify contrato as peca', () => {
        const result = classifyIntentGPT5('Crie uma minuta de contrato')
        expect(result.profile).toBe('peca')
        expect(result.reasoning_effort).toBe('high')
      })
    })

    describe('GPT-5 vs Claude config comparison', () => {
      it('should have same profile for same message', () => {
        const message = 'Elabore uma petição inicial de danos morais'
        const claudeConfig = classifyIntent(message)
        const gpt5Config = classifyIntentGPT5(message)

        expect(claudeConfig.profile).toBe(gpt5Config.profile)
        expect(claudeConfig.profile).toBe('peca')
      })

      it('should map thinking to reasoning consistently', () => {
        // peca profile: thinking enabled with budget -> high reasoning
        const petitionConfig = classifyIntentGPT5('Elabore uma petição')
        expect(petitionConfig.reasoning_effort).toBe('high')

        // analise profile: thinking enabled with lower budget -> medium reasoning
        const analysisConfig = classifyIntentGPT5('Analise a estratégia')
        expect(analysisConfig.reasoning_effort).toBe('medium')

        // simples profile: thinking disabled -> no reasoning
        const simpleConfig = classifyIntentGPT5('Olá, bom dia!')
        expect(simpleConfig.reasoning_effort).toBe('none')
      })
    })
  })

  describe('requiresReasoningGPT5', () => {
    it('should return false for simples (no reasoning)', () => {
      expect(requiresReasoningGPT5('Olá')).toBe(false)
    })

    it('should return true for pesquisa (low reasoning)', () => {
      expect(requiresReasoningGPT5('Busque jurisprudência')).toBe(true)
    })

    it('should return true for analise (medium reasoning)', () => {
      expect(requiresReasoningGPT5('Analise a estratégia')).toBe(true)
    })

    it('should return true for peca (high reasoning)', () => {
      expect(requiresReasoningGPT5('Elabore uma petição')).toBe(true)
    })
  })

  describe('GPT-5 configuration values', () => {
    it('should have appropriate max_output_tokens for each profile', () => {
      expect(classifyIntentGPT5('').max_output_tokens).toBe(2048) // simples
      expect(classifyIntentGPT5('Busque jurisprudência').max_output_tokens).toBe(4096) // pesquisa
      expect(classifyIntentGPT5('Analise a estratégia').max_output_tokens).toBe(4096) // analise
      expect(classifyIntentGPT5('Elabore uma petição').max_output_tokens).toBe(8192) // peca
    })

    it('should have appropriate verbosity for each profile', () => {
      expect(classifyIntentGPT5('').verbosity).toBe('low') // simples
      expect(classifyIntentGPT5('Busque jurisprudência').verbosity).toBe('medium') // pesquisa
      expect(classifyIntentGPT5('Analise a estratégia').verbosity).toBe('medium') // analise
      expect(classifyIntentGPT5('Elabore uma petição').verbosity).toBe('high') // peca
    })

    it('should only enable web search for pesquisa profile', () => {
      expect(classifyIntentGPT5('').useWebSearch).toBe(false) // simples
      expect(classifyIntentGPT5('Busque jurisprudência').useWebSearch).toBe(true) // pesquisa
      expect(classifyIntentGPT5('Analise a estratégia').useWebSearch).toBe(false) // analise
      expect(classifyIntentGPT5('Elabore uma petição').useWebSearch).toBe(false) // peca
    })
  })

  // =========================================
  // Google Gemini 3 Flash Intent Classification Tests
  // =========================================

  describe('classifyIntentGemini', () => {
    describe('perfil simples', () => {
      it('should classify empty message as simples with minimal thinking', () => {
        const result = classifyIntentGemini('')
        expect(result.profile).toBe('simples')
        expect(result.thinking_level).toBe('minimal')
        expect(result.useWebSearch).toBe(false)
      })

      it('should classify generic question as simples', () => {
        const result = classifyIntentGemini('Qual é o horário de funcionamento do escritório?')
        expect(result.profile).toBe('simples')
        expect(result.thinking_level).toBe('minimal')
        expect(result.max_output_tokens).toBe(2048)
      })

      it('should classify whitespace message as simples', () => {
        const result = classifyIntentGemini('   ')
        expect(result.profile).toBe('simples')
        expect(result.thinking_level).toBe('minimal')
      })
    })

    describe('perfil pesquisa', () => {
      it('should classify jurisprudencia request as pesquisa', () => {
        const result = classifyIntentGemini('Busque jurisprudência sobre danos morais')
        expect(result.profile).toBe('pesquisa')
        expect(result.thinking_level).toBe('low')
        expect(result.useWebSearch).toBe(true) // Google Search grounding
        expect(result.max_output_tokens).toBe(4096)
      })

      it('should classify STJ search as pesquisa', () => {
        const result = classifyIntentGemini('Pesquise decisões recentes do STJ')
        expect(result.profile).toBe('pesquisa')
        expect(result.useWebSearch).toBe(true)
      })

      it('should classify sumula search as pesquisa', () => {
        const result = classifyIntentGemini('Encontre súmulas do STF sobre prescrição')
        expect(result.profile).toBe('pesquisa')
        expect(result.thinking_level).toBe('low')
      })
    })

    describe('perfil analise', () => {
      it('should classify strategy request as analise with high thinking', () => {
        const result = classifyIntentGemini('Analise a estratégia para este caso')
        expect(result.profile).toBe('analise')
        expect(result.thinking_level).toBe('high')
        expect(result.useWebSearch).toBe(false)
        expect(result.max_output_tokens).toBe(4096)
      })

      it('should classify risk analysis as analise', () => {
        const result = classifyIntentGemini('Quais os riscos e chances de sucesso?')
        expect(result.profile).toBe('analise')
        expect(result.thinking_level).toBe('high')
      })

      it('should classify recommendation request as analise', () => {
        const result = classifyIntentGemini('Qual sua recomendação para este caso?')
        expect(result.profile).toBe('analise')
        expect(result.thinking_level).toBe('high')
      })
    })

    describe('perfil peca', () => {
      it('should classify petition request as peca with high thinking', () => {
        const result = classifyIntentGemini('Elabore uma petição inicial')
        expect(result.profile).toBe('peca')
        expect(result.thinking_level).toBe('high')
        expect(result.useWebSearch).toBe(false)
        expect(result.max_output_tokens).toBe(8192)
      })

      it('should classify recurso as peca', () => {
        const result = classifyIntentGemini('Redija um recurso de apelação')
        expect(result.profile).toBe('peca')
        expect(result.thinking_level).toBe('high')
      })

      it('should classify contrato as peca', () => {
        const result = classifyIntentGemini('Crie uma minuta de contrato')
        expect(result.profile).toBe('peca')
        expect(result.thinking_level).toBe('high')
      })

      it('should classify agravo as peca', () => {
        const result = classifyIntentGemini('Monte um agravo de instrumento')
        expect(result.profile).toBe('peca')
        expect(result.thinking_level).toBe('high')
      })
    })

    describe('Gemini vs Claude vs GPT-5 config comparison', () => {
      it('should have same profile for same message across all providers', () => {
        const message = 'Elabore uma petição inicial de danos morais'
        const claudeConfig = classifyIntent(message)
        const gpt5Config = classifyIntentGPT5(message)
        const geminiConfig = classifyIntentGemini(message)

        expect(claudeConfig.profile).toBe('peca')
        expect(gpt5Config.profile).toBe('peca')
        expect(geminiConfig.profile).toBe('peca')
      })

      it('should map thinking levels consistently', () => {
        // peca profile: high thinking
        const petitionConfig = classifyIntentGemini('Elabore uma petição')
        expect(petitionConfig.thinking_level).toBe('high')

        // analise profile: high thinking
        const analysisConfig = classifyIntentGemini('Analise a estratégia')
        expect(analysisConfig.thinking_level).toBe('high')

        // pesquisa profile: low thinking
        const searchConfig = classifyIntentGemini('Busque jurisprudência')
        expect(searchConfig.thinking_level).toBe('low')

        // simples profile: minimal thinking
        const simpleConfig = classifyIntentGemini('Olá, bom dia!')
        expect(simpleConfig.thinking_level).toBe('minimal')
      })

      it('should have consistent web search behavior', () => {
        // Only pesquisa profile enables web search
        expect(classifyIntentGemini('').useWebSearch).toBe(false)
        expect(classifyIntentGemini('Busque jurisprudência').useWebSearch).toBe(true)
        expect(classifyIntentGemini('Analise a estratégia').useWebSearch).toBe(false)
        expect(classifyIntentGemini('Elabore uma petição').useWebSearch).toBe(false)
      })
    })
  })

  describe('requiresThinkingGemini', () => {
    it('should return false for simples (minimal thinking)', () => {
      expect(requiresThinkingGemini('Olá')).toBe(false)
    })

    it('should return true for pesquisa (low thinking)', () => {
      expect(requiresThinkingGemini('Busque jurisprudência')).toBe(true)
    })

    it('should return true for analise (high thinking)', () => {
      expect(requiresThinkingGemini('Analise a estratégia')).toBe(true)
    })

    it('should return true for peca (high thinking)', () => {
      expect(requiresThinkingGemini('Elabore uma petição')).toBe(true)
    })
  })

  describe('Gemini configuration values', () => {
    it('should have appropriate max_output_tokens for each profile', () => {
      expect(classifyIntentGemini('').max_output_tokens).toBe(2048) // simples
      expect(classifyIntentGemini('Busque jurisprudência').max_output_tokens).toBe(4096) // pesquisa
      expect(classifyIntentGemini('Analise a estratégia').max_output_tokens).toBe(4096) // analise
      expect(classifyIntentGemini('Elabore uma petição').max_output_tokens).toBe(8192) // peca
    })

    it('should have appropriate thinking_level for each profile', () => {
      expect(classifyIntentGemini('').thinking_level).toBe('minimal') // simples
      expect(classifyIntentGemini('Busque jurisprudência').thinking_level).toBe('low') // pesquisa
      expect(classifyIntentGemini('Analise a estratégia').thinking_level).toBe('high') // analise
      expect(classifyIntentGemini('Elabore uma petição').thinking_level).toBe('high') // peca
    })

    it('should only enable Google Search grounding for pesquisa profile', () => {
      expect(classifyIntentGemini('').useWebSearch).toBe(false) // simples
      expect(classifyIntentGemini('Busque jurisprudência').useWebSearch).toBe(true) // pesquisa
      expect(classifyIntentGemini('Analise a estratégia').useWebSearch).toBe(false) // analise
      expect(classifyIntentGemini('Elabore uma petição').useWebSearch).toBe(false) // peca
    })
  })

  describe('Gemini thinking level mapping', () => {
    it('should use minimal for tasks that dont need deep reasoning', () => {
      const result = classifyIntentGemini('Qual o telefone do escritório?')
      expect(result.thinking_level).toBe('minimal')
    })

    it('should use low for research tasks', () => {
      const result = classifyIntentGemini('Pesquise julgados do tribunal')
      expect(result.thinking_level).toBe('low')
    })

    it('should use high for complex analysis', () => {
      const result = classifyIntentGemini('Avalie a viabilidade desta ação')
      expect(result.thinking_level).toBe('high')
    })

    it('should use high for document generation', () => {
      const result = classifyIntentGemini('Redija uma contestação detalhada')
      expect(result.thinking_level).toBe('high')
    })
  })
})
