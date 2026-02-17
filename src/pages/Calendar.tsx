import { useState, useEffect, useMemo } from 'react'
import { Plus, Calendar as CalendarIcon, Check, AlertTriangle, Clock, Loader2, Pencil, Trash2, LayoutGrid, List, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDeadlineStore } from '@/stores/deadlineStore'
import { DeadlineForm } from '@/components/deadlines/DeadlineForm'
import { DeadlineDetailModal } from '@/components/deadlines/DeadlineDetailModal'
import { CalendarGrid } from '@/components/deadlines/CalendarGrid'
import type { Deadline } from '@/types'

type ViewType = 'calendar' | 'list'

type FilterType = 'todos' | 'pendentes' | 'concluidos' | 'vencidos'

export default function Calendar() {
  const [view, setView] = useState<ViewType>('calendar')
  const [filter, setFilter] = useState<FilterType>('pendentes')
  const [showForm, setShowForm] = useState(false)
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null)
  const [viewingDeadline, setViewingDeadline] = useState<Deadline | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Deadline | null>(null)
  const [defaultDate, setDefaultDate] = useState<Date | null>(null)

  const { deadlines, loading, error, fetchDeadlines, createDeadline, updateDeadline, deleteDeadline, toggleComplete } = useDeadlineStore()

  useEffect(() => {
    fetchDeadlines()
  }, [fetchDeadlines])

  // Compute overdue deadlines from reactive state
  const overdueDeadlines = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return deadlines.filter((d) => {
      if (d.completed) return false
      const dueDate = new Date(d.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate < today
    })
  }, [deadlines])

  // Filter deadlines based on selected filter
  const filteredDeadlines = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    switch (filter) {
      case 'pendentes':
        return deadlines.filter((d) => !d.completed)
      case 'concluidos':
        return deadlines.filter((d) => d.completed)
      case 'vencidos':
        return overdueDeadlines
      default:
        return deadlines
    }
  }, [deadlines, filter, overdueDeadlines])

  // Group deadlines by period
  const groupedDeadlines = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const thisWeekEnd = new Date(today)
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 7)
    const thisMonthEnd = new Date(today)
    thisMonthEnd.setMonth(thisMonthEnd.getMonth() + 1)

    const groups: { [key: string]: Deadline[] } = {
      'Vencidos': [],
      'Hoje': [],
      'Amanhã': [],
      'Esta Semana': [],
      'Este Mês': [],
      'Futuro': [],
    }

    filteredDeadlines.forEach((deadline) => {
      const dueDate = new Date(deadline.due_date)
      dueDate.setHours(0, 0, 0, 0)

      if (dueDate < today && !deadline.completed) {
        groups['Vencidos'].push(deadline)
      } else if (dueDate.getTime() === today.getTime()) {
        groups['Hoje'].push(deadline)
      } else if (dueDate.getTime() === tomorrow.getTime()) {
        groups['Amanhã'].push(deadline)
      } else if (dueDate < thisWeekEnd) {
        groups['Esta Semana'].push(deadline)
      } else if (dueDate < thisMonthEnd) {
        groups['Este Mês'].push(deadline)
      } else {
        groups['Futuro'].push(deadline)
      }
    })

    // Remove empty groups
    return Object.entries(groups).filter(([, items]) => items.length > 0)
  }, [filteredDeadlines])

  const handleCreateDeadline = async (data: {
    title: string
    description: string
    due_date: string
    reminder_date: string
    priority: 'baixa' | 'normal' | 'alta' | 'urgente'
    case_id: number | null
    client_id: number | null
  }) => {
    await createDeadline({
      title: data.title,
      description: data.description || undefined,
      due_date: data.due_date,
      reminder_date: data.reminder_date || undefined,
      priority: data.priority,
      case_id: data.case_id || undefined,
      client_id: data.client_id || undefined,
    })
    setShowForm(false)
  }

  const handleUpdateDeadline = async (data: {
    title: string
    description: string
    due_date: string
    reminder_date: string
    priority: 'baixa' | 'normal' | 'alta' | 'urgente'
    case_id: number | null
    client_id: number | null
  }) => {
    if (!editingDeadline) return

    await updateDeadline(editingDeadline.id, {
      title: data.title,
      description: data.description || undefined,
      due_date: data.due_date,
      reminder_date: data.reminder_date || undefined,
      priority: data.priority,
    })
    setEditingDeadline(null)
  }

  const handleDeleteDeadline = async () => {
    if (!showDeleteConfirm) return
    await deleteDeadline(showDeleteConfirm.id)
    setShowDeleteConfirm(null)
  }

  const handleToggleComplete = async (id: number) => {
    await toggleComplete(id)
  }

  const handleDateClick = (date: Date) => {
    setDefaultDate(date)
    setEditingDeadline(null)
    setShowForm(true)
  }

  const handleCalendarDeadlineClick = (deadline: Deadline) => {
    setViewingDeadline(deadline)
  }

  const handleViewToEdit = (deadline: Deadline) => {
    setViewingDeadline(null)
    setEditingDeadline(deadline)
  }

  const handleViewToDelete = (deadline: Deadline) => {
    setViewingDeadline(null)
    setShowDeleteConfirm(deadline)
  }

  const handleDeadlineDrop = async (deadlineId: number, newDate: Date) => {
    const deadline = deadlines.find((d) => d.id === deadlineId)
    if (!deadline) return

    // Preserve the time from the original due_date
    const originalDate = new Date(deadline.due_date)
    newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0)

    await updateDeadline(deadlineId, {
      due_date: newDate.toISOString(),
    })
  }

  const handleFormClose = () => {
    setShowForm(false)
    setDefaultDate(null)
  }

  const getPriorityColor = (priority: Deadline['priority']) => {
    switch (priority) {
      case 'baixa':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
      case 'normal':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'alta':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'urgente':
        return 'bg-red-500/10 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
    }
  }

  const getPriorityLabel = (priority: Deadline['priority']) => {
    switch (priority) {
      case 'baixa':
        return 'Baixa'
      case 'normal':
        return 'Normal'
      case 'alta':
        return 'Alta'
      case 'urgente':
        return 'Urgente'
      default:
        return priority
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getGroupIcon = (group: string) => {
    switch (group) {
      case 'Vencidos':
        return <AlertTriangle className="size-5 text-red-400" />
      case 'Hoje':
        return <Clock className="size-5 text-amber-400" />
      default:
        return <CalendarIcon className="size-5 text-primary" />
    }
  }

  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'todos', label: 'Todos', count: deadlines.length },
    { key: 'pendentes', label: 'Pendentes', count: deadlines.filter((d) => !d.completed).length },
    { key: 'concluidos', label: 'Concluídos', count: deadlines.filter((d) => d.completed).length },
    { key: 'vencidos', label: 'Vencidos', count: overdueDeadlines.length },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agenda de Prazos</h1>
          <p className="text-gray-400 text-sm mt-1">
            Gerencie seus prazos e compromissos
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-surface-dark border border-border-dark rounded-lg p-1">
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'p-2 rounded-md transition-colors',
                view === 'calendar'
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
              )}
              title="Visualização em calendário"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                view === 'list'
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
              )}
              title="Visualização em lista"
            >
              <List className="size-4" />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95"
          >
            <Plus className="size-4" />
            Novo Prazo
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && deadlines.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 text-primary animate-spin" />
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && !loading && (
        <CalendarGrid
          deadlines={deadlines}
          onDateClick={handleDateClick}
          onDeadlineClick={handleCalendarDeadlineClick}
          onDeadlineDrop={handleDeadlineDrop}
          onToggleComplete={handleToggleComplete}
        />
      )}

      {/* List View */}
      {view === 'list' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                  filter === f.key
                    ? 'bg-primary text-white'
                    : 'bg-surface-dark text-gray-400 hover:text-white border border-border-dark'
                )}
              >
                {f.label}
                {f.count !== undefined && (
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs',
                      filter === f.key
                        ? 'bg-white/20'
                        : 'bg-surface-highlight'
                    )}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Deadlines List */}
          {!loading && groupedDeadlines.length > 0 && (
            <div className="space-y-6">
              {groupedDeadlines.map(([group, items]) => (
                <div key={group}>
                  {/* Group Header */}
                  <div className="flex items-center gap-2 mb-3">
                    {getGroupIcon(group)}
                    <h2 className={cn(
                      'text-lg font-medium',
                      group === 'Vencidos' ? 'text-red-400' : 'text-white'
                    )}>
                      {group}
                    </h2>
                    <span className="text-gray-500 text-sm">({items.length})</span>
                  </div>

                  {/* Deadlines in Group */}
                  <div className="space-y-2">
                    {items.map((deadline) => (
                      <div
                        key={deadline.id}
                        className={cn(
                          'flex items-center gap-4 p-4 bg-surface-dark border border-border-dark rounded-xl transition-colors group',
                          deadline.completed && 'opacity-60'
                        )}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => handleToggleComplete(deadline.id)}
                          className={cn(
                            'size-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0',
                            deadline.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-gray-600 hover:border-primary'
                          )}
                        >
                          {deadline.completed && <Check className="size-4" />}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3
                              className={cn(
                                'text-white font-medium truncate',
                                deadline.completed && 'line-through text-gray-500'
                              )}
                            >
                              {deadline.title}
                            </h3>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs border shrink-0',
                                getPriorityColor(deadline.priority)
                              )}
                            >
                              {getPriorityLabel(deadline.priority)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                            <span>{formatDate(deadline.due_date)}</span>
                            {deadline.description && (
                              <>
                                <span>•</span>
                                <span className="truncate">{deadline.description}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => setViewingDeadline(deadline)}
                            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="size-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => setEditingDeadline(deadline)}
                            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
                            title="Editar prazo"
                          >
                            <Pencil className="size-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(deadline)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir prazo"
                          >
                            <Trash2 className="size-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredDeadlines.length === 0 && (
            <div className="text-center py-12">
              <div className="size-16 bg-surface-dark rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarIcon className="size-8 text-gray-500" />
              </div>
              <h3 className="text-white font-medium mb-1">
                {filter === 'todos'
                  ? 'Nenhum prazo cadastrado'
                  : filter === 'pendentes'
                  ? 'Nenhum prazo pendente'
                  : filter === 'concluidos'
                  ? 'Nenhum prazo concluído'
                  : 'Nenhum prazo vencido'}
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                {filter === 'todos' || filter === 'pendentes'
                  ? 'Comece adicionando seu primeiro prazo'
                  : 'Continue assim!'}
              </p>
              {(filter === 'todos' || filter === 'pendentes') && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95"
                >
                  <Plus className="size-4" />
                  Adicionar Prazo
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <DeadlineForm
          defaultDate={defaultDate}
          onSave={handleCreateDeadline}
          onClose={handleFormClose}
        />
      )}

      {/* View Detail Modal */}
      {viewingDeadline && (
        <DeadlineDetailModal
          deadline={viewingDeadline}
          onClose={() => setViewingDeadline(null)}
          onEdit={handleViewToEdit}
          onDelete={handleViewToDelete}
          onToggleComplete={handleToggleComplete}
        />
      )}

      {/* Edit Form Modal */}
      {editingDeadline && (
        <DeadlineForm
          deadline={editingDeadline}
          onSave={handleUpdateDeadline}
          onClose={() => setEditingDeadline(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-md mx-4 p-[var(--space-modal)] shadow-lg motion-overlay-panel">
            <h3 className="text-lg font-semibold text-white mb-2">
              Excluir Prazo
            </h3>
            <p className="text-gray-400 mb-6">
              Tem certeza que deseja excluir <strong className="text-white">{showDeleteConfirm.title}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteDeadline}
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
