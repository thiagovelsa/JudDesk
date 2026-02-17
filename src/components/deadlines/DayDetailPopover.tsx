import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Plus, Check, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Deadline } from '@/types'

interface DayDetailPopoverProps {
  date: Date
  deadlines: Deadline[]
  anchorRect: DOMRect | null
  onClose: () => void
  onDeadlineClick: (deadline: Deadline) => void
  onAddClick: (date: Date) => void
  onToggleComplete: (id: number) => void
}

const priorityColors: Record<Deadline['priority'], string> = {
  baixa: 'bg-gray-500',
  normal: 'bg-blue-500',
  alta: 'bg-amber-500',
  urgente: 'bg-red-500',
}

const priorityLabels: Record<Deadline['priority'], string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

export function DayDetailPopover({
  date,
  deadlines,
  anchorRect,
  onClose,
  onDeadlineClick,
  onAddClick,
  onToggleComplete,
}: DayDetailPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current)
      }
    }
  }, [])

  // Calculate position based on anchor element
  useEffect(() => {
    if (!anchorRect || !popoverRef.current) return

    const popover = popoverRef.current
    const popoverRect = popover.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const padding = 16

    let top = anchorRect.bottom + 8
    let left = anchorRect.left + (anchorRect.width / 2) - (popoverRect.width / 2)

    // Adjust if popover goes beyond viewport
    if (left < padding) {
      left = padding
    } else if (left + popoverRect.width > viewportWidth - padding) {
      left = viewportWidth - popoverRect.width - padding
    }

    // If popover goes below viewport, show above the anchor
    if (top + popoverRect.height > viewportHeight - padding) {
      top = anchorRect.top - popoverRect.height - 8
    }

    setPosition({ top, left })

    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [anchorRect])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleClose = () => {
    setIsClosing(true)
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current)
    actionTimeoutRef.current = setTimeout(() => {
      onClose()
    }, 200)
  }

  const handleDeadlineClick = (deadline: Deadline) => {
    setIsClosing(true)
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current)
    actionTimeoutRef.current = setTimeout(() => {
      onClose()
      onDeadlineClick(deadline)
    }, 200)
  }

  const handleAddClick = () => {
    setIsClosing(true)
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current)
    actionTimeoutRef.current = setTimeout(() => {
      onClose()
      onAddClick(date)
    }, 200)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isOverdue = (deadline: Deadline) => {
    const dueDate = new Date(deadline.due_date)
    dueDate.setHours(0, 0, 0, 0)
    return !deadline.completed && dueDate < today
  }

  const pendingDeadlines = deadlines.filter(d => !d.completed)
  const completedDeadlines = deadlines.filter(d => d.completed)

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200',
          'motion-overlay-backdrop',
          isVisible && !isClosing ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleClose}
      />

      {/* Popover */}
      <div
        ref={popoverRef}
        style={{
          top: position.top,
          left: position.left,
        }}
        className={cn(
          'fixed z-50 w-80 max-h-[70vh] overflow-hidden',
          'bg-surface-dark border border-border-dark rounded-xl shadow-2xl',
          'motion-overlay-panel',
          'transition-all duration-200 ease-out origin-top',
          isVisible && !isClosing
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-dark bg-surface-highlight/30">
          <div>
            <h3 className="text-white font-semibold">
              {format(date, "d 'de' MMMM", { locale: ptBR })}
            </h3>
            <p className="text-gray-400 text-sm">
              {format(date, 'EEEE', { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddClick}
              className="p-2 hover:bg-surface-highlight rounded-lg transition-colors text-primary"
              title="Adicionar prazo"
            >
              <Plus className="size-5" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-surface-highlight rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(70vh-80px)] p-2">
          {deadlines.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="size-12 bg-surface-highlight rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="size-6 text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm">Nenhuma obrigação neste dia</p>
              <button
                onClick={handleAddClick}
                className="mt-3 text-primary text-sm hover:underline"
              >
                Adicionar prazo
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Pending deadlines */}
              {pendingDeadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className={cn(
                    'group flex items-start gap-3 p-3 rounded-lg cursor-pointer',
                    'hover:bg-surface-highlight/50 transition-all duration-150'
                  )}
                  onClick={() => handleDeadlineClick(deadline)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleComplete(deadline.id)
                    }}
                    className={cn(
                      'mt-0.5 size-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      'border-gray-600 hover:border-primary'
                    )}
                  >
                    <Check className="size-3 text-transparent group-hover:text-gray-600 transition-colors" />
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm truncate">
                        {deadline.title}
                      </span>
                      {isOverdue(deadline) && (
                        <AlertTriangle className="size-3.5 text-red-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          'size-2 rounded-full shrink-0',
                          priorityColors[deadline.priority]
                        )}
                      />
                      <span className="text-xs text-gray-500">
                        {priorityLabels[deadline.priority]}
                      </span>
                      {deadline.description && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-xs text-gray-500 truncate">
                            {deadline.description}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Separator if both lists have items */}
              {pendingDeadlines.length > 0 && completedDeadlines.length > 0 && (
                <div className="flex items-center gap-2 py-2 px-3">
                  <div className="flex-1 h-px bg-border-dark" />
                  <span className="text-xs text-gray-600">Concluídos</span>
                  <div className="flex-1 h-px bg-border-dark" />
                </div>
              )}

              {/* Completed deadlines */}
              {completedDeadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className={cn(
                    'group flex items-start gap-3 p-3 rounded-lg cursor-pointer opacity-60',
                    'hover:bg-surface-highlight/50 transition-all duration-150'
                  )}
                  onClick={() => handleDeadlineClick(deadline)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleComplete(deadline.id)
                    }}
                    className={cn(
                      'mt-0.5 size-5 rounded flex items-center justify-center shrink-0',
                      'bg-emerald-500 text-white'
                    )}
                  >
                    <Check className="size-3" />
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-400 text-sm line-through truncate block">
                      {deadline.title}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          'size-2 rounded-full shrink-0 opacity-50',
                          priorityColors[deadline.priority]
                        )}
                      />
                      <span className="text-xs text-gray-600">
                        {priorityLabels[deadline.priority]}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with count */}
        {deadlines.length > 0 && (
          <div className="px-4 py-2 border-t border-border-dark bg-surface-highlight/20">
            <p className="text-xs text-gray-500 text-center">
              {pendingDeadlines.length} pendente{pendingDeadlines.length !== 1 ? 's' : ''}
              {completedDeadlines.length > 0 && ` • ${completedDeadlines.length} concluído${completedDeadlines.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
