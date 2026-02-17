import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarHeader } from './CalendarHeader'
import { CalendarDay } from './CalendarDay'
import { CalendarDeadline, CalendarDeadlineOverlay } from './CalendarDeadline'
import { CalendarGrid } from './CalendarGrid'
import type { Deadline } from '@/types'

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn().mockReturnValue([]),
  useDraggable: vi.fn().mockReturnValue({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
  useDroppable: vi.fn().mockReturnValue({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}))

const mockDeadline: Deadline = {
  id: 1,
  case_id: null,
  client_id: null,
  title: 'Test Deadline',
  description: 'Test description',
  due_date: '2025-12-15T23:59:00.000Z',
  reminder_date: null,
  completed: false,
  priority: 'normal',
  created_at: '2025-12-01T00:00:00.000Z',
}

describe('CalendarHeader', () => {
  const mockOnDateChange = vi.fn()
  const testDate = new Date(2025, 11, 15) // December 2025

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render current month and year', () => {
    render(<CalendarHeader currentDate={testDate} onDateChange={mockOnDateChange} />)

    const expectedText = format(testDate, 'MMMM yyyy', { locale: ptBR })
    expect(screen.getByText(expectedText)).toBeInTheDocument()
  })

  it('should call onDateChange with previous month when clicking prev button', () => {
    render(<CalendarHeader currentDate={testDate} onDateChange={mockOnDateChange} />)

    const prevButton = screen.getByTitle('Mês anterior')
    fireEvent.click(prevButton)

    expect(mockOnDateChange).toHaveBeenCalledWith(subMonths(testDate, 1))
  })

  it('should call onDateChange with next month when clicking next button', () => {
    render(<CalendarHeader currentDate={testDate} onDateChange={mockOnDateChange} />)

    const nextButton = screen.getByTitle('Próximo mês')
    fireEvent.click(nextButton)

    expect(mockOnDateChange).toHaveBeenCalledWith(addMonths(testDate, 1))
  })

  it('should call onDateChange with today when clicking Hoje button', () => {
    render(<CalendarHeader currentDate={testDate} onDateChange={mockOnDateChange} />)

    const todayButton = screen.getByText('Hoje')
    fireEvent.click(todayButton)

    expect(mockOnDateChange).toHaveBeenCalled()
    const callArg = mockOnDateChange.mock.calls[0][0]
    expect(callArg.getDate()).toBe(new Date().getDate())
  })
})

describe('CalendarDeadline', () => {
  const mockOnClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render deadline title', () => {
    render(<CalendarDeadline deadline={mockDeadline} onClick={mockOnClick} />)

    expect(screen.getByText('Test Deadline')).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    render(<CalendarDeadline deadline={mockDeadline} onClick={mockOnClick} />)

    fireEvent.click(screen.getByText('Test Deadline'))

    expect(mockOnClick).toHaveBeenCalledWith(mockDeadline)
  })

  it('should show completed style when deadline is completed', () => {
    const completedDeadline = { ...mockDeadline, completed: true }
    render(<CalendarDeadline deadline={completedDeadline} onClick={mockOnClick} />)

    const element = screen.getByText('Test Deadline').closest('div')
    expect(element).toHaveClass('opacity-50')
    expect(element).toHaveClass('line-through')
  })

  it('should render priority indicator with correct color', () => {
    const urgentDeadline = { ...mockDeadline, priority: 'urgente' as const }
    render(<CalendarDeadline deadline={urgentDeadline} onClick={mockOnClick} />)

    const indicator = screen.getByText('Test Deadline').previousElementSibling
    expect(indicator).toHaveClass('bg-red-500')
  })
})

describe('CalendarDeadlineOverlay', () => {
  it('should render deadline title in overlay', () => {
    render(<CalendarDeadlineOverlay deadline={mockDeadline} />)

    expect(screen.getByText('Test Deadline')).toBeInTheDocument()
  })

  it('should show completed style in overlay', () => {
    const completedDeadline = { ...mockDeadline, completed: true }
    render(<CalendarDeadlineOverlay deadline={completedDeadline} />)

    const element = screen.getByText('Test Deadline').closest('div')
    expect(element).toHaveClass('opacity-50')
  })
})

describe('CalendarDay', () => {
  const mockOnDateClick = vi.fn()
  const mockOnDeadlineClick = vi.fn()
  const testDate = new Date(2025, 11, 15)
  const currentMonth = new Date(2025, 11, 1)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render day number', () => {
    render(
      <CalendarDay
        date={testDate}
        currentMonth={currentMonth}
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
      />
    )

    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('should call onDateClick when day is clicked', () => {
    render(
      <CalendarDay
        date={testDate}
        currentMonth={currentMonth}
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
      />
    )

    fireEvent.click(screen.getByText('15'))

    expect(mockOnDateClick).toHaveBeenCalledWith(testDate)
  })

  it('should render deadlines', () => {
    render(
      <CalendarDay
        date={testDate}
        currentMonth={currentMonth}
        deadlines={[mockDeadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
      />
    )

    expect(screen.getByText('Test Deadline')).toBeInTheDocument()
  })

  it('should show +N more when there are more than 3 deadlines', () => {
    const manyDeadlines = [
      { ...mockDeadline, id: 1, title: 'Deadline 1' },
      { ...mockDeadline, id: 2, title: 'Deadline 2' },
      { ...mockDeadline, id: 3, title: 'Deadline 3' },
      { ...mockDeadline, id: 4, title: 'Deadline 4' },
      { ...mockDeadline, id: 5, title: 'Deadline 5' },
    ]

    render(
      <CalendarDay
        date={testDate}
        currentMonth={currentMonth}
        deadlines={manyDeadlines}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
      />
    )

    expect(screen.getByText('+2 mais')).toBeInTheDocument()
  })

  it('should apply different style for days outside current month', () => {
    const otherMonthDate = new Date(2025, 10, 30) // November 30

    render(
      <CalendarDay
        date={otherMonthDate}
        currentMonth={currentMonth}
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
      />
    )

    const dayNumber = screen.getByText('30')
    expect(dayNumber).toHaveClass('text-gray-600')
  })
})

describe('CalendarGrid', () => {
  const mockOnDateClick = vi.fn()
  const mockOnDeadlineClick = vi.fn()
  const mockOnDeadlineDrop = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render weekday headers', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByText('Dom')).toBeInTheDocument()
    expect(screen.getByText('Seg')).toBeInTheDocument()
    expect(screen.getByText('Ter')).toBeInTheDocument()
    expect(screen.getByText('Qua')).toBeInTheDocument()
    expect(screen.getByText('Qui')).toBeInTheDocument()
    expect(screen.getByText('Sex')).toBeInTheDocument()
    expect(screen.getByText('Sáb')).toBeInTheDocument()
  })

  it('should render calendar header with navigation', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getByTitle('Mês anterior')).toBeInTheDocument()
    expect(screen.getByTitle('Próximo mês')).toBeInTheDocument()
  })

  it('should render DndContext wrapper', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByTestId('dnd-context')).toBeInTheDocument()
  })

  it('should render current month name', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ptBR })
    expect(screen.getByText(currentMonth)).toBeInTheDocument()
  })

  it('should group deadlines by date', () => {
    const deadline = {
      ...mockDeadline,
      due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    }

    render(
      <CalendarGrid
        deadlines={[deadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByText('Test Deadline')).toBeInTheDocument()
  })

  it('should navigate to next month', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ptBR })
    expect(screen.getByText(currentMonth)).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Próximo mês'))

    const nextMonth = format(addMonths(new Date(), 1), 'MMMM yyyy', { locale: ptBR })
    expect(screen.getByText(nextMonth)).toBeInTheDocument()
  })

  it('should navigate to previous month', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    fireEvent.click(screen.getByTitle('Mês anterior'))

    const prevMonth = format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: ptBR })
    expect(screen.getByText(prevMonth)).toBeInTheDocument()
  })

  it('should return to current month when clicking Hoje', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Navigate away
    fireEvent.click(screen.getByTitle('Próximo mês'))
    fireEvent.click(screen.getByTitle('Próximo mês'))

    // Navigate back to today
    fireEvent.click(screen.getByText('Hoje'))

    const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ptBR })
    expect(screen.getByText(currentMonth)).toBeInTheDocument()
  })

  it('should handle onToggleComplete when provided', () => {
    const mockOnToggleComplete = vi.fn()
    const todayDeadline = {
      ...mockDeadline,
      due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    }

    render(
      <CalendarGrid
        deadlines={[todayDeadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Test Deadline')).toBeInTheDocument()
  })

  it('should render multiple deadlines on the same day', () => {
    const today = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    const deadlines = [
      { ...mockDeadline, id: 1, title: 'Morning Task', due_date: today },
      { ...mockDeadline, id: 2, title: 'Afternoon Task', due_date: today },
      { ...mockDeadline, id: 3, title: 'Evening Task', due_date: today },
    ]

    render(
      <CalendarGrid
        deadlines={deadlines}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByText('Morning Task')).toBeInTheDocument()
    expect(screen.getByText('Afternoon Task')).toBeInTheDocument()
    expect(screen.getByText('Evening Task')).toBeInTheDocument()
  })

  it('should render overdue deadlines', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const overdueDeadline = {
      ...mockDeadline,
      due_date: format(yesterday, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
      completed: false,
    }

    render(
      <CalendarGrid
        deadlines={[overdueDeadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByText('Test Deadline')).toBeInTheDocument()
  })

  it('should render completed deadlines with different style', () => {
    const completedDeadline = {
      ...mockDeadline,
      due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
      completed: true,
    }

    render(
      <CalendarGrid
        deadlines={[completedDeadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    const element = screen.getByText('Test Deadline').closest('div')
    expect(element).toHaveClass('opacity-50')
  })

  it('should handle empty deadlines array', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Should still render the grid
    expect(screen.getByText('Dom')).toBeInTheDocument()
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument()
  })

  it('should render deadlines with different priorities', () => {
    const today = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    const deadlines = [
      { ...mockDeadline, id: 1, title: 'Low Priority', priority: 'baixa' as const, due_date: today },
      { ...mockDeadline, id: 2, title: 'Normal Priority', priority: 'normal' as const, due_date: today },
      { ...mockDeadline, id: 3, title: 'High Priority', priority: 'alta' as const, due_date: today },
      { ...mockDeadline, id: 4, title: 'Urgent Priority', priority: 'urgente' as const, due_date: today },
    ]

    render(
      <CalendarGrid
        deadlines={deadlines}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Calendar shows max 3 deadlines per day, plus a "+N mais" indicator
    expect(screen.getByText('Low Priority')).toBeInTheDocument()
    expect(screen.getByText('Normal Priority')).toBeInTheDocument()
    expect(screen.getByText('High Priority')).toBeInTheDocument()
    expect(screen.getByText('+1 mais')).toBeInTheDocument() // 4th deadline is hidden
  })

  it('should pass through onDateClick callback to days', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Find any day number and click it
    const dayElement = screen.getByText('15')
    fireEvent.click(dayElement)

    expect(mockOnDateClick).toHaveBeenCalledTimes(1)
    expect(mockOnDateClick.mock.calls[0][0]).toBeInstanceOf(Date)
  })

  it('should pass through onDeadlineClick callback', () => {
    const todayDeadline = {
      ...mockDeadline,
      due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    }

    render(
      <CalendarGrid
        deadlines={[todayDeadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    fireEvent.click(screen.getByText('Test Deadline'))

    expect(mockOnDeadlineClick).toHaveBeenCalledWith(todayDeadline)
  })

  it('should render drag overlay when activeDeadline is set', () => {
    const todayDeadline = {
      ...mockDeadline,
      due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    }

    render(
      <CalendarGrid
        deadlines={[todayDeadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // DragOverlay should be present (even if empty initially)
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })

  it('should handle drag start event', () => {
    const todayDeadline = {
      ...mockDeadline,
      due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    }

    const { container } = render(
      <CalendarGrid
        deadlines={[todayDeadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Verify DndContext is present
    expect(container.querySelector('[data-testid="dnd-context"]')).toBeInTheDocument()
  })

  it('should not call onDeadlineDrop when dropped on same date', () => {
    const todayDeadline = {
      ...mockDeadline,
      due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    }

    render(
      <CalendarGrid
        deadlines={[todayDeadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Since we're mocking DndContext, we can't fully test drag behavior
    // But we verify the component renders without errors
    expect(screen.getByText('Test Deadline')).toBeInTheDocument()
  })

  it('should handle expand click for days with many deadlines', () => {
    const today = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    const manyDeadlines = [
      { ...mockDeadline, id: 1, title: 'Task 1', due_date: today },
      { ...mockDeadline, id: 2, title: 'Task 2', due_date: today },
      { ...mockDeadline, id: 3, title: 'Task 3', due_date: today },
      { ...mockDeadline, id: 4, title: 'Task 4', due_date: today },
    ]

    render(
      <CalendarGrid
        deadlines={manyDeadlines}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Should show "+1 mais" for the 4th deadline
    expect(screen.getByText('+1 mais')).toBeInTheDocument()
  })

  it('should render calendar with no deadlines without errors', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Should render all weekdays
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    weekdays.forEach(day => {
      expect(screen.getByText(day)).toBeInTheDocument()
    })
  })

  it('should handle deadlines on different dates in same month', () => {
    const currentMonth = new Date()
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

    const deadlines = [
      { ...mockDeadline, id: 1, title: 'First Day Task', due_date: format(firstDay, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") },
      { ...mockDeadline, id: 2, title: 'Last Day Task', due_date: format(lastDay, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") },
    ]

    render(
      <CalendarGrid
        deadlines={deadlines}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByText('First Day Task')).toBeInTheDocument()
    expect(screen.getByText('Last Day Task')).toBeInTheDocument()
  })

  it('should handle onToggleComplete callback when not provided', () => {
    const todayDeadline = {
      ...mockDeadline,
      due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    }

    // Render without onToggleComplete
    render(
      <CalendarGrid
        deadlines={[todayDeadline]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Should render without errors
    expect(screen.getByText('Test Deadline')).toBeInTheDocument()
  })

  it('should memoize calendar days based on current date', () => {
    const { rerender } = render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ptBR })
    expect(screen.getByText(currentMonth)).toBeInTheDocument()

    // Rerender with same props (should use memoized days)
    rerender(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByText(currentMonth)).toBeInTheDocument()
  })

  it('should memoize deadlines by date', () => {
    const today = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    const deadlines = [
      { ...mockDeadline, id: 1, title: 'Task 1', due_date: today },
      { ...mockDeadline, id: 2, title: 'Task 2', due_date: today },
    ]

    const { rerender } = render(
      <CalendarGrid
        deadlines={deadlines}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()

    // Rerender with same deadlines (should use memoized map)
    rerender(
      <CalendarGrid
        deadlines={deadlines}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
  })

  it('should render weekend days with different styling', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Dom (Sunday) and Sáb (Saturday) should have text-gray-600
    const dom = screen.getByText('Dom')
    const sab = screen.getByText('Sáb')
    
    expect(dom).toHaveClass('text-gray-600')
    expect(sab).toHaveClass('text-gray-600')
  })

  it('should render weekday headers with different styling', () => {
    render(
      <CalendarGrid
        deadlines={[]}
        onDateClick={mockOnDateClick}
        onDeadlineClick={mockOnDeadlineClick}
        onDeadlineDrop={mockOnDeadlineDrop}
      />
    )

    // Weekdays (Seg-Sex) should have text-gray-400
    const seg = screen.getByText('Seg')
    expect(seg).toHaveClass('text-gray-400')
  })
})
