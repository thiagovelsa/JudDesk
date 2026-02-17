import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeadlineDetailModal } from './DeadlineDetailModal'
import type { Deadline } from '@/types'

// Mock stores
vi.mock('@/stores/clientStore', () => ({
  useClientStore: () => ({
    clients: [
      { id: 1, name: 'João Silva', email: 'joao@email.com' },
      { id: 2, name: 'Maria Santos', email: 'maria@email.com' },
    ],
  }),
}))

vi.mock('@/stores/caseStore', () => ({
  useCaseStore: () => ({
    cases: [
      { id: 1, title: 'Processo Trabalhista', number: '0001234-56.2024.5.01.0001', client_id: 1 },
      { id: 2, title: 'Ação de Cobrança', number: '0005678-90.2024.8.19.0001', client_id: 2 },
    ],
  }),
}))

const mockDeadline: Deadline = {
  id: 1,
  title: 'Audiência de Instrução',
  description: 'Preparar testemunhas e documentos para audiência',
  due_date: '2024-12-20T14:00:00Z',
  reminder_date: '2024-12-19T09:00:00Z',
  priority: 'alta',
  completed: false,
  case_id: 1,
  client_id: 1,
      created_at: '2024-12-01T10:00:00Z',
    }
const mockCompletedDeadline: Deadline = {
  ...mockDeadline,
  id: 2,
  completed: true,
}

describe('DeadlineDetailModal', () => {
  const mockOnClose = vi.fn()
  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnToggleComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render deadline title', () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Audiência de Instrução')).toBeInTheDocument()
  })

  it('should render deadline description', () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Preparar testemunhas e documentos para audiência')).toBeInTheDocument()
  })

  it('should render priority badge', () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Alta')).toBeInTheDocument()
  })

  it('should render client name when linked', () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('João Silva')).toBeInTheDocument()
  })

  it('should render case title when linked', () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Processo Trabalhista')).toBeInTheDocument()
  })

  it('should show "Concluído" badge for completed deadline', () => {
    render(
      <DeadlineDetailModal
        deadline={mockCompletedDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Concluído')).toBeInTheDocument()
  })

  it('should call onClose when clicking X button', async () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    const closeButtons = screen.getAllByRole('button')
    const xButton = closeButtons.find(btn =>
      btn.querySelector('svg.lucide-x')
    )

    if (xButton) {
      fireEvent.click(xButton)
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    }
  })

  it('should call onEdit when clicking edit button', async () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    const editButton = screen.getByText('Editar')
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(mockOnEdit).toHaveBeenCalledWith(mockDeadline)
    })
  })

  it('should show delete confirmation when clicking delete', () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    const deleteButton = screen.getByText('Excluir')
    fireEvent.click(deleteButton)

    expect(screen.getByText('Excluir Prazo')).toBeInTheDocument()
    expect(screen.getByText(/Tem certeza que deseja excluir/)).toBeInTheDocument()
  })

  it('should call onDelete after confirming deletion', async () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    // Click delete to show confirmation
    fireEvent.click(screen.getByText('Excluir'))

    // Find and click confirm button in the confirmation dialog
    const confirmButtons = screen.getAllByText('Excluir')
    const confirmButton = confirmButtons[confirmButtons.length - 1]
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith(mockDeadline)
    })
  })

  it('should call onToggleComplete when clicking complete button', () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    const completeButton = screen.getByText('Marcar como Concluído')
    fireEvent.click(completeButton)

    expect(mockOnToggleComplete).toHaveBeenCalledWith(1)
  })

  it('should show "Desmarcar" for completed deadline', () => {
    render(
      <DeadlineDetailModal
        deadline={mockCompletedDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Desmarcar')).toBeInTheDocument()
  })

  it('should render reminder date when present', () => {
    render(
      <DeadlineDetailModal
        deadline={mockDeadline}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.getByText('Lembrete')).toBeInTheDocument()
  })

  it('should not render reminder when not present', () => {
    const deadlineWithoutReminder = { ...mockDeadline, reminder_date: null }

    render(
      <DeadlineDetailModal
        deadline={deadlineWithoutReminder}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleComplete={mockOnToggleComplete}
      />
    )

    expect(screen.queryByText('Lembrete')).not.toBeInTheDocument()
  })
})
