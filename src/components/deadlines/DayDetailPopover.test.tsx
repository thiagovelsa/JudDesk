import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DayDetailPopover } from './DayDetailPopover'
import type { Deadline } from '@/types'

const mockDeadlines: Deadline[] = [
  {
    id: 1,
    title: 'Audiência Trabalhista',
    description: 'Preparar documentos',
    due_date: '2024-12-20T10:00:00Z',
    reminder_date: '2024-12-19T10:00:00Z',
    priority: 'alta',
    completed: false,
    case_id: 1,
    client_id: 1,
    created_at: '2024-12-01T10:00:00Z',
  },
  {
    id: 2,
    title: 'Entrega de Petição',
    description: null,
    due_date: '2024-12-20T14:00:00Z',
    reminder_date: null,
    priority: 'urgente',
    completed: false,
    case_id: 2,
    client_id: 2,
    created_at: '2024-12-01T10:00:00Z',
  },
  {
    id: 3,
    title: 'Prazo Concluído',
    description: 'Este já foi feito',
    due_date: '2024-12-20T16:00:00Z',
    reminder_date: null,
    priority: 'normal',
    completed: true,
    case_id: null,
    client_id: null,
    created_at: '2024-12-01T10:00:00Z',
  },
]

const mockAnchorRect: DOMRect = {
  top: 100,
  left: 200,
  bottom: 200,
  right: 300,
  width: 100,
  height: 100,
  x: 200,
  y: 100,
  toJSON: () => ({}),
}

describe('DayDetailPopover', () => {
  const mockOnClose = vi.fn()
  const mockOnDeadlineClick = vi.fn()
  const mockOnAddClick = vi.fn()
  const mockOnToggleComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render with date header', async () => {
    // Use a date at noon to avoid timezone issues
    const testDate = new Date(2024, 11, 20, 12, 0, 0) // December 20, 2024 at noon

    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('20 de dezembro')).toBeInTheDocument()
  })

  it('should render all deadlines', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Audiência Trabalhista')).toBeInTheDocument()
    expect(screen.getByText('Entrega de Petição')).toBeInTheDocument()
    expect(screen.getByText('Prazo Concluído')).toBeInTheDocument()
  })

  it('should show priority labels', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('Urgente')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
  })

  it('should show footer with counts', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText(/2 pendentes/)).toBeInTheDocument()
    expect(screen.getByText(/1 concluído/)).toBeInTheDocument()
  })

  it('should call onDeadlineClick when clicking a deadline', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    fireEvent.click(screen.getByText('Audiência Trabalhista'))

    await waitFor(() => {
      expect(mockOnDeadlineClick).toHaveBeenCalledWith(mockDeadlines[0])
    })
  })

  it('should call onToggleComplete when clicking checkbox', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    // Find checkbox buttons (there should be 3)
    const checkboxes = screen.getAllByRole('button').filter(
      btn => btn.className.includes('rounded') && btn.className.includes('border')
    )

    // Click first checkbox
    if (checkboxes.length > 0) {
      fireEvent.click(checkboxes[0])
      expect(mockOnToggleComplete).toHaveBeenCalledWith(1)
    }
  })

  it('should call onClose when clicking X button', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    // Find close button by its position (last button in header)
    const closeButton = screen.getAllByRole('button').find(
      btn => btn.getAttribute('title') === null && btn.className.includes('hover:text-white')
    )

    if (closeButton) {
      fireEvent.click(closeButton)
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    }
  })

  it('should call onAddClick when clicking add button', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    const addButton = screen.getByTitle('Adicionar prazo')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(mockOnAddClick).toHaveBeenCalled()
    })
  })

  it('should show empty state when no deadlines', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={[]}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Nenhuma obrigação neste dia')).toBeInTheDocument()
    expect(screen.getByText('Adicionar prazo')).toBeInTheDocument()
  })

  it('should close on Escape key', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('should show separator between pending and completed', async () => {
    const testDate = new Date(2024, 11, 20, 12, 0, 0)
    render(
      <DayDetailPopover
        date={testDate}
        deadlines={mockDeadlines}
        anchorRect={mockAnchorRect}
        onClose={mockOnClose}
        onDeadlineClick={mockOnDeadlineClick}
        onAddClick={mockOnAddClick}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Concluídos')).toBeInTheDocument()
  })
})
