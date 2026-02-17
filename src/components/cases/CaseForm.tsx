import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Case } from '@/types'

interface CaseFormData {
  title: string
  case_number: string
  court: string
  type: string
  status: 'ativo' | 'arquivado' | 'suspenso'
  description: string
}

interface CaseFormProps {
  case_?: Case | null
  clientId: number
  onSave: (data: CaseFormData & { client_id: number }) => Promise<void>
  onClose: () => void
}

const CASE_TYPES = [
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'civil', label: 'Cível' },
  { value: 'criminal', label: 'Criminal' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'familia', label: 'Família' },
  { value: 'consumidor', label: 'Consumidor' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'outro', label: 'Outro' },
]

const CASE_STATUS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'arquivado', label: 'Arquivado' },
  { value: 'suspenso', label: 'Suspenso' },
]

export function CaseForm({ case_, clientId, onSave, onClose }: CaseFormProps) {
  const [formData, setFormData] = useState<CaseFormData>({
    title: '',
    case_number: '',
    court: '',
    type: '',
    status: 'ativo',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (case_) {
      setFormData({
        title: case_.title,
        case_number: case_.case_number || '',
        court: case_.court || '',
        type: case_.type || '',
        status: case_.status,
        description: case_.description || '',
      })
    }
  }, [case_])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      setError('Título é obrigatório')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSave({
        ...formData,
        client_id: clientId,
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof CaseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-lg mx-4 shadow-lg motion-overlay-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-[var(--space-modal)] border-b border-border-dark">
          <h2 className="text-lg font-semibold text-white">
            {case_ ? 'Editar Caso' : 'Novo Caso'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-highlight rounded transition-colors"
          >
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-[var(--space-modal)] space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Título *
            </label>
            <input
              id="case-title"
              name="caseTitle"
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Ex: Reclamação Trabalhista contra Empresa X"
              className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Número do Processo
            </label>
            <input
              id="case-number"
              name="caseNumber"
              type="text"
              value={formData.case_number}
              onChange={(e) => handleChange('case_number', e.target.value)}
              placeholder="0000000-00.0000.0.00.0000"
              className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Tipo
              </label>
              <select
                id="case-type"
                name="caseType"
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              >
                <option value="">Selecione...</option>
                {CASE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Status
              </label>
              <select
                id="case-status"
                name="caseStatus"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as CaseFormData['status'])}
                className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              >
                {CASE_STATUS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Tribunal/Vara
            </label>
            <input
              id="case-court"
              name="caseCourt"
              type="text"
              value={formData.court}
              onChange={(e) => handleChange('court', e.target.value)}
              placeholder="Ex: 1ª Vara do Trabalho de São Paulo"
              className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Descrição
            </label>
            <textarea
              id="case-description"
              name="caseDescription"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Detalhes sobre o processo..."
              rows={3}
              className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : case_ ? 'Salvar' : 'Criar Caso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
