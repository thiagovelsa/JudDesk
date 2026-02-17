import { useState, useEffect, useRef } from 'react'
import { X, Upload, FileText, Trash2, Loader2 } from 'lucide-react'
import { useDocumentStore } from '@/stores/documentStore'
import { useFolderStore } from '@/stores/folderStore'
import { removeStoredDocumentFile, saveClientDocumentFile } from '@/lib/documentStorage'
import type { Client, Document } from '@/types'

interface ClientFormData {
  name: string
  cpf_cnpj: string
  email: string
  phone: string
  address: string
  notes: string
}

interface PendingFile {
  file: File
  id: string // Unique ID for React key
}

interface ClientFormProps {
  client?: Client | null
  onSave: (data: ClientFormData) => Promise<Client | void>
  onClose: () => void
}

// Accepted file types
const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt']

export function ClientForm({ client, onSave, onClose }: ClientFormProps) {
  const { documents, createDocument, deleteDocument } = useDocumentStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    cpf_cnpj: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // File management states
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [clientDocuments, setClientDocuments] = useState<Document[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null)

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        cpf_cnpj: client.cpf_cnpj || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        notes: client.notes || '',
      })
    }
  }, [client])

  // Load existing documents when editing a client
  useEffect(() => {
    if (client?.id) {
      const clientDocs = documents.filter(d => d.client_id === client.id)
      setClientDocuments(clientDocs)
    }
  }, [client?.id, documents])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Save client first
      const savedClient = await onSave(formData)

      // If we have pending files and a client ID, create documents in client's folder
      if (pendingFiles.length > 0) {
        const clientId = client?.id || (savedClient as Client)?.id
        if (!clientId) {
          console.error('[ClientForm] Cannot upload files: client ID not available')
        } else {
          setUploadingFiles(true)
          const failedUploads: string[] = []
          const failedPendingIds = new Set<string>()
          const uploadedPendingIds = new Set<string>()

          // Get the client's folder (already created by createClient)
          const clientFolder = await useFolderStore.getState().getClientFolder(clientId)

          for (const pending of pendingFiles) {
            let storedPath: string | null = null
            try {
              storedPath = await saveClientDocumentFile(clientId, pending.file)
              await createDocument({
                client_id: clientId,
                name: pending.file.name,
                file_path: storedPath,
                folder_id: clientFolder?.id || null,
              })
              uploadedPendingIds.add(pending.id)
            } catch (fileError) {
              failedUploads.push(pending.file.name)
              failedPendingIds.add(pending.id)
              if (storedPath) {
                await removeStoredDocumentFile(storedPath)
              }
              console.error('[ClientForm] Failed to upload document:', fileError)
            }
          }

          if (failedUploads.length > 0) {
            setPendingFiles((prev) =>
              prev.filter((pending) => failedPendingIds.has(pending.id))
            )
            setError(`Falha ao anexar: ${failedUploads.join(', ')}`)
            return
          }

          if (uploadedPendingIds.size > 0) {
            setPendingFiles((prev) =>
              prev.filter((pending) => !uploadedPendingIds.has(pending.id))
            )
          }
          setUploadingFiles(false)
        }
      }

      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setUploadingFiles(false)
    }
  }

  const handleChange = (field: keyof ClientFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // File handling functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const validFiles: PendingFile[] = []
    const invalidFiles: string[] = []

    Array.from(files).forEach(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (ACCEPTED_EXTENSIONS.includes(ext)) {
        validFiles.push({
          file,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })
      } else {
        invalidFiles.push(file.name)
      }
    })

    if (invalidFiles.length > 0) {
      setError(`Arquivos não suportados: ${invalidFiles.join(', ')}. Use: ${ACCEPTED_EXTENSIONS.join(', ')}`)
    }

    if (validFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...validFiles])
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id))
  }

  const removeExistingDocument = async (docId: number) => {
    setDeletingDocId(docId)
    try {
      await deleteDocument(docId)
      setClientDocuments(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeletingDocId(null)
    }
  }

  const getFileIcon = (_filename: string) => {
    return <FileText className="size-4 text-blue-400" />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-lg mx-4 shadow-lg max-h-[90vh] flex flex-col motion-overlay-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-[var(--space-modal)] border-b border-border-dark">
          <h2 className="text-lg font-semibold text-white">
            {client ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-highlight rounded transition-colors"
          >
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-[var(--space-modal)] space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Nome *
            </label>
            <input
              id="client-name"
              name="clientName"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Nome completo ou razão social"
              className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              CPF/CNPJ
            </label>
            <input
              id="client-document"
              name="clientDocument"
              type="text"
              value={formData.cpf_cnpj}
              onChange={(e) => handleChange('cpf_cnpj', e.target.value)}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Email
              </label>
              <input
                id="client-email"
                name="clientEmail"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Telefone
              </label>
              <input
                id="client-phone"
                name="clientPhone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Endereço
            </label>
            <input
              id="client-address"
              name="clientAddress"
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Rua, número, bairro, cidade/UF"
              className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Observações
            </label>
            <textarea
              id="client-notes"
              name="clientNotes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Notas sobre o cliente..."
              rows={3}
              className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm resize-none"
            />
          </div>

          {/* Documents Section */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Documentos
            </label>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept={ACCEPTED_EXTENSIONS.join(',')}
              multiple
              className="hidden"
            />

            {/* Add file button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-border-dark rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-all text-sm w-full justify-center mb-3"
            >
              <Upload className="size-4" />
              Anexar Arquivo
            </button>

            {/* List of existing documents (edit mode) */}
            {clientDocuments.length > 0 && (
              <div className="space-y-2 mb-2">
                {clientDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-3 py-2 bg-surface-highlight rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(doc.name)}
                      <span className="text-sm text-gray-300 truncate">{doc.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExistingDocument(doc.id)}
                      disabled={deletingDocId === doc.id}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      {deletingDocId === doc.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* List of pending files (new uploads) */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {pendingFiles.map(pending => (
                  <div
                    key={pending.id}
                    className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(pending.file.name)}
                      <span className="text-sm text-gray-300 truncate">{pending.file.name}</span>
                      <span className="text-xs text-blue-400">(novo)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(pending.id)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {clientDocuments.length === 0 && pendingFiles.length === 0 && (
              <p className="text-xs text-gray-500 text-center">
                Nenhum documento anexado
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || uploadingFiles}
              className="px-4 py-2.5 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {(loading || uploadingFiles) && <Loader2 className="size-4 animate-spin" />}
              {uploadingFiles ? 'Enviando arquivos...' : loading ? 'Salvando...' : client ? 'Salvar' : 'Criar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
