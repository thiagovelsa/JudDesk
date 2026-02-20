import { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Upload,
  Search,
  FileText,
  MoreHorizontal,
  Trash2,
  Eye,
  Loader2,
  Plus,
  X,
  FileCheck,
  AlertCircle,
} from 'lucide-react'
import { FixedSizeGrid as Grid } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import { cn } from '@/lib/utils'
import { useDocumentStore, getDocumentSummary } from '@/stores/documentStore'
import { useClientStore } from '@/stores/clientStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { saveClientDocumentFile } from '@/lib/documentStorage'
import PDFViewer from '@/components/documents/PDFViewer'
import FolderTree from '@/components/documents/FolderTree'
import type { Document, Client } from '@/types'

/** Threshold for enabling virtualization */
const VIRTUALIZATION_THRESHOLD = 50

// Memoized document card component
interface DocumentCardProps {
  doc: Document
  isSelected: boolean
  showMenu: boolean
  getFolderName: (folderId: number | null) => string
  onSelect: () => void
  onToggleMenu: () => void
  onView: () => void
  onExtract: () => void
  onDelete: () => void
}

const DocumentCard = memo(function DocumentCard({
  doc,
  isSelected,
  showMenu,
  getFolderName,
  onSelect,
  onToggleMenu,
  onView,
  onExtract,
  onDelete,
}: DocumentCardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-bg-secondary)] border rounded-lg p-4 cursor-pointer h-full card-hover',
        isSelected
          ? 'border-[var(--color-primary-light)] ring-1 ring-[var(--color-primary-light)]/50'
          : 'border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
            <FileText className="size-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[var(--color-text-primary)] font-medium truncate max-w-[180px]">
              {doc.name}
            </h3>
            <p className="text-[var(--color-text-muted)] text-xs">
              {getFolderName(doc.folder_id)}
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

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-background-dark border border-border-dark rounded-lg shadow-xl z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onView()
                }}
                disabled={!doc.file_path.toLowerCase().endsWith('.pdf')}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors rounded-t-lg',
                  doc.file_path.toLowerCase().endsWith('.pdf')
                    ? 'text-gray-300 hover:bg-surface-dark hover:text-white'
                    : 'text-gray-500 cursor-not-allowed'
                )}
              >
                <Eye className="size-4" />
                Visualizar
              </button>
              {doc.file_path.toLowerCase().endsWith('.pdf') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onExtract()
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-surface-dark hover:text-white transition-colors"
                >
                  <FileCheck className="size-4" />
                  Extrair Texto
                </button>
              )}
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

      {doc.extracted_text && doc.extracted_text !== '__LAZY_LOAD__' && (
        <p className="text-gray-400 text-xs line-clamp-2 mb-3">
          {getDocumentSummary(doc)}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {new Date(doc.created_at).toLocaleDateString('pt-BR')}
        </span>
        {doc.extracted_text && (
          <span className="flex items-center gap-1 text-emerald-400">
            <FileCheck className="size-3" />
            {doc.extracted_text === '__LAZY_LOAD__' ? 'Texto disponível' : 'Texto extraído'}
          </span>
        )}
      </div>
    </div>
  )
})

export default function Documents() {
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showMenu, setShowMenu] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Document | null>(null)
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFolderId, setUploadFolderId] = useState<number | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uiDensity = useSettingsStore((s) => (s.settings['ui_density'] === 'compact' ? 'compact' : 'normal'))
  const CARD_HEIGHT = uiDensity === 'compact' ? 152 : 168
  const CARD_GAP = uiDensity === 'compact' ? 12 : 16

  const {
    documents,
    loading,
    error,
    extractionProgress,
    fetchDocuments,
    createDocument,
    deleteDocument,
    extractPDFText,
    searchDocuments,
  } = useDocumentStore()

  const { clients, fetchClients } = useClientStore()
  const { folders, fetchFolders } = useFolderStore()

  useEffect(() => {
    if (documents.length === 0) {
      fetchDocuments().catch((error) => {
        console.error('Failed to load documents:', error)
      })
    }
    if (clients.length === 0) {
      fetchClients().catch((error) => {
        console.error('Failed to load clients:', error)
      })
    }
    if (folders.length === 0) {
      fetchFolders().catch((error) => {
        console.error('Failed to load folders:', error)
      })
    }
  }, [documents.length, clients.length, folders.length, fetchDocuments, fetchClients, fetchFolders])

  // Use refs to avoid triggering useEffect on function identity changes
  const searchDocumentsRef = useRef(searchDocuments)
  const fetchDocumentsRef = useRef(fetchDocuments)
  searchDocumentsRef.current = searchDocuments
  fetchDocumentsRef.current = fetchDocuments

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (search.trim()) {
        searchDocumentsRef.current(search)
      } else {
        fetchDocumentsRef.current()
      }
    }, 300)

    return () => clearTimeout(delaySearch)
  }, [search])

  useEffect(() => {
    if (!location.search || documents.length === 0) return

    const params = new URLSearchParams(location.search)
    const documentIdParam = params.get('id')
    if (!documentIdParam) return

    const documentId = Number(documentIdParam)
    if (!Number.isFinite(documentId)) return

    const targetDocument = documents.find((doc) => doc.id === documentId)
    if (!targetDocument) return

    setSelectedDocument(targetDocument)
    setSelectedFolderId(targetDocument.folder_id ?? null)
  }, [location.search, documents])

  const filteredDocuments = useMemo(
    () => selectedFolderId !== null
      ? documents.filter((d) => d.folder_id === selectedFolderId)
      : documents,
    [documents, selectedFolderId]
  )

  // Create O(1) lookup map for folder names
  const folderMap = useMemo(
    () => new Map(folders.map(f => [f.id, f.name])),
    [folders]
  )

  const getFolderName = useCallback((folderId: number | null): string => {
    if (folderId === null) return 'Sem pasta'
    return folderMap.get(folderId) || 'Pasta desconhecida'
  }, [folderMap])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      setShowUpload(true)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !selectedClient || uploadLoading) return

    setUploadLoading(true)

    const removeStoredFile = async (path?: string | null) => {
      if (!path) return
      try {
        const { remove } = await import('@tauri-apps/plugin-fs')
        await remove(path)
      } catch (error) {
        console.error('Failed to rollback file upload:', error)
      }
    }

    try {
      let filePath: string | null = null
      try {
        filePath = await saveClientDocumentFile(selectedClient.id, uploadFile)

        await createDocument({
          client_id: selectedClient.id,
          name: uploadFile.name,
          file_path: filePath,
          folder_id: uploadFolderId,
        })
      } catch (error) {
        await removeStoredFile(filePath)
        throw error
      }

      setShowUpload(false)
      setUploadFile(null)
      setSelectedClient(null)
      setUploadFolderId(null)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploadLoading(false)
    }
  }

  const handleExtract = async (document: Document) => {
    setShowMenu(null)
    try {
      await extractPDFText(document.id)
    } catch (err) {
      console.error('Extraction failed:', err)
    }
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm) return

    await deleteDocument(showDeleteConfirm.id)
    setShowDeleteConfirm(null)
    if (selectedDocument?.id === showDeleteConfirm.id) {
      setSelectedDocument(null)
    }
  }

  // Use the already memoized getFolderName directly
  const getFolderNameMemo = getFolderName

  // Calculate columns based on container width
  const getColumnCount = (width: number): number => {
    if (width >= 1024) return 3 // lg
    if (width >= 768) return 2 // md
    return 1
  }

  // Use virtualization only for large collections
  const useVirtualization = filteredDocuments.length >= VIRTUALIZATION_THRESHOLD

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Documentos</h1>
          <p className="text-gray-400 text-sm mt-1">
            Gerencie documentos de clientes e casos
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95"
        >
          <Upload className="size-4" />
          Enviar Documento
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar - Folders */}
        <div className="w-full md:w-56 md:shrink-0">
          <FolderTree
            onSelectFolder={setSelectedFolderId}
            selectedFolderId={selectedFolderId}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Search */}
          <div className="relative max-w-md mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="size-5 text-gray-400" />
            </div>
            <input
              id="documents-search"
              name="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar documentos..."
              className="block w-full pl-10 pr-3 py-2.5 border border-border-dark rounded-lg bg-surface-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
              <AlertCircle className="size-4" />
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && documents.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 text-primary animate-spin" />
            </div>
          )}

          {/* Documents Grid */}
          {!loading && filteredDocuments.length > 0 && (
            <>
              {/* Virtualized grid for large collections */}
              {useVirtualization ? (
                <div className="h-[calc(100vh-20rem)]">
                  <AutoSizer>
                    {({ height, width }) => {
                      const columnCount = getColumnCount(width)
                      const columnWidth = Math.floor((width - CARD_GAP) / columnCount)
                      const rowCount = Math.ceil(filteredDocuments.length / columnCount)

                      return (
                        <Grid
                          columnCount={columnCount}
                          columnWidth={columnWidth}
                          height={height}
                          rowCount={rowCount}
                          rowHeight={CARD_HEIGHT + CARD_GAP}
                          width={width}
                          itemData={filteredDocuments}
                        >
                          {({ columnIndex, rowIndex, style }) => {
                            const index = rowIndex * columnCount + columnIndex
                            const doc = filteredDocuments[index]

                            if (!doc) return null

                            return (
                              <div style={{ ...style, padding: CARD_GAP / 2 }}>
                                <DocumentCard
                                  doc={doc}
                                  isSelected={selectedDocument?.id === doc.id}
                                  showMenu={showMenu === doc.id}
                                  getFolderName={getFolderNameMemo}
                                  onSelect={() => setSelectedDocument(doc)}
                                  onToggleMenu={() => setShowMenu(showMenu === doc.id ? null : doc.id)}
                                  onView={() => {
                                    if (doc.file_path.toLowerCase().endsWith('.pdf')) {
                                      setViewingDocument(doc)
                                    }
                                    setShowMenu(null)
                                  }}
                                  onExtract={() => handleExtract(doc)}
                                  onDelete={() => {
                                    setShowDeleteConfirm(doc)
                                    setShowMenu(null)
                                  }}
                                />
                              </div>
                            )
                          }}
                        </Grid>
                      )
                    }}
                  </AutoSizer>
                </div>
              ) : (
                /* Regular grid for small collections */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDocuments.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      isSelected={selectedDocument?.id === doc.id}
                      showMenu={showMenu === doc.id}
                      getFolderName={getFolderNameMemo}
                      onSelect={() => setSelectedDocument(doc)}
                      onToggleMenu={() => setShowMenu(showMenu === doc.id ? null : doc.id)}
                      onView={() => {
                        if (doc.file_path.toLowerCase().endsWith('.pdf')) {
                          setViewingDocument(doc)
                        }
                        setShowMenu(null)
                      }}
                      onExtract={() => handleExtract(doc)}
                      onDelete={() => {
                        setShowDeleteConfirm(doc)
                        setShowMenu(null)
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!loading && filteredDocuments.length === 0 && !error && (
            <div className="text-center py-12">
              <div className="size-16 bg-surface-dark rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="size-8 text-gray-500" />
              </div>
              <h3 className="text-white font-medium mb-1">Nenhum documento</h3>
              <p className="text-gray-400 text-sm mb-4">
                {selectedFolderId !== null
                  ? 'Nenhum documento nesta pasta'
                  : 'Envie seu primeiro documento'}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95"
              >
                <Plus className="size-4" />
                Enviar Documento
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Extraction Progress */}
      {extractionProgress !== null && (
        <div className="fixed bottom-6 right-6 bg-surface-dark border border-border-dark rounded-lg p-4 shadow-xl w-72">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="size-5 text-primary animate-spin" />
            <span className="text-white text-sm">Extraindo texto...</span>
          </div>
          <div className="w-full bg-background-dark rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${extractionProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu !== null && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(null)}
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop"
            onClick={() => {
              setShowUpload(false)
              setUploadFile(null)
            }}
          />
          <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-md mx-4 shadow-lg motion-overlay-panel">
            <div className="flex items-center justify-between p-5 border-b border-border-dark">
              <h2 className="text-lg font-semibold text-white">
                Enviar Documento
              </h2>
              <button
                onClick={() => {
                  setShowUpload(false)
                  setUploadFile(null)
                }}
                className="p-1 hover:bg-surface-highlight rounded transition-colors"
              >
                <X className="size-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* File Info */}
              {uploadFile && (
                <div className="flex items-center gap-3 p-3 bg-background-dark rounded-lg">
                  <FileText className="size-8 text-primary" />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {uploadFile.name}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {(uploadFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              )}

              {/* Client Select */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Cliente *
                </label>
                <select
                  id="upload-client"
                  name="uploadClient"
                  value={selectedClient?.id || ''}
                  onChange={(e) => {
                    const client = clients.find(
                      (c) => c.id === Number(e.target.value)
                    )
                    setSelectedClient(client || null)
                  }}
                  className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Folder Select */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Pasta
                </label>
                <select
                  id="upload-folder"
                  name="uploadFolder"
                  value={uploadFolderId ?? ''}
                  onChange={(e) => setUploadFolderId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 border border-border-dark rounded-lg bg-background-dark text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                >
                  <option value="">Sem pasta</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowUpload(false)
                    setUploadFile(null)
                  }}
                  className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || !selectedClient || uploadLoading}
                  className="px-4 py-2.5 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Enviar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-md mx-4 p-[var(--space-modal)] shadow-lg motion-overlay-panel">
            <h3 className="text-lg font-semibold text-white mb-2">
              Excluir Documento
            </h3>
            <p className="text-gray-400 mb-6">
              Tem certeza que deseja excluir{' '}
              <strong className="text-white">{showDeleteConfirm.name}</strong>?
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
                onClick={handleDelete}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-all active:scale-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {viewingDocument && (
        <PDFViewer
          filePath={viewingDocument.file_path}
          fileName={viewingDocument.name}
          onClose={() => setViewingDocument(null)}
        />
      )}
    </div>
  )
}
