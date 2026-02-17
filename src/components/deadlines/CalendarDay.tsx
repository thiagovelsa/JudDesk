import { useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { isToday, isSameMonth, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { CalendarDeadline } from './CalendarDeadline'
import type { Deadline } from '@/types'

interface CalendarDayProps {
  date: Date
  currentMonth: Date
  deadlines: Deadline[]
  onDateClick: (date: Date) => void
  onDeadlineClick: (deadline: Deadline) => void
  onExpandClick?: (date: Date, deadlines: Deadline[], rect: DOMRect) => void
}

const MAX_VISIBLE_DEADLINES = 3

export function CalendarDay({
  date,
  currentMonth,
  deadlines,
  onDateClick,
  onDeadlineClick,
  onExpandClick,
}: CalendarDayProps) {
  const dayRef = useRef<HTMLDivElement>(null)
  const dateStr = format(date, 'yyyy-MM-dd')
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr}`,
    data: { date },
  })

  const isCurrentMonth = isSameMonth(date, currentMonth)
  const isTodayDate = isToday(date)
  const dayNumber = date.getDate()
  const isWeekend = date.getDay() === 0 || date.getDay() === 6

  const visibleDeadlines = deadlines.slice(0, MAX_VISIBLE_DEADLINES)
  const extraCount = deadlines.length - MAX_VISIBLE_DEADLINES

  const hasOverdue = deadlines.some((d) => {
    const dueDate = new Date(d.due_date)
    return !d.completed && dueDate < new Date() && format(dueDate, 'yyyy-MM-dd') === dateStr
  })

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onExpandClick && dayRef.current) {
      const rect = dayRef.current.getBoundingClientRect()
      onExpandClick(date, deadlines, rect)
    }
  }

  const handleDayClick = () => {
    // Se tem obrigações e a função de expandir existe, expande
    // Caso contrário, abre o formulário de criação
    if (deadlines.length > 0 && onExpandClick && dayRef.current) {
      const rect = dayRef.current.getBoundingClientRect()
      onExpandClick(date, deadlines, rect)
    } else {
      onDateClick(date)
    }
  }

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        if (node) (dayRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      onClick={handleDayClick}
      className={cn(
        'min-h-[100px] p-1.5 border-r border-b border-border-dark cursor-pointer transition-colors',
        'hover:bg-surface-highlight/50',
        !isCurrentMonth && 'bg-surface-dark/30',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-inset',
        isTodayDate && 'bg-primary/5'
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'size-7 flex items-center justify-center rounded-full text-sm font-medium',
            !isCurrentMonth && 'text-gray-600',
            isCurrentMonth && !isTodayDate && (isWeekend ? 'text-gray-500' : 'text-gray-300'),
            isTodayDate && 'bg-primary text-white'
          )}
        >
          {dayNumber}
        </span>
        {hasOverdue && (
          <span className="size-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>

      <div className="space-y-0.5">
        {visibleDeadlines.map((deadline) => (
          <CalendarDeadline
            key={deadline.id}
            deadline={deadline}
            onClick={onDeadlineClick}
          />
        ))}
        {extraCount > 0 && (
          <button
            onClick={handleExpandClick}
            className={cn(
              'text-xs text-primary pl-1.5 hover:text-primary-light transition-colors',
              'hover:underline focus:outline-none'
            )}
          >
            +{extraCount} mais
          </button>
        )}
      </div>
    </div>
  )
}
