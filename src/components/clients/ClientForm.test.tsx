import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Client, Document } from '@/types'

// Mock pdfjs-dist before modules that import it
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

// Mock documentStore
const mockDocuments: Document[] = []
const mockDocumentStore = {
  documents: mockDocuments,
  createDocument: vi.fn().mockResolvedValue({ id: 1 }),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  fetchDocuments: vi.fn(),
}

const mockSaveClientDocumentFile = vi.fn().mockResolvedValue('/mock/path/document.pdf')
const mockRemoveStoredDocumentFile = vi.fn().mockResolvedValue(undefined)
const mockGetClientFolder = vi.fn().mockResolvedValue({ id: 99 })

vi.mock('@/stores/documentStore', () => ({
  useDocumentStore: vi.fn(() => mockDocumentStore),
}))

vi.mock('@/stores/folderStore', () => ({
  useFolderStore: {
    getState: () => ({
      getClientFolder: mockGetClientFolder,
    }),
  },
}))

vi.mock('@/lib/documentStorage', () => ({
  saveClientDocumentFile: (...args: unknown[]) => mockSaveClientDocumentFile(...args),
  removeStoredDocumentFile: (...args: unknown[]) => mockRemoveStoredDocumentFile(...args),
}))

let ClientForm: typeof import('./ClientForm').ClientForm

const mockClient: Client = {
  id: 1,
  name: 'João Silva',
  cpf_cnpj: '123.456.789-00',
  email: 'joao@example.com',
  phone: '(11) 99999-9999',
  address: 'Rua Teste, 123',
  notes: 'Cliente VIP',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
}

describe('ClientForm', () => {
  const mockOnSave = vi.fn()
  const mockOnClose = vi.fn()

  beforeAll(async () => {
    ;({ ClientForm } = await import('./ClientForm'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSave.mockResolvedValue({ id: 1, name: 'Test' })
    mockDocumentStore.createDocument.mockResolvedValue({ id: 1 })
  })

  describe('Rendering', () => {
    it('should render form with all fields', () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      expect(screen.getByText('Novo Cliente')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Nome completo ou razão social')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/000\.000\.000-00/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
      expect(screen.getByText('Documentos')).toBeInTheDocument()
    })

    it('should render edit mode when client is provided', () => {
      render(<ClientForm client={mockClient} onSave={mockOnSave} onClose={mockOnClose} />)

      expect(screen.getByText('Editar Cliente')).toBeInTheDocument()
      expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument()
    })

    it('should render file upload button', () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      expect(screen.getByText('Anexar Arquivo')).toBeInTheDocument()
    })

    it('should show empty documents message when no documents', () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      expect(screen.getByText('Nenhum documento anexado')).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should show error when name is empty', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const submitButton = screen.getByText('Criar Cliente')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument()
      })
      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should call onSave with form data when valid', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social')
      fireEvent.change(nameInput, { target: { value: 'Maria Santos' } })

      const submitButton = screen.getByText('Criar Cliente')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          name: 'Maria Santos',
          cpf_cnpj: '',
          email: '',
          phone: '',
          address: '',
          notes: '',
        })
      })
    })
  })

  describe('File Upload', () => {
    it('should add pending file when valid file is selected', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument()
        expect(screen.getByText('(novo)')).toBeInTheDocument()
      })
    })

    it('should show error for invalid file types', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/Arquivos não suportados/)).toBeInTheDocument()
      })
    })

    it('should accept .pdf files', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument()
      })
    })

    it('should accept .doc files', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const file = new File(['content'], 'test.doc', { type: 'application/msword' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('test.doc')).toBeInTheDocument()
      })
    })

    it('should accept .docx files', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const file = new File(['content'], 'test.docx', { type: 'application/vnd.openxmlformats' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('test.docx')).toBeInTheDocument()
      })
    })

    it('should accept .txt files', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument()
      })
    })

    it('should reject unsupported file extensions', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const file = new File(['content'], 'image.png', { type: 'image/png' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/Arquivos não suportados: image.png/)).toBeInTheDocument()
      })
    })

    it('should allow adding multiple files', async () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      // Add first file
      const file1 = new File(['content'], 'doc1.pdf', { type: 'application/pdf' })
      Object.defineProperty(fileInput, 'files', { value: [file1], configurable: true })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('doc1.pdf')).toBeInTheDocument()
      })

      // Add second file
      const file2 = new File(['content'], 'doc2.txt', { type: 'text/plain' })
      Object.defineProperty(fileInput, 'files', { value: [file2], configurable: true })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('doc1.pdf')).toBeInTheDocument()
        expect(screen.getByText('doc2.txt')).toBeInTheDocument()
      })
    })
  })

  describe('Upload rollback', () => {
    it('should keep modal open and rollback file when document creation fails', async () => {
      mockDocumentStore.createDocument.mockRejectedValueOnce(new Error('DB insert failed'))

      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const file = new File(['content'], 'failing.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('failing.pdf')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social')
      fireEvent.change(nameInput, { target: { value: 'Cliente Teste' } })
      fireEvent.click(screen.getByText('Criar Cliente'))

      await waitFor(() => {
        expect(screen.getByText(/Falha ao anexar: failing\.pdf/)).toBeInTheDocument()
      })

      expect(mockOnClose).not.toHaveBeenCalled()
      expect(mockRemoveStoredDocumentFile).toHaveBeenCalledWith('/mock/path/document.pdf')
    })
  })

  describe('Modal Behavior', () => {
    it('should call onClose when clicking backdrop', () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const backdrop = document.querySelector('.backdrop-blur-sm')
      if (backdrop) {
        fireEvent.click(backdrop)
      }

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should call onClose when clicking Cancel button', () => {
      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const cancelButton = screen.getByText('Cancelar')
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('should show loading state during submission', async () => {
      mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social')
      fireEvent.change(nameInput, { target: { value: 'Test' } })

      const submitButton = screen.getByText('Criar Cliente')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Salvando...')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when save fails', async () => {
      mockOnSave.mockRejectedValue(new Error('Erro de conexão'))

      render(<ClientForm onSave={mockOnSave} onClose={mockOnClose} />)

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social')
      fireEvent.change(nameInput, { target: { value: 'Test' } })

      const submitButton = screen.getByText('Criar Cliente')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Erro de conexão')).toBeInTheDocument()
      })
    })
  })

  describe('Edit Mode', () => {
    it('should populate form with client data', () => {
      render(<ClientForm client={mockClient} onSave={mockOnSave} onClose={mockOnClose} />)

      expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument()
      expect(screen.getByDisplayValue('123.456.789-00')).toBeInTheDocument()
      expect(screen.getByDisplayValue('joao@example.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('(11) 99999-9999')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Rua Teste, 123')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Cliente VIP')).toBeInTheDocument()
    })

    it('should show Salvar button in edit mode', () => {
      render(<ClientForm client={mockClient} onSave={mockOnSave} onClose={mockOnClose} />)

      expect(screen.getByText('Salvar')).toBeInTheDocument()
    })
  })
})
