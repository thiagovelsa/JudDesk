import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { Deadline } from '@/types'

interface CalendarDeadlineProps {
  deadline: Deadline
  onClick: (deadline: Deadline) => void
}

// Cores do indicador de prioridade
const priorityDotColors: Record<Deadline['priority'], string> = {
  baixa: 'bg-gray-500',
  normal: 'bg-blue-500',
  alta: 'bg-amber-500',
  urgente: 'bg-red-500',
}

// Cores de fundo no hover (sutis)
const priorityHoverBg: Record<Deadline['priority'], string> = {
  baixa: 'hover:bg-gray-500/20',
  normal: 'hover:bg-blue-500/20',
  alta: 'hover:bg-amber-500/20',
  urgente: 'hover:bg-red-500/20',
}

// Cores da borda no hover
const priorityHoverBorder: Record<Deadline['priority'], string> = {
  baixa: 'hover:border-gray-500/50',
  normal: 'hover:border-blue-500/50',
  alta: 'hover:border-amber-500/50',
  urgente: 'hover:border-red-500/50',
}

// Cores do texto no hover
const priorityHoverText: Record<Deadline['priority'], string> = {
  baixa: 'group-hover:text-gray-100',
  normal: 'group-hover:text-blue-100',
  alta: 'group-hover:text-amber-100',
  urgente: 'group-hover:text-red-100',
}

export function CalendarDeadline({ deadline, onClick }: CalendarDeadlineProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `deadline-${deadline.id}`,
    data: { deadline },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onClick(deadline)
      }}
      title={`${deadline.title}${deadline.description ? ` - ${deadline.description}` : ''}`}
      className={cn(
        'group flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs cursor-pointer',
        'border border-transparent',
        'transition-all duration-150 ease-out',
        'hover:scale-[1.02] hover:shadow-md hover:-translate-y-px',
        priorityHoverBg[deadline.priority],
        priorityHoverBorder[deadline.priority],
        isDragging && 'opacity-50 z-50 scale-105 shadow-lg',
        deadline.completed && 'opacity-50 line-through hover:opacity-70'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full shrink-0 transition-transform duration-150',
          'group-hover:scale-125',
          priorityDotColors[deadline.priority]
        )}
      />
      <span
        className={cn(
          'truncate text-gray-200 transition-colors duration-150',
          priorityHoverText[deadline.priority]
        )}
      >
        {deadline.title}
      </span>
    </div>
  )
}

export function CalendarDeadlineOverlay({ deadline }: { deadline: Deadline }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-surface-dark border border-border-dark shadow-lg',
        deadline.completed && 'opacity-50 line-through'
      )}
    >
      <span
        className={cn(
          'size-2 rounded-full shrink-0',
          priorityDotColors[deadline.priority]
        )}
      />
      <span className="text-white font-medium">{deadline.title}</span>
    </div>
  )
}
