import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarHeader } from './CalendarHeader'
import { CalendarDay } from './CalendarDay'
import { CalendarDeadlineOverlay } from './CalendarDeadline'
import { DayDetailPopover } from './DayDetailPopover'
import type { Deadline } from '@/types'

interface CalendarGridProps {
  deadlines: Deadline[]
  onDateClick: (date: Date) => void
  onDeadlineClick: (deadline: Deadline) => void
  onDeadlineDrop: (deadlineId: number, newDate: Date) => void
  onToggleComplete?: (id: number) => void
}

interface ExpandedDay {
  date: Date
  deadlines: Deadline[]
  anchorRect: DOMRect
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function getDeadlineDateKey(dueDate: string): string {
  // Preserve calendar day across timezones by using the raw ISO date part when possible.
  const isoDatePart = dueDate.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDatePart)) {
    return isoDatePart
  }

  return format(new Date(dueDate), 'yyyy-MM-dd')
}

export function CalendarGrid({
  deadlines,
  onDateClick,
  onDeadlineClick,
  onDeadlineDrop,
  onToggleComplete,
}: CalendarGridProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activeDeadline, setActiveDeadline] = useState<Deadline | null>(null)
  const [expandedDay, setExpandedDay] = useState<ExpandedDay | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { locale: ptBR })
    const calendarEnd = endOfWeek(monthEnd, { locale: ptBR })

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentDate])

  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, Deadline[]>()

    deadlines.forEach((deadline) => {
      const dateKey = getDeadlineDateKey(deadline.due_date)
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(deadline)
    })

    return map
  }, [deadlines])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const deadline = active.data.current?.deadline as Deadline | undefined
    if (deadline) {
      setActiveDeadline(deadline)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDeadline(null)

    if (!over) return

    const deadline = active.data.current?.deadline as Deadline | undefined
    const dropDate = over.data.current?.date as Date | undefined

    if (deadline && dropDate) {
      const currentDueDate = new Date(deadline.due_date)
      if (!isSameDay(currentDueDate, dropDate)) {
        onDeadlineDrop(deadline.id, dropDate)
      }
    }
  }

  const handleExpandClick = (date: Date, dayDeadlines: Deadline[], rect: DOMRect) => {
    setExpandedDay({ date, deadlines: dayDeadlines, anchorRect: rect })
  }

  const handleClosePopover = () => {
    setExpandedDay(null)
  }

  const handlePopoverToggleComplete = (id: number) => {
    onToggleComplete?.(id)
    // Atualiza as deadlines no popover após toggle
    if (expandedDay) {
      const updatedDeadlines = expandedDay.deadlines.map(d =>
        d.id === id ? { ...d, completed: !d.completed } : d
      )
      setExpandedDay({ ...expandedDay, deadlines: updatedDeadlines })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border-dark">
          <CalendarHeader
            currentDate={currentDate}
            onDateChange={setCurrentDate}
          />
        </div>

        <div className="grid grid-cols-7">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={`
                px-2 py-3 text-center text-xs font-medium uppercase tracking-wide
                border-r border-b border-border-dark last:border-r-0
                ${index === 0 || index === 6 ? 'text-gray-600' : 'text-gray-400'}
              `}
            >
              {day}
            </div>
          ))}

          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayDeadlines = deadlinesByDate.get(dateKey) || []

            return (
              <CalendarDay
                key={dateKey}
                date={day}
                currentMonth={currentDate}
                deadlines={dayDeadlines}
                onDateClick={onDateClick}
                onDeadlineClick={onDeadlineClick}
                onExpandClick={handleExpandClick}
              />
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {activeDeadline && (
          <CalendarDeadlineOverlay deadline={activeDeadline} />
        )}
      </DragOverlay>

      {/* Day Detail Popover */}
      {expandedDay && (
        <DayDetailPopover
          date={expandedDay.date}
          deadlines={expandedDay.deadlines}
          anchorRect={expandedDay.anchorRect}
          onClose={handleClosePopover}
          onDeadlineClick={onDeadlineClick}
          onAddClick={onDateClick}
          onToggleComplete={handlePopoverToggleComplete}
        />
      )}
    </DndContext>
  )
}
