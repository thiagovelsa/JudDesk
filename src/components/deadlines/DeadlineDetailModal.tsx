import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  X,
  Pencil,
  Trash2,
  Check,
  Calendar,
  Clock,
  AlertTriangle,
  Flag,
  FileText,
  User,
  Briefcase,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClientStore } from '@/stores/clientStore'
import { useCaseStore } from '@/stores/caseStore'
import type { Deadline } from '@/types'

interface DeadlineDetailModalProps {
  deadline: Deadline
  onClose: () => void
  onEdit: (deadline: Deadline) => void
  onDelete: (deadline: Deadline) => void
  onToggleComplete: (id: number) => void
}

const priorityConfig: Record<
  Deadline['priority'],
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  baixa: {
    label: 'Baixa',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
  },
  normal: {
    label: 'Normal',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  alta: {
    label: 'Alta',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  urgente: {
    label: 'Urgente',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
}

export function DeadlineDetailModal({
  deadline,
  onClose,
  onEdit,
  onDelete,
  onToggleComplete,
}: DeadlineDetailModalProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { clients } = useClientStore()
  const { cases } = useCaseStore()

  const client = deadline.client_id
    ? clients.find((c) => c.id === deadline.client_id)
    : null
  const caseItem = deadline.case_id
    ? cases.find((c) => c.id === deadline.case_id)
    : null

  const priority = priorityConfig[deadline.priority]
  const dueDate = new Date(deadline.due_date)
  const reminderDate = deadline.reminder_date
    ? new Date(deadline.reminder_date)
    : null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDateOnly = new Date(dueDate)
  dueDateOnly.setHours(0, 0, 0, 0)
  const isOverdue = !deadline.completed && dueDateOnly < today

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 200)
  }

  const handleEdit = () => {
    handleClose()
    setTimeout(() => onEdit(deadline), 100)
  }

  const handleDelete = () => {
    setShowDeleteConfirm(false)
    handleClose()
    setTimeout(() => onDelete(deadline), 100)
  }

  const handleToggleComplete = () => {
    onToggleComplete(deadline.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          'motion-overlay-backdrop',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-lg mx-4 shadow-lg',
          'motion-overlay-panel',
          'transition-all duration-200 ease-out',
          isVisible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-[var(--space-modal)] border-b border-border-dark">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              {deadline.completed ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Check className="size-3" />
                  Concluído
                </span>
              ) : isOverdue ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                  <AlertTriangle className="size-3" />
                  Vencido
                </span>
              ) : null}
              <span
                className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
                  priority.bgColor,
                  priority.color,
                  priority.borderColor
                )}
              >
                <Flag className="size-3" />
                {priority.label}
              </span>
            </div>
            <h2
              className={cn(
                'text-xl font-semibold text-white',
                deadline.completed && 'line-through opacity-60'
              )}
            >
              {deadline.title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Data e Hora */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-surface-highlight">
              <Calendar className={cn('size-5', isOverdue ? 'text-red-400' : 'text-primary')} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Data de Vencimento</p>
              <p className={cn('text-white font-medium', isOverdue && 'text-red-400')}>
                {format(dueDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p className={cn('text-sm', isOverdue ? 'text-red-400/70' : 'text-gray-500')}>
                {format(dueDate, 'HH:mm', { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Lembrete */}
          {reminderDate && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-surface-highlight">
                <Bell className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Lembrete</p>
                <p className="text-white font-medium">
                  {format(reminderDate, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}

          {/* Descrição */}
          {deadline.description && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-surface-highlight">
                <FileText className="size-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-400">Descrição</p>
                <p className="text-white whitespace-pre-wrap">{deadline.description}</p>
              </div>
            </div>
          )}

          {/* Cliente */}
          {client && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-surface-highlight">
                <User className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Cliente</p>
                <p className="text-white font-medium">{client.name}</p>
              </div>
            </div>
          )}

          {/* Caso */}
          {caseItem && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-surface-highlight">
                <Briefcase className="size-5 text-purple-400" />
              </div>
              <div className="mt-1">
                <p className="font-medium text-gray-900">{caseItem.title}</p>
                {caseItem.case_number && (
                  <p className="text-sm text-gray-500">Nº {caseItem.case_number}</p>
                )}
              </div>
            </div>
          )}

          {/* Metadados */}
          <div className="pt-3 border-t border-border-dark">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Clock className="size-3" />
              <span>
                Criado em {format(new Date(deadline.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer - Actions */}
        <div className="flex items-center justify-between p-4 border-t border-border-dark bg-surface-highlight/30">
          <button
            onClick={handleToggleComplete}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95',
              deadline.completed
                ? 'bg-gray-600 hover:bg-gray-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            )}
          >
            <Check className="size-4" />
            {deadline.completed ? 'Desmarcar' : 'Marcar como Concluído'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="size-4" />
              Excluir
            </button>
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95"
            >
              <Pencil className="size-4" />
              Editar
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-sm mx-4 p-[var(--space-modal)] shadow-lg">
            <h3 className="text-lg font-semibold text-white mb-2">
              Excluir Prazo
            </h3>
            <p className="text-gray-400 mb-6">
              Tem certeza que deseja excluir{' '}
              <strong className="text-white">{deadline.title}</strong>? Esta ação
              não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-all active:scale-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
