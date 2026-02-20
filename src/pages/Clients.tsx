import { useState, useEffect, memo, useCallback, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Search, MoreHorizontal, Phone, Mail, FileText, Pencil, Trash2, Loader2, Briefcase, X, ChevronRight, Upload, AlertCircle } from 'lucide-react'
import { FixedSizeGrid as Grid } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import { cn, formatCPFCNPJ, formatPhone } from '@/lib/utils'
import { saveClientDocumentFile } from '@/lib/documentStorage'
import { Button, Card } from '@/components/ui'
import { useClientStore } from '@/stores/clientStore'
import { useCaseStore } from '@/stores/caseStore'
import { useDocumentStore } from '@/stores/documentStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { ClientForm } from '@/components/clients/ClientForm'
import { CaseForm } from '@/components/cases/CaseForm'
import type { Client, Case, Document } from '@/types'

/** Threshold for enabling virtualization */
const VIRTUALIZATION_THRESHOLD = 50

// Memoized client card component
interface ClientCardProps {
  client: Client
  isSelected: boolean
  showMenu: boolean
  caseCount: number
  onSelect: () => void
  onToggleMenu: () => void
  onEdit: () => void
  onDelete: () => void
}

// Generate consistent avatar gradient based on name
function getAvatarGradient(name: string): string {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-blue-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}

const ClientCard = memo(function ClientCard({
  client,
  isSelected,
  showMenu,
  caseCount,
  onSelect,
  onToggleMenu,
  onEdit,
  onDelete,
}: ClientCardProps) {
  const avatarGradient = getAvatarGradient(client.name)

  return (
    <div
      className={cn(
        'bg-[var(--color-bg-secondary)] border rounded-lg p-4 cursor-pointer relative h-full card-hover',
        isSelected
          ? 'border-[var(--color-primary-light)] ring-1 ring-[var(--color-primary-light)]/50'
          : 'border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'size-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-semibold text-lg ring-1 ring-white/10',
            avatarGradient
          )}>
            {client.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h3 className="text-[var(--color-text-primary)] font-medium truncate">{client.name}</h3>
            <p className="text-[var(--color-text-muted)] text-xs font-mono">
              {client.cpf_cnpj ? formatCPFCNPJ(client.cpf_cnpj) : '-'}
            </p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu()
            }}
            className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
          >
            <MoreHorizontal className="size-5 text-[var(--color-text-muted)]" />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg shadow-lg z-10 motion-overlay-panel">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors rounded-t-lg"
              >
                <Pencil className="size-4" />
                Editar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors rounded-b-lg"
              >
                <Trash2 className="size-4" />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2.5 text-sm">
        {client.email && (
          <div className="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
            <Mail className="size-4 text-[var(--color-text-muted)]" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
            <Phone className="size-4 text-[var(--color-text-muted)]" />
            <span>{formatPhone(client.phone)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border-default)]">
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Briefcase className="size-3.5" />
          <span>{caseCount} {caseCount === 1 ? 'caso' : 'casos'}</span>
        </div>
        {client.notes && (
          <span className="ml-auto text-xs text-[var(--color-primary-light)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-full border border-[var(--color-primary)]/20">
            Nota
          </span>
        )}
      </div>
    </div>
  )
})

export default function Clients() {
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Client | null>(null)
  const [showMenu, setShowMenu] = useState<number | null>(null)

  // Cases state
  const [showCaseForm, setShowCaseForm] = useState(false)
  const [editingCase, setEditingCase] = useState<Case | null>(null)
  const [showCaseDeleteConfirm, setShowCaseDeleteConfirm] = useState<Case | null>(null)

  // Documents state
  const [showDocDeleteConfirm, setShowDocDeleteConfirm] = useState<Document | null>(null)
  const docFileInputRef = useRef<HTMLInputElement>(null)
  const virtualColumnCountRef = useRef(3)

  const uiDensity = useSettingsStore((s) => (s.settings['ui_density'] === 'compact' ? 'compact' : 'normal'))
  const CARD_HEIGHT = uiDensity === 'compact' ? 160 : 180
  const CARD_GAP = uiDensity === 'compact' ? 12 : 16

  const { clients, loading, error, fetchClients, createClient, updateClient, deleteClient, searchClients } = useClientStore()
  const { cases, fetchCases, createCase, updateCase, deleteCase } = useCaseStore()
  const { documents, fetchDocuments, createDocument, deleteDocument } = useDocumentStore()

  // Compute cases for selected client from reactive state
  const clientCases = useMemo(() =>
    selectedClient ? cases.filter(c => c.client_id === selectedClient.id) : [],
    [cases, selectedClient]
  )

  // Compute case counts for all clients from reactive state
  const caseCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    cases.forEach(c => {
      counts[c.client_id] = (counts[c.client_id] || 0) + 1
    })
    return counts
  }, [cases])

  // Filter documents for selected client
  const clientDocuments = useMemo(() =>
    documents.filter(d => d.client_id === selectedClient?.id),
    [documents, selectedClient?.id]
  )

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useEffect(() => {
    if (cases.length === 0) {
      fetchCases().catch((error) => {
        console.error('Failed to load cases:', error)
      })
    }
    if (documents.length === 0) {
      fetchDocuments().catch((error) => {
        console.error('Failed to load documents:', error)
      })
    }
  }, [cases.length, documents.length, fetchCases, fetchDocuments])

  // Use refs to avoid triggering useEffect on function identity changes
  const searchClientsRef = useRef(searchClients)
  const fetchClientsRef = useRef(fetchClients)
  searchClientsRef.current = searchClients
  fetchClientsRef.current = fetchClients

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (search.trim()) {
        searchClientsRef.current(search)
      } else {
        fetchClientsRef.current()
      }
    }, 300)

    return () => clearTimeout(delaySearch)
  }, [search])

  useEffect(() => {
    if (!location.search || clients.length === 0) return

    const params = new URLSearchParams(location.search)
    const clientIdParam = params.get('id')
    const caseIdParam = params.get('caseId')

    if (clientIdParam) {
      const clientId = Number(clientIdParam)
      if (Number.isFinite(clientId)) {
        const targetClient = clients.find((client) => client.id === clientId)
        if (targetClient) {
          setSelectedClient(targetClient)
          return
        }
      }
    }

    if (caseIdParam && cases.length > 0) {
      const caseId = Number(caseIdParam)
      if (Number.isFinite(caseId)) {
        const targetCase = cases.find((item) => item.id === caseId)
        if (targetCase) {
          const targetClient = clients.find((client) => client.id === targetCase.client_id)
          if (targetClient) {
            setSelectedClient(targetClient)
          }
        }
      }
    }
  }, [location.search, clients, cases])

  const handleCreateClient = async (data: {
    name: string
    cpf_cnpj: string
    email: string
    phone: string
    address: string
    notes: string
  }) => {
    const newClient = await createClient(
      {
        name: data.name,
        cpf_cnpj: data.cpf_cnpj || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        notes: data.notes || undefined,
      },
      {
        // Callback to create client folder - decouples clientStore from folderStore
        onClientCreated: async (clientId, clientName) => {
          await useFolderStore.getState().createClientFolder(clientId, clientName)
        },
      }
    )
    setShowForm(false)
    return newClient
  }

  const handleUpdateClient = async (data: {
    name: string
    cpf_cnpj: string
    email: string
    phone: string
    address: string
    notes: string
  }) => {
    if (!editingClient) return

    await updateClient(editingClient.id, {
      name: data.name,
      cpf_cnpj: data.cpf_cnpj || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      notes: data.notes || undefined,
    })
    setEditingClient(null)
  }

  const handleDeleteClient = async () => {
    if (!showDeleteConfirm) return

    await deleteClient(showDeleteConfirm.id)
    setShowDeleteConfirm(null)
    if (selectedClient?.id === showDeleteConfirm.id) {
      setSelectedClient(null)
    }
  }

  // Case handlers - store is reactive, no need to re-fetch
  const handleCreateCase = async (data: {
    client_id: number
    title: string
    case_number: string
    court: string
    type: string
    status: 'ativo' | 'arquivado' | 'suspenso'
    description: string
  }) => {
    await createCase({
      client_id: data.client_id,
      title: data.title,
      case_number: data.case_number || undefined,
      court: data.court || undefined,
      type: data.type || undefined,
      status: data.status,
      description: data.description || undefined,
    })
    setShowCaseForm(false)
  }

  const handleUpdateCase = async (data: {
    client_id: number
    title: string
    case_number: string
    court: string
    type: string
    status: 'ativo' | 'arquivado' | 'suspenso'
    description: string
  }) => {
    if (!editingCase) return

    await updateCase(editingCase.id, {
      title: data.title,
      case_number: data.case_number || undefined,
      court: data.court || undefined,
      type: data.type || undefined,
      status: data.status,
      description: data.description || undefined,
    })
    setEditingCase(null)
  }

  const handleDeleteCase = async () => {
    if (!showCaseDeleteConfirm) return
    await deleteCase(showCaseDeleteConfirm.id)
    setShowCaseDeleteConfirm(null)
  }

  const getStatusColor = (status: Case['status']) => {
    switch (status) {
      case 'ativo':
        return 'bg-emerald-500/10 text-emerald-400'
      case 'arquivado':
        return 'bg-gray-500/10 text-gray-400'
      case 'suspenso':
        return 'bg-amber-500/10 text-amber-400'
      default:
        return 'bg-gray-500/10 text-gray-400'
    }
  }

  const getStatusLabel = (status: Case['status']) => {
    switch (status) {
      case 'ativo':
        return 'Ativo'
      case 'arquivado':
        return 'Arquivado'
      case 'suspenso':
        return 'Suspenso'
      default:
        return status
    }
  }

  // Document handlers
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedClient || !e.target.files?.length) return

    const removeStoredFile = async (path?: string | null) => {
      if (!path) return
      try {
        const { remove } = await import('@tauri-apps/plugin-fs')
        await remove(path)
      } catch (error) {
        console.error('Failed to rollback file upload:', error)
      }
    }

    const acceptedExtensions = ['.pdf', '.doc', '.docx', '.txt']
    const files = Array.from(e.target.files)

    for (const file of files) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (acceptedExtensions.includes(ext)) {
        try {
          let storedPath: string | null = null
          try {
            storedPath = await saveClientDocumentFile(selectedClient.id, file)
            await createDocument({
              client_id: selectedClient.id,
              name: file.name,
              file_path: storedPath,
            })
          } catch (error) {
            await removeStoredFile(storedPath)
            throw error
          }
        } catch (err) {
          console.error('Failed to upload document:', err)
        }
      }
    }

    // Reset input
    if (docFileInputRef.current) {
      docFileInputRef.current.value = ''
    }
  }

  const handleDeleteDocument = async () => {
    if (!showDocDeleteConfirm) return

    await deleteDocument(showDocDeleteConfirm.id)
    setShowDocDeleteConfirm(null)
  }

  // Memoized handlers for ClientCard
  const handleSelectClient = useCallback((client: Client) => {
    setSelectedClient(client)
  }, [])

  const handleToggleMenu = useCallback((clientId: number) => {
    setShowMenu((prev) => (prev === clientId ? null : clientId))
  }, [])

  const handleEditClient = useCallback((client: Client) => {
    setEditingClient(client)
    setShowMenu(null)
  }, [])

  const handleDeleteClientConfirm = useCallback((client: Client) => {
    setShowDeleteConfirm(client)
    setShowMenu(null)
  }, [])

  // Virtualization settings
  const useVirtualization = clients.length >= VIRTUALIZATION_THRESHOLD
  const getColumnCount = (width: number) => {
    if (width >= 1024) return 3
    if (width >= 768) return 2
    return 1
  }

  // Grid cell renderer for virtualized list
  const CellRenderer = useCallback(
    ({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
      const index = rowIndex * virtualColumnCountRef.current + columnIndex
      if (index >= clients.length) return null

      const client = clients[index]

      return (
        <div style={{ ...style, paddingRight: CARD_GAP, paddingBottom: CARD_GAP }}>
          <ClientCard
            client={client}
            isSelected={selectedClient?.id === client.id}
            showMenu={showMenu === client.id}
            caseCount={caseCounts[client.id] ?? 0}
            onSelect={() => handleSelectClient(client)}
            onToggleMenu={() => handleToggleMenu(client.id)}
            onEdit={() => handleEditClient(client)}
            onDelete={() => handleDeleteClientConfirm(client)}
          />
        </div>
      )
    },
    [clients, selectedClient, showMenu, caseCounts, handleSelectClient, handleToggleMenu, handleEditClient, handleDeleteClientConfirm]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--color-text-primary)]">Clientes</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">
            Gerencie sua carteira de clientes
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} leftIcon={<Plus className="size-4" />}>
          Novo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="size-5 text-[var(--color-text-muted)]" />
        </div>
        <input
          id="clients-search"
          name="search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF/CNPJ ou email..."
          className="block w-full pl-10 pr-3 py-2.5 border border-[var(--color-border-default)] rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm transition-all"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && clients.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 text-[var(--color-primary-light)] animate-spin" />
        </div>
      )}

      {/* Clients Grid */}
      {!loading && clients.length > 0 && (
        <>
          {useVirtualization ? (
            /* Virtualized grid for large collections */
            <div className="h-[calc(100vh-16rem)]">
              <AutoSizer>
                {({ height, width }) => {
                  const columnCount = getColumnCount(width)
                  virtualColumnCountRef.current = columnCount
                  const columnWidth = Math.floor((width - CARD_GAP * (columnCount - 1)) / columnCount)
                  const rowCount = Math.ceil(clients.length / columnCount)

                  return (
                    <Grid
                      columnCount={columnCount}
                      columnWidth={columnWidth + CARD_GAP}
                      height={height}
                      rowCount={rowCount}
                      rowHeight={CARD_HEIGHT + CARD_GAP}
                      width={width}
                    >
                      {CellRenderer}
                    </Grid>
                  )
                }}
              </AutoSizer>
            </div>
          ) : (
            /* Regular grid for small collections */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  isSelected={selectedClient?.id === client.id}
                  showMenu={showMenu === client.id}
                  caseCount={caseCounts[client.id] ?? 0}
                  onSelect={() => handleSelectClient(client)}
                  onToggleMenu={() => handleToggleMenu(client.id)}
                  onEdit={() => handleEditClient(client)}
                  onDelete={() => handleDeleteClientConfirm(client)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Client Details Panel with Cases */}
      {selectedClient && (
        <Card padding="none" className="overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-default)]">
            <div className="flex items-center gap-3">
              <div className={cn(
                'size-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-semibold shadow-md',
                getAvatarGradient(selectedClient.name)
              )}>
                {selectedClient.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-[var(--color-text-primary)] font-medium">{selectedClient.name}</h3>
                <p className="text-[var(--color-text-muted)] text-xs font-mono">
                  {selectedClient.cpf_cnpj ? formatCPFCNPJ(selectedClient.cpf_cnpj) : 'Sem CPF/CNPJ'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedClient(null)}
              className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
            >
              <X className="size-5 text-[var(--color-text-muted)]" />
            </button>
          </div>

          {/* Client Info */}
          <div className="p-4 border-b border-border-dark grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {selectedClient.email && (
              <div>
                <span className="text-gray-500 block mb-1">Email</span>
                <span className="text-white">{selectedClient.email}</span>
              </div>
            )}
            {selectedClient.phone && (
              <div>
                <span className="text-gray-500 block mb-1">Telefone</span>
                <span className="text-white">{formatPhone(selectedClient.phone)}</span>
              </div>
            )}
            {selectedClient.address && (
              <div className="col-span-2">
                <span className="text-gray-500 block mb-1">Endereço</span>
                <span className="text-white">{selectedClient.address}</span>
              </div>
            )}
          </div>

          {/* Cases Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Briefcase className="size-5 text-primary" />
                Casos ({clientCases.length})
              </h4>
              <button
                onClick={() => setShowCaseForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95"
              >
                <Plus className="size-4" />
                Novo Caso
              </button>
            </div>

            {/* Cases List */}
            {clientCases.length > 0 && (
              <div className="space-y-2">
                {clientCases.map((case_) => (
                  <div
                    key={case_.id}
                    className="flex items-center justify-between p-3 bg-background-dark border border-border-dark rounded-lg hover:border-primary/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <ChevronRight className="size-4 text-gray-500 shrink-0" />
                      <div className="min-w-0">
                        <h5 className="text-white text-sm font-medium truncate">
                          {case_.title}
                        </h5>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          {case_.case_number && (
                            <span className="font-mono">{case_.case_number}</span>
                          )}
                          {case_.court && (
                            <>
                              <span>•</span>
                              <span>{case_.court}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('px-2 py-0.5 rounded text-xs', getStatusColor(case_.status))}>
                        {getStatusLabel(case_.status)}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingCase(case_)}
                          className="p-1.5 hover:bg-surface-highlight rounded transition-colors"
                          title="Editar caso"
                        >
                          <Pencil className="size-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => setShowCaseDeleteConfirm(case_)}
                          className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                          title="Excluir caso"
                        >
                          <Trash2 className="size-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty Cases State */}
            {clientCases.length === 0 && (
              <div className="text-center py-8">
                <Briefcase className="size-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm mb-3">
                  Nenhum caso cadastrado para este cliente
                </p>
                <button
                  onClick={() => setShowCaseForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  <Plus className="size-4" />
                  Adicionar Caso
                </button>
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div className="p-4 border-t border-border-dark">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                Documentos ({clientDocuments.length})
              </h4>
              <div>
                <input
                  type="file"
                  ref={docFileInputRef}
                  onChange={handleDocumentUpload}
                  accept=".pdf,.doc,.docx,.txt"
                  multiple
                  className="hidden"
                />
                <button
                  onClick={() => docFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95"
                >
                  <Upload className="size-4" />
                  Adicionar
                </button>
              </div>
            </div>

            {/* Documents List */}
            {clientDocuments.length > 0 && (
              <div className="space-y-2">
                {clientDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-background-dark border border-border-dark rounded-lg hover:border-primary/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="size-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <h5 className="text-white text-sm font-medium truncate">
                          {doc.name}
                        </h5>
                        <span className="text-xs text-gray-500">
                          {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDocDeleteConfirm(doc)}
                      className="p-1.5 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Excluir documento"
                    >
                      <Trash2 className="size-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Empty Documents State */}
            {clientDocuments.length === 0 && (
              <div className="text-center py-8">
                <FileText className="size-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm mb-3">
                  Nenhum documento anexado
                </p>
                <button
                  onClick={() => docFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  <Upload className="size-4" />
                  Anexar Documento
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && clients.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="size-16 bg-surface-dark rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="size-8 text-gray-500" />
          </div>
          <h3 className="text-white font-medium mb-1">Nenhum cliente cadastrado</h3>
          <p className="text-gray-400 text-sm mb-4">
            Comece adicionando seu primeiro cliente
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95"
          >
            <Plus className="size-4" />
            Adicionar Cliente
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu !== null && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(null)}
        />
      )}

      {/* Create Form Modal */}
      {showForm && (
        <ClientForm
          onSave={handleCreateClient}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit Form Modal */}
      {editingClient && (
        <ClientForm
          client={editingClient}
          onSave={handleUpdateClient}
          onClose={() => setEditingClient(null)}
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
              Excluir Cliente
            </h3>
            <p className="text-gray-400 mb-6">
              Tem certeza que deseja excluir <strong className="text-white">{showDeleteConfirm.name}</strong>?
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
                onClick={handleDeleteClient}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-all active:scale-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Case Form Modal */}
      {showCaseForm && selectedClient && (
        <CaseForm
          clientId={selectedClient.id}
          onSave={handleCreateCase}
          onClose={() => setShowCaseForm(false)}
        />
      )}

      {/* Edit Case Form Modal */}
      {editingCase && selectedClient && (
        <CaseForm
          case_={editingCase}
          clientId={selectedClient.id}
          onSave={handleUpdateCase}
          onClose={() => setEditingCase(null)}
        />
      )}

      {/* Delete Case Confirmation Modal */}
      {showCaseDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop"
            onClick={() => setShowCaseDeleteConfirm(null)}
          />
          <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-md mx-4 p-[var(--space-modal)] shadow-lg motion-overlay-panel">
            <h3 className="text-lg font-semibold text-white mb-2">
              Excluir Caso
            </h3>
            <p className="text-gray-400 mb-6">
              Tem certeza que deseja excluir <strong className="text-white">{showCaseDeleteConfirm.title}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCaseDeleteConfirm(null)}
                className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteCase}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-all active:scale-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Document Confirmation Modal */}
      {showDocDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop"
            onClick={() => setShowDocDeleteConfirm(null)}
          />
          <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-md mx-4 p-[var(--space-modal)] shadow-lg motion-overlay-panel">
            <h3 className="text-lg font-semibold text-white mb-2">
              Excluir Documento
            </h3>
            <p className="text-gray-400 mb-6">
              Tem certeza que deseja excluir <strong className="text-white">{showDocDeleteConfirm.name}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDocDeleteConfirm(null)}
                className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteDocument}
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
