import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Deadline } from '@/types'

interface DeadlineFormData {
  title: string
  description: string
  due_date: string
  reminder_date: string
  priority: 'baixa' | 'normal' | 'alta' | 'urgente'
  case_id: number | null
  client_id: number | null
}

interface DeadlineFormProps {
  deadline?: Deadline | null
  defaultDate?: Date | null
  onSave: (data: DeadlineFormData) => Promise<void>
  onClose: () => void
}

const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'text-gray-400' },
  { value: 'normal', label: 'Normal', color: 'text-blue-400' },
  { value: 'alta', label: 'Alta', color: 'text-amber-400' },
  { value: 'urgente', label: 'Urgente', color: 'text-red-400' },
]

export function DeadlineForm({ deadline, defaultDate, onSave, onClose }: DeadlineFormProps) {
  const [formData, setFormData] = useState<DeadlineFormData>({
    title: '',
    description: '',
    due_date: '',
    reminder_date: '',
    priority: 'normal',
    case_id: null,
    client_id: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (deadline) {
      setFormData({
        title: deadline.title,
        description: deadline.description || '',
        due_date: deadline.due_date ? formatDateTimeLocal(deadline.due_date) : '',
        reminder_date: deadline.reminder_date ? formatDateTimeLocal(deadline.reminder_date) : '',
        priority: deadline.priority,
        case_id: deadline.case_id,
        client_id: deadline.client_id,
      })
    } else {
      // Use defaultDate if provided, otherwise tomorrow at 23:59
      const dueDate = defaultDate ? new Date(defaultDate) : new Date()
      if (!defaultDate) {
        dueDate.setDate(dueDate.getDate() + 1)
      }
      dueDate.setHours(23, 59, 0, 0)
      setFormData((prev) => ({
        ...prev,
        due_date: formatDateTimeLocal(dueDate.toISOString()),
      }))
    }
  }, [deadline, defaultDate])

  const formatDateTimeLocal = (isoString: string) => {
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      setError('Título é obrigatório')
      return
    }

    if (!formData.due_date) {
      setError('Data de vencimento é obrigatória')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSave({
        ...formData,
        due_date: new Date(formData.due_date).toISOString(),
        reminder_date: formData.reminder_date
          ? new Date(formData.reminder_date).toISOString()
          : '',
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof DeadlineFormData, value: string | number | null) => {
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
            {deadline ? 'Editar Prazo' : 'Novo Prazo'}
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
              id="deadline-title"
              name="deadlineTitle"
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Ex: Prazo para contestação"
              className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Data de Vencimento *
              </label>
              <input
                id="deadline-due-date"
                name="deadlineDueDate"
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
                className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Lembrete
              </label>
              <input
                id="deadline-reminder"
                name="deadlineReminder"
                type="datetime-local"
                value={formData.reminder_date}
                onChange={(e) => handleChange('reminder_date', e.target.value)}
                className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Prioridade
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleChange('priority', p.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    formData.priority === p.value
                      ? 'border-primary bg-primary/10 text-white'
                      : 'border-border-dark text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span className={p.color}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Descrição
            </label>
            <textarea
              id="deadline-description"
              name="deadlineDescription"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Detalhes sobre o prazo..."
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
              {loading ? 'Salvando...' : deadline ? 'Salvar' : 'Criar Prazo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
