import { useState, useRef, useEffect, useCallback } from 'react'
import { FixedSizeList as List, VariableSizeList } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import {
  Send,
  Bot,
  User,
  Plus,
  ChevronDown,
  Loader2,
  MessageSquare,
  Trash2,
  AlertCircle,
  Check,
  FileText,
  X,
  Paperclip,
  Scale,
  Search,
  Upload,
  File,
  FileSpreadsheet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  isTauriEnvironment,
  getChatAttachmentsBySession,
  createChatAttachment,
  deleteChatAttachment,
  deleteChatAttachmentsBySession,
} from '@/lib/db'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDocumentStore } from '@/stores/documentStore'
import { useCaseStore } from '@/stores/caseStore'
import { isOllamaRunning, getOllamaModels, RECOMMENDED_MODELS, sendMessage as sendAIMessage } from '@/lib/ai'
import { ThinkingBlock, WebSearchResults, MessageCost } from '@/components/assistant'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { getProfileDescription } from '@/lib/intentClassifier'
import type { WebSearchResult } from '@/lib/ai'
import {
  extractFromBuffer,
  getSupportedExtensions,
  formatFileSize,
  isSupportedFileType,
  type FileType,
} from '@/lib/extractors'
import type { AIProvider, OllamaModel } from '@/types'

interface LocalMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  // Advanced AI fields (optional, used only when Tauri is available)
  // thinking_content: Claude thinking or GPT-5 reasoning
  thinking_content?: string
  web_search_results?: WebSearchResult[]
  cost_usd?: number
  intent_profile?: 'simples' | 'pesquisa' | 'analise' | 'peca'
}

interface UploadedFile {
  id: number
  dbId?: number
  storedPath?: string
  name: string
  type: FileType
  extractedText: string
  size: number
  error?: string
}

interface PendingProviderModelChange {
  provider: AIProvider
  model: string
}

const providers: { id: AIProvider; name: string; requiresKey: boolean }[] = [
  { id: 'ollama', name: 'Ollama (Local)', requiresKey: false },
  { id: 'claude', name: 'Claude', requiresKey: true },
  { id: 'openai', name: 'OpenAI', requiresKey: true },
  { id: 'gemini', name: 'Google Gemini', requiresKey: true },
]

// Upload limits
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_FILE_COUNT = 5

// Virtualization threshold for session list
const SESSION_VIRTUALIZATION_THRESHOLD = 50
const SESSION_ITEM_HEIGHT = 60

const getFallbackModelForProvider = (
  nextProvider: AIProvider,
  ollamaAvailableModels: OllamaModel[],
  currentModel: string
) => {
  if (nextProvider === 'ollama') {
    return ollamaAvailableModels[0]?.name ?? 'llama3.1'
  }

  const recommended = RECOMMENDED_MODELS[nextProvider]
  if (recommended && recommended.length > 0) {
    return recommended[0]
  }

  return currentModel
}

const normalizeFileType = (value: string): FileType => {
  switch (value) {
    case 'pdf':
    case 'csv':
    case 'excel':
    case 'word':
    case 'text':
    case 'unknown':
      return value
    default:
      return 'unknown'
  }
}

export default function Assistant() {
  const [input, setInput] = useState('')
  const [provider, setProvider] = useState<AIProvider>('ollama')
  const [model, setModel] = useState('llama3.1')
  const [showProviderMenu, setShowProviderMenu] = useState(false)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showSessionList, setShowSessionList] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([])
  const [isTauri, setIsTauri] = useState(() => isTauriEnvironment())
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [selectedDocs, setSelectedDocs] = useState<number[]>([])
  const [showDocSelector, setShowDocSelector] = useState(false)
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [showProviderModelConfirmModal, setShowProviderModelConfirmModal] = useState(false)
  const [pendingProviderModel, setPendingProviderModel] = useState<PendingProviderModelChange | null>(null)
  const [selectedCaseForSession, setSelectedCaseForSession] = useState<number | null>(null)
  const [caseSearchQuery, setCaseSearchQuery] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesListRef = useRef<VariableSizeList>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Counter for unique IDs (avoids Date.now() + Math.random() issues)
  const idCounterRef = useRef(0)
  const getNextId = useCallback(() => ++idCounterRef.current, [])
  // Track component mount state for async operations
  const isMountedRef = useRef(true)
  // AbortController for canceling AI requests
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastSessionIdRef = useRef<number | null>(null)

  const {
    sessions,
    activeSession,
    messages,
    messagesPagination,
    isLoading,
    error,
    fetchSessions,
    createSession,
    loadSession,
    updateSessionProviderModel,
    loadMoreMessages,
    deleteSession,
    send,
  } = useChatStore()

  // Subscribe to specific settings that affect render (optimized selectors)
  // Using individual selectors to prevent re-renders when unrelated settings change
  const claudeApiKey = useSettingsStore((state) => state.settings['claude_api_key'])
  const openaiApiKey = useSettingsStore((state) => state.settings['openai_api_key'])
  const geminiApiKey = useSettingsStore((state) => state.settings['gemini_api_key'])
  const claudeThinkingEnabled = useSettingsStore((state) => state.settings['claude_thinking_enabled'])
  const claudeWebSearchEnabled = useSettingsStore((state) => state.settings['claude_web_search_enabled'])
  const claudeCacheEnabled = useSettingsStore((state) => state.settings['claude_cache_enabled'])
  const openaiReasoningEnabled = useSettingsStore((state) => state.settings['openai_reasoning_enabled'])
  const openaiWebSearchEnabled = useSettingsStore((state) => state.settings['openai_web_search_enabled'])
  const openaiCacheEnabled = useSettingsStore((state) => state.settings['openai_cache_enabled'])
  const geminiThinkingEnabled = useSettingsStore((state) => state.settings['gemini_thinking_enabled'])
  const geminiWebSearchEnabled = useSettingsStore((state) => state.settings['gemini_web_search_enabled'])
  const claudeShowCosts = useSettingsStore((state) => state.settings['claude_show_costs'])
  const openaiShowCosts = useSettingsStore((state) => state.settings['openai_show_costs'])
  const geminiShowCosts = useSettingsStore((state) => state.settings['gemini_show_costs'])
  const { getExtractedText, extractDocumentText } = useDocumentStore()
  const { documents, fetchDocuments } = useDocumentStore()
  const { cases, fetchCases } = useCaseStore()

  // Keyboard event handler for accessibility (ESC to close menus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProviderMenu(false)
        setShowModelMenu(false)
        setShowSessionList(false)
        setShowDocSelector(false)
        setShowProviderModelConfirmModal(false)
        setPendingProviderModel(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      // Cancel any pending AI request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  // Check environment and Ollama status
  useEffect(() => {
    const tauriAvailable = isTauriEnvironment()
    setIsTauri(tauriAvailable)

    const checkOllama = async () => {
      setOllamaStatus('checking')
      try {
        const running = await isOllamaRunning()
        setOllamaStatus(running ? 'online' : 'offline')

        if (running) {
          const models = await getOllamaModels()
          if (!isMountedRef.current) return
          setOllamaModels(models)
        }
      } catch {
        if (isMountedRef.current) {
          setOllamaStatus('offline')
        }
      }
    }

    checkOllama()
  }, [])

  // Initialize assistant context with persisted/default settings
  useEffect(() => {
    if (!isTauri) return
    let cancelled = false

    const initializeAssistant = async () => {
      await useSettingsStore.getState().fetchSettings().catch(() => undefined)

      const settingsStore = useSettingsStore.getState()
      const defaultProvider = settingsStore.getDefaultProvider()
      const defaultModel = settingsStore.getDefaultModel()
      const persistedSessionId = settingsStore.getAssistantLastSessionId()

      // Apply defaults while no session is active yet.
      if (!useChatStore.getState().activeSession) {
        setProvider(defaultProvider)
        setModel(defaultModel)
      }

      await Promise.all([
        fetchDocuments().catch(() => undefined),
        fetchCases().catch(() => undefined),
      ])

      await fetchSessions()
      if (cancelled || !isMountedRef.current) return

      const latestSessions = useChatStore.getState().sessions
      if (latestSessions.length === 0) {
        await settingsStore.setAssistantLastSessionId(null)
        return
      }

      const targetSession = persistedSessionId && latestSessions.some((s) => s.id === persistedSessionId)
        ? persistedSessionId
        : latestSessions[0].id

      await loadSession(targetSession)
      await settingsStore.setAssistantLastSessionId(targetSession)
    }

    initializeAssistant().catch((error) => {
      console.error('Error initializing assistant context:', error)
    })

    return () => {
      cancelled = true
    }
  }, [isTauri, fetchSessions, fetchDocuments, fetchCases, loadSession])

  useEffect(() => {
    if (!isTauri) return

    const nextSessionId = activeSession?.id ?? null
    const previousSessionId = lastSessionIdRef.current
    lastSessionIdRef.current = nextSessionId

    if (!nextSessionId) {
      setSelectedDocs([])
      setUploadedFiles([])
      return
    }

    if (previousSessionId && previousSessionId !== nextSessionId) {
      setSelectedDocs([])
      setUploadedFiles([])
    }

    let cancelled = false

    const loadAttachments = async () => {
      try {
        const attachments = await getChatAttachmentsBySession(nextSessionId)
        if (!isMountedRef.current || cancelled) return

        const mapped = attachments.map((attachment) => ({
          id: getNextId(),
          dbId: attachment.id,
          name: attachment.name,
          storedPath: attachment.file_path ?? undefined,
          type: normalizeFileType(attachment.file_type),
          extractedText: attachment.extracted_text || '',
          size: attachment.size_bytes ?? 0,
          error: attachment.error ?? undefined,
        }))

        setUploadedFiles((prev) => {
          const pending = prev.filter((file) => !file.dbId)
          const loadedIds = new Set(mapped.map((file) => file.dbId))
          const pendingFiltered = pending.filter(
            (file) => !file.dbId || !loadedIds.has(file.dbId)
          )
          return [...pendingFiltered, ...mapped]
        })
      } catch (error) {
        console.error('Error loading chat attachments:', error)
      }
    }

    loadAttachments()

    return () => {
      cancelled = true
    }
  }, [activeSession?.id, getNextId, isTauri])

  // Keep selector UI aligned with active session context.
  useEffect(() => {
    if (!isTauri || !activeSession) return

    setProvider(activeSession.provider)
    setModel(
      activeSession.model ||
      getFallbackModelForProvider(activeSession.provider, ollamaModels, model)
    )
  }, [isTauri, activeSession?.id, activeSession?.provider, activeSession?.model, ollamaModels, model])

  const scrollToBottom = () => {
    const totalItems = displayMessages.length + (currentLoading ? 1 : 0)
    if (totalItems <= 0) return
    messagesListRef.current?.scrollToItem(totalItems - 1, 'end')
  }

  // Handle scroll to load more messages (infinite scroll)
  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    // Load more when scrolled near the top (within 50px)
    if (target.scrollTop <= 50 && messagesPagination.hasMore && !messagesPagination.isLoadingMore && isTauri) {
      // Remember scroll position to restore after loading
      const scrollHeight = target.scrollHeight
      loadMoreMessages().then(() => {
        // Restore scroll position after new messages are prepended
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight
            messagesContainerRef.current.scrollTop = newScrollHeight - scrollHeight
          }
        })
      })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, localMessages])

  const effectiveProvider: AIProvider =
    isTauri && activeSession ? activeSession.provider : provider
  const effectiveModel =
    isTauri && activeSession ? (activeSession.model || model) : model

  const closeProviderModelConfirmModal = () => {
    setShowProviderModelConfirmModal(false)
    setPendingProviderModel(null)
  }

  const requestProviderModelChange = (nextProvider: AIProvider, nextModel: string) => {
    if (nextProvider === effectiveProvider && nextModel === effectiveModel) {
      return
    }

    if (isTauri && activeSession) {
      setPendingProviderModel({
        provider: nextProvider,
        model: nextModel,
      })
      setShowProviderModelConfirmModal(true)
      return
    }

    setProvider(nextProvider)
    setModel(nextModel)
  }

  const handleConfirmCreateSessionForProviderModel = async () => {
    if (!pendingProviderModel) return

    const session = await createSession(
      pendingProviderModel.provider,
      pendingProviderModel.model
    )
    await useSettingsStore.getState().setAssistantLastSessionId(session.id)
    closeProviderModelConfirmModal()
  }

  const handleConfirmUpdateActiveSessionProviderModel = async () => {
    if (!pendingProviderModel || !activeSession) return

    await updateSessionProviderModel(
      activeSession.id,
      pendingProviderModel.provider,
      pendingProviderModel.model
    )
    await useSettingsStore.getState().setAssistantLastSessionId(activeSession.id)
    closeProviderModelConfirmModal()
  }

  const handleNewSession = () => {
    setSelectedCaseForSession(null)
    setCaseSearchQuery('')
    setShowNewSessionModal(true)
    setShowSessionList(false)
  }

  const handleCreateSessionWithCase = async () => {
    const session = await createSession(
      effectiveProvider,
      effectiveModel,
      selectedCaseForSession || undefined
    )
    await useSettingsStore.getState().setAssistantLastSessionId(session.id)
    setShowNewSessionModal(false)
    setSelectedCaseForSession(null)
    setCaseSearchQuery('')
  }

  // Filter cases based on search query
  const filteredCases = cases.filter(c =>
    c.title.toLowerCase().includes(caseSearchQuery.toLowerCase()) ||
    c.case_number?.toLowerCase().includes(caseSearchQuery.toLowerCase()) ||
    c.type?.toLowerCase().includes(caseSearchQuery.toLowerCase())
  )

  const handleSelectSession = async (sessionId: number) => {
    await loadSession(sessionId)
    await useSettingsStore.getState().setAssistantLastSessionId(sessionId)
    setShowSessionList(false)
  }

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation()
    const deletingActiveSession = activeSession?.id === sessionId
    const fallbackSession = deletingActiveSession
      ? sessions.find((session) => session.id !== sessionId)
      : activeSession

    if (isTauri) {
      await removeAttachmentFilesForSession(sessionId)
    }
    await deleteSession(sessionId)

    if (!isTauri) return

    if (deletingActiveSession && fallbackSession) {
      await loadSession(fallbackSession.id)
      await useSettingsStore.getState().setAssistantLastSessionId(fallbackSession.id)
      return
    }

    if (deletingActiveSession) {
      await useSettingsStore.getState().setAssistantLastSessionId(null)
    }
  }

  // Clear local chat (for non-Tauri mode)
  const handleClearLocalChat = () => {
    setLocalMessages([])
    setLocalError(null)
  }

  // Calculate total size of uploaded files
  const getTotalUploadedSize = () =>
    uploadedFiles.reduce((sum, f) => sum + f.size, 0)

  const ensureAttachmentDirectory = async (sessionId: number): Promise<string> => {
    const { appDataDir, join } = await import('@tauri-apps/api/path')
    const { mkdir, exists } = await import('@tauri-apps/plugin-fs')
    const appData = await appDataDir()
    const attachmentsDir = await join(appData, 'chat_attachments', String(sessionId))
    const dirExists = await exists(attachmentsDir)
    if (!dirExists) {
      await mkdir(attachmentsDir, { recursive: true })
    }
    return attachmentsDir
  }

  const saveAttachmentFile = async (
    sessionId: number,
    fileName: string,
    buffer: ArrayBuffer,
    localId: number
  ): Promise<string> => {
    const safeName = fileName.replace(/[^\w.-]/g, '_')
    const attachmentsDir = await ensureAttachmentDirectory(sessionId)
    const { join } = await import('@tauri-apps/api/path')
    const storedName = `${Date.now()}_${localId}_${safeName}`
    const filePath = await join(attachmentsDir, storedName)
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    await writeFile(filePath, new Uint8Array(buffer))
    return filePath
  }

  const removeAttachmentFile = async (filePath?: string | null) => {
    if (!filePath) return
    try {
      const { remove } = await import('@tauri-apps/plugin-fs')
      await remove(filePath)
    } catch (error) {
      console.error('Error removing attachment file:', error)
    }
  }

  const removeAttachmentFilesForSession = async (sessionId: number) => {
    try {
      const attachments = await getChatAttachmentsBySession(sessionId)
      for (const attachment of attachments) {
        await removeAttachmentFile(attachment.file_path)
      }
    } catch (error) {
      console.error('Error removing session attachments:', error)
    }
  }

  const persistUploadedFile = async (file: UploadedFile, sessionId: number) => {
    if (!isTauri || file.dbId) return
    try {
      const dbId = await createChatAttachment(sessionId, {
        name: file.name,
        file_path: file.storedPath ?? null,
        file_type: file.type,
        extracted_text: file.extractedText,
        size_bytes: file.size,
        error: file.error,
      })
      if (!isMountedRef.current) return
      setUploadedFiles((prev) =>
        prev.map((item) =>
          item.id === file.id ? { ...item, dbId } : item
        )
      )
    } catch (error) {
      if (file.storedPath) {
        await removeAttachmentFile(file.storedPath)
      }
      if (isMountedRef.current) {
        setUploadedFiles((prev) =>
          prev.map((item) =>
            item.id === file.id
              ? {
                ...item,
                storedPath: undefined,
                error: item.error || 'Falha ao salvar no banco',
              }
              : item
          )
        )
      }
      console.error('Error saving chat attachment:', error)
    }
  }

  const persistPendingUploads = async (sessionId: number, files: UploadedFile[]) => {
    const pending = files.filter((file) => !file.dbId)
    for (const file of pending) {
      await persistUploadedFile(file, sessionId)
    }
  }

  // Handle file upload for direct chat attachments
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)

    try {
      let currentSession = activeSession
      if (isTauri && !currentSession) {
        currentSession = await createSession(effectiveProvider, effectiveModel)
        await useSettingsStore.getState().setAssistantLastSessionId(currentSession.id)
      }

      const fileArray = Array.from(files)
      let currentTotalSize = getTotalUploadedSize()
      let currentFileCount = uploadedFiles.length

      for (const file of fileArray) {
        // Check if component is still mounted before updating state
        if (!isMountedRef.current) return

        // Check file count limit
        if (currentFileCount >= MAX_FILE_COUNT) {
          setUploadedFiles(prev => [...prev, {
            id: getNextId(),
            name: file.name,
            type: 'unknown',
            extractedText: '',
            size: file.size,
            error: `Limite de arquivos atingido (máx. ${MAX_FILE_COUNT})`,
          }])
          continue
        }

        // Check individual file size
        if (file.size > MAX_FILE_SIZE) {
          setUploadedFiles(prev => [...prev, {
            id: getNextId(),
            name: file.name,
            type: 'unknown',
            extractedText: '',
            size: file.size,
            error: `Arquivo muito grande (máx. ${formatFileSize(MAX_FILE_SIZE)})`,
          }])
          currentFileCount++
          continue
        }

        // Check total size limit
        if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
          setUploadedFiles(prev => [...prev, {
            id: getNextId(),
            name: file.name,
            type: 'unknown',
            extractedText: '',
            size: file.size,
            error: `Limite total atingido (máx. ${formatFileSize(MAX_TOTAL_SIZE)})`,
          }])
          currentFileCount++
          continue
        }

        // Check file type
        if (!isSupportedFileType(file.name)) {
          setUploadedFiles(prev => [...prev, {
            id: getNextId(),
            name: file.name,
            type: 'unknown',
            extractedText: '',
            size: file.size,
            error: 'Tipo de arquivo não suportado',
          }])
          currentFileCount++
          continue
        }

        const localId = getNextId()
        const arrayBuffer = await file.arrayBuffer()
        const result = await extractFromBuffer(arrayBuffer, file.name)
        let storedPath: string | undefined
        let storageError: string | undefined

        if (isTauri && currentSession?.id) {
          try {
            storedPath = await saveAttachmentFile(
              currentSession.id,
              file.name,
              arrayBuffer,
              localId
            )
          } catch (error) {
            console.error('Error saving attachment file:', error)
            storageError = 'Falha ao salvar o arquivo'
          }
        }

        // Check again after async operation
        if (!isMountedRef.current) return

        const newFile: UploadedFile = {
          id: localId,
          name: file.name,
          type: result.type,
          extractedText: result.text,
          size: file.size,
          error: result.error || storageError,
          storedPath,
        }

        setUploadedFiles(prev => [...prev, newFile])

        if (isTauri && currentSession?.id) {
          await persistUploadedFile(newFile, currentSession.id)
        }

        currentTotalSize += file.size
        currentFileCount++
      }
    } catch (error) {
      console.error('Error uploading files:', error)
    } finally {
      // Only update state if still mounted
      if (isMountedRef.current) {
        setIsUploading(false)
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
  }

  // Remove uploaded file
  const handleRemoveUploadedFile = async (fileId: number) => {
    const target = uploadedFiles.find((file) => file.id === fileId)
    if (isTauri && target?.dbId) {
      deleteChatAttachment(target.dbId).catch((error) => {
        console.error('Error deleting chat attachment:', error)
      })
    }
    if (isTauri) {
      await removeAttachmentFile(target?.storedPath)
    }
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // Clear all uploaded files
  const handleClearUploadedFiles = async () => {
    if (isTauri && activeSession?.id) {
      await removeAttachmentFilesForSession(activeSession.id)
      try {
        await deleteChatAttachmentsBySession(activeSession.id)
      } catch (error) {
        console.error('Error clearing chat attachments:', error)
      }
    }
    setUploadedFiles([])
  }

  // Get icon for file type
  const getFileIcon = (type: FileType) => {
    switch (type) {
      case 'pdf':
        return <FileText className="size-3" />
      case 'csv':
      case 'excel':
        return <FileSpreadsheet className="size-3" />
      case 'word':
      case 'text':
        return <File className="size-3" />
      default:
        return <File className="size-3" />
    }
  }

  // Build context from uploaded files
  const buildUploadedFilesContext = (): string | undefined => {
    const validFiles = uploadedFiles.filter(f => f.extractedText && !f.error)
    if (validFiles.length === 0) return undefined

    const filesText = validFiles
      .map(f => `[Arquivo anexado: ${f.name}]\n${f.extractedText}`)
      .join('\n\n---\n\n')

    return filesText
  }

  // Build context from selected documents (loads text on demand)
  const buildDocumentContext = async (): Promise<string | undefined> => {
    if (selectedDocs.length === 0) return undefined

    const selectedDocuments = documents.filter(d => selectedDocs.includes(d.id))
    if (selectedDocuments.length === 0) return undefined

    // Load extracted text on demand for each selected document
    const docsWithText = await Promise.all(
      selectedDocuments.map(async (d) => {
        let extractedText = await getExtractedText(d.id)
        if (extractedText === null) {
          try {
            extractedText = await extractDocumentText(d.id)
          } catch (error) {
            console.error('Error extracting document text:', error)
          }
        }
        return `[Documento: ${d.name}]\n${extractedText || 'Sem texto extraído'}`
      })
    )

    const docsText = docsWithText.join('\n\n---\n\n')
    return docsText
  }

  const handleSend = async () => {
    const currentLoading = isTauri ? isLoading : localLoading
    if (!input.trim() || currentLoading) return

    const apiKey = effectiveProvider === 'claude'
      ? claudeApiKey
      : effectiveProvider === 'openai'
        ? openaiApiKey
        : effectiveProvider === 'gemini'
          ? geminiApiKey
          : undefined

    if (providers.find((p) => p.id === effectiveProvider)?.requiresKey && !apiKey) {
      if (isTauri) {
        useChatStore.setState({
          error: `Configure a API key do ${effectiveProvider} nas configuracoes`,
        })
      } else {
        setLocalError(`Configure a API key do ${effectiveProvider} nas configuracoes`)
      }
      return
    }

    const userMessage = input.trim()
    const documentContext = await buildDocumentContext()
    const uploadedFilesContext = buildUploadedFilesContext()

    // Combine all contexts
    const allContexts = [uploadedFilesContext, documentContext].filter(Boolean).join('\n\n---\n\n')
    const messageWithContext = allContexts
      ? `Contexto dos documentos/arquivos anexados:\n\n${allContexts}\n\n---\n\nPergunta do usuario:\n\n${userMessage}`
      : userMessage

    setInput('')

    // Mode without Tauri: use local state and direct API call
    if (!isTauri) {
      const userMsg: LocalMessage = {
        id: getNextId(),
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      }
      setLocalMessages((prev) => [...prev, userMsg])
      setLocalLoading(true)
      setLocalError(null)

      // Cancel any previous request and create new AbortController
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      try {
        const messagesForAI = localMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }))
        messagesForAI.push({ role: 'user' as const, content: messageWithContext })

        const response = await sendAIMessage(
          effectiveProvider,
          effectiveModel,
          messagesForAI,
          apiKey || undefined,
          undefined,
          abortControllerRef.current.signal
        )

        const assistantMsg: LocalMessage = {
          id: getNextId(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        }
        setLocalMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        if (isMountedRef.current) {
          setLocalError(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
        }
      } finally {
        if (isMountedRef.current) {
          setLocalLoading(false)
        }
      }
      return
    }

    // Mode with Tauri: use store (with database)
    let session = activeSession
    if (!session) {
      session = await createSession(effectiveProvider, effectiveModel)
      await useSettingsStore.getState().setAssistantLastSessionId(session.id)
    }

    if (session) {
      await persistPendingUploads(session.id, uploadedFiles)
    }

    const sessionProvider = session?.provider || effectiveProvider

    const claudeSettings = sessionProvider === 'claude' ? {
      thinkingEnabled: claudeThinkingEnabled !== 'false',
      webSearchEnabled: claudeWebSearchEnabled !== 'false',
      cacheEnabled: claudeCacheEnabled !== 'false',
    } : undefined

    const openaiSettings = sessionProvider === 'openai' ? {
      reasoningEnabled: openaiReasoningEnabled !== 'false',
      webSearchEnabled: openaiWebSearchEnabled !== 'false',
      cacheEnabled: openaiCacheEnabled !== 'false',
    } : undefined

    const geminiSettings = sessionProvider === 'gemini' ? {
      thinkingEnabled: geminiThinkingEnabled !== 'false',
      webSearchEnabled: geminiWebSearchEnabled !== 'false',
    } : undefined

    await send(userMessage, {
      apiKey: apiKey || undefined,
      context: allContexts || undefined,
      claudeSettings,
      openaiSettings,
      geminiSettings,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getAvailableModels = () => {
    if (effectiveProvider === 'ollama') {
      return ollamaModels.map((m) => m.name)
    }
    return RECOMMENDED_MODELS[effectiveProvider]
  }

  const welcomeMessage: LocalMessage = {
    id: 0,
    role: 'assistant',
    content: 'Olá! Sou seu assistente jurídico. Posso ajudar com análise de casos, elaboração de peças processuais, pesquisa de jurisprudência e muito mais. Como posso ajudá-lo hoje?',
    timestamp: new Date(),
  }

  // Use local messages when not in Tauri mode
  const currentMessages = isTauri ? messages : localMessages
  const displayMessages = currentMessages.length > 0 ? currentMessages : [welcomeMessage]
  const currentLoading = isTauri ? isLoading : localLoading
  const currentError = isTauri ? error : localError

  // Get display settings based on provider
  const showCosts = effectiveProvider === 'claude'
    ? claudeShowCosts !== 'false'
    : effectiveProvider === 'openai'
      ? openaiShowCosts !== 'false'
      : effectiveProvider === 'gemini'
        ? geminiShowCosts !== 'false'
        : false

  useEffect(() => {
    messagesListRef.current?.resetAfterIndex(0, true)
  }, [displayMessages, currentLoading, showCosts])

  const getMessageItemHeight = useCallback(
    (index: number) => {
      const loadingIndex = displayMessages.length
      if (currentLoading && index === loadingIndex) {
        return 84
      }

      const message = displayMessages[index]
      if (!message) return 92

      const textLines = Math.max(1, Math.ceil(message.content.length / 70))
      let height = 44 + textLines * 22
      if (message.thinking_content) height += 150
      if (message.web_search_results && message.web_search_results.length > 0) {
        height += 90 + message.web_search_results.length * 40
      }
      if (message.cost_usd && showCosts) height += 28
      if (message.intent_profile && message.role === 'assistant') height += 18
      return Math.min(Math.max(height, 92), 560)
    },
    [displayMessages, currentLoading, showCosts]
  )

  const handleVirtualMessagesScroll = useCallback(
    ({ scrollOffset }: { scrollOffset: number }) => {
      if (
        scrollOffset <= 50 &&
        messagesPagination.hasMore &&
        !messagesPagination.isLoadingMore &&
        isTauri &&
        messagesContainerRef.current
      ) {
        handleMessagesScroll({
          currentTarget: messagesContainerRef.current,
        } as React.UIEvent<HTMLDivElement>)
      }
    },
    [handleMessagesScroll, isTauri, messagesPagination.hasMore, messagesPagination.isLoadingMore]
  )

  // Get current intent profile from chatStore (for loading indicator)
  const { currentIntentProfile } = useChatStore()

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border-dark mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Assistente Jurídico IA</h1>
          <p className="text-gray-400 text-sm">
            Análise de casos, peças processuais e jurisprudência
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Ollama Status */}
          {effectiveProvider === 'ollama' && (
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border',
                ollamaStatus === 'online' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                ollamaStatus === 'offline' && 'bg-red-500/10 text-red-400 border-red-500/20',
                ollamaStatus === 'checking' && 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
              )}
            >
              {ollamaStatus === 'online' && <Check className="size-3" />}
              {ollamaStatus === 'offline' && <AlertCircle className="size-3" />}
              {ollamaStatus === 'checking' && <Loader2 className="size-3 animate-spin" />}
              <span>
                {ollamaStatus === 'online' && 'Ollama Online'}
                {ollamaStatus === 'offline' && 'Ollama Offline'}
                {ollamaStatus === 'checking' && 'Verificando...'}
              </span>
            </div>
          )}

          {/* Provider Selector */}
          <div className="relative">
            <button
              onClick={() => setShowProviderMenu(!showProviderMenu)}
              aria-expanded={showProviderMenu}
              aria-haspopup="menu"
              aria-label="Selecionar provider de IA"
              className="flex items-center gap-2 px-3 py-2 bg-surface-dark border border-border-dark rounded-lg text-sm text-white hover:bg-surface-highlight transition-colors"
            >
              <span>{providers.find((p) => p.id === effectiveProvider)?.name}</span>
              <ChevronDown className="size-4" />
            </button>
            {showProviderMenu && (
              <div
                role="menu"
                aria-orientation="vertical"
                aria-label="Providers disponíveis"
                className="absolute right-0 mt-2 w-48 bg-surface-dark border border-border-dark rounded-lg shadow-xl z-10"
              >
                {providers.map((p) => (
                  <button
                    key={p.id}
                    role="menuitem"
                    onClick={() => {
                      const nextModel = getFallbackModelForProvider(p.id, ollamaModels, effectiveModel)
                      requestProviderModelChange(p.id, nextModel)
                      setShowProviderMenu(false)
                    }}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm hover:bg-surface-highlight transition-colors',
                      effectiveProvider === p.id ? 'text-primary' : 'text-white'
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              aria-expanded={showModelMenu}
              aria-haspopup="menu"
              aria-label="Selecionar modelo de IA"
              className="flex items-center gap-2 px-3 py-2 bg-surface-dark border border-border-dark rounded-lg text-sm text-white hover:bg-surface-highlight transition-colors"
            >
              <span className="max-w-[120px] truncate">{effectiveModel}</span>
              <ChevronDown className="size-4" />
            </button>
            {showModelMenu && (
              <div
                role="menu"
                aria-orientation="vertical"
                aria-label="Modelos disponíveis"
                className="absolute right-0 mt-2 w-48 bg-surface-dark border border-border-dark rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto"
              >
                {getAvailableModels().map((m) => (
                  <button
                    key={m}
                    role="menuitem"
                    onClick={() => {
                      requestProviderModelChange(effectiveProvider, m)
                      setShowModelMenu(false)
                    }}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm hover:bg-surface-highlight transition-colors',
                      effectiveModel === m ? 'text-primary' : 'text-white'
                    )}
                  >
                    {m}
                  </button>
                ))}
                {getAvailableModels().length === 0 && (
                  <div className="px-4 py-2 text-sm text-gray-500">
                    Nenhum modelo disponível
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Session List - Only show in Tauri mode */}
          {isTauri && (
            <div className="relative">
              <button
                onClick={() => setShowSessionList(!showSessionList)}
                className="p-2 bg-surface-dark border border-border-dark rounded-lg hover:bg-surface-highlight transition-colors"
              >
                <MessageSquare className="size-5 text-white" />
              </button>
              {showSessionList && (
                <div className="absolute right-0 mt-2 w-72 bg-surface-dark border border-border-dark rounded-lg shadow-xl z-10">
                  <div className="p-2 border-b border-border-dark">
                    <button
                      onClick={handleNewSession}
                      className="flex items-center gap-2 w-full px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors"
                    >
                      <Plus className="size-4" />
                      Nova Conversa
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {sessions.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        Nenhuma conversa
                      </div>
                    )}
                    {sessions.length > 0 && sessions.length <= SESSION_VIRTUALIZATION_THRESHOLD && (
                      sessions.map((session) => {
                        const linkedCase = session.case_id
                          ? cases.find(c => c.id === session.case_id)
                          : null
                        return (
                          <div
                            key={session.id}
                            onClick={() => handleSelectSession(session.id)}
                            className={cn(
                              'flex items-center justify-between px-3 py-2 hover:bg-surface-highlight cursor-pointer group',
                              activeSession?.id === session.id && 'bg-surface-highlight'
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              {linkedCase && (
                                <p className="text-xs text-primary flex items-center gap-1 mb-0.5">
                                  <Scale className="size-3" />
                                  {linkedCase.title}
                                </p>
                              )}
                              <p className="text-sm text-white truncate">
                                {session.title || 'Nova conversa'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {session.provider} - {session.model}
                              </p>
                            </div>
                            <button
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                            >
                              <Trash2 className="size-4 text-red-400" />
                            </button>
                          </div>
                        )
                      })
                    )}
                    {sessions.length > SESSION_VIRTUALIZATION_THRESHOLD && (
                      <List
                        height={300}
                        itemCount={sessions.length}
                        itemSize={SESSION_ITEM_HEIGHT}
                        width="100%"
                      >
                        {({ index, style }) => {
                          const session = sessions[index]
                          const linkedCase = session.case_id
                            ? cases.find(c => c.id === session.case_id)
                            : null
                          return (
                            <div
                              style={style}
                              key={session.id}
                              onClick={() => handleSelectSession(session.id)}
                              className={cn(
                                'flex items-center justify-between px-3 py-2 hover:bg-surface-highlight cursor-pointer group',
                                activeSession?.id === session.id && 'bg-surface-highlight'
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                {linkedCase && (
                                  <p className="text-xs text-primary flex items-center gap-1 mb-0.5">
                                    <Scale className="size-3" />
                                    {linkedCase.title}
                                  </p>
                                )}
                                <p className="text-sm text-white truncate">
                                  {session.title || 'Nova conversa'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {session.provider} - {session.model}
                                </p>
                              </div>
                              <button
                                onClick={(e) => handleDeleteSession(e, session.id)}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                              >
                                <Trash2 className="size-4 text-red-400" />
                              </button>
                            </div>
                          )
                        }}
                      </List>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* New Session/Clear Chat Button - Always visible */}
          <button
            onClick={isTauri ? handleNewSession : handleClearLocalChat}
            className="p-2 bg-surface-dark border border-border-dark rounded-lg hover:bg-surface-highlight transition-colors"
            title={isTauri ? "Nova conversa" : "Limpar conversa"}
          >
            <Plus className="size-5 text-white" />
          </button>
        </div>
      </div>

      {/* Environment Warning */}
      {!isTauri && (
        <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertCircle className="size-4" />
            Ambiente de Desenvolvimento
          </div>
          <p className="text-yellow-400/80">
            O banco de dados não está disponível. Execute com <code className="bg-yellow-500/20 px-1 rounded">npm run tauri dev</code> para funcionalidade completa.
          </p>
          <p className="text-yellow-400/80 mt-1">
            O chat ainda funciona se o Ollama estiver rodando em <code className="bg-yellow-500/20 px-1 rounded">localhost:11434</code>
          </p>
        </div>
      )}

      {/* Ollama Offline Warning */}
      {effectiveProvider === 'ollama' && ollamaStatus === 'offline' && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertCircle className="size-4" />
            Ollama não está rodando
          </div>
          <p className="text-red-400/80">
            Inicie o Ollama com <code className="bg-red-500/20 px-1 rounded">ollama serve</code> ou selecione outro provider (Claude/OpenAI).
          </p>
        </div>
      )}

      {/* Error */}
      {currentError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          {currentError}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 pr-2">
        {/* Loading indicator for infinite scroll */}
        {messagesPagination.isLoadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-5 text-primary animate-spin" />
          </div>
        )}
        {/* Load more indicator */}
        {messagesPagination.hasMore && !messagesPagination.isLoadingMore && isTauri && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-gray-500">Role para cima para carregar mais...</span>
          </div>
        )}
        <div className="h-[calc(100%-2rem)] min-h-[220px]">
          <AutoSizer>
            {({ height, width }) => {
              const itemCount = displayMessages.length + (currentLoading ? 1 : 0)
              return (
                <VariableSizeList
                  ref={messagesListRef}
                  outerRef={messagesContainerRef}
                  onScroll={handleVirtualMessagesScroll}
                  height={height}
                  width={width}
                  itemCount={itemCount}
                  itemSize={getMessageItemHeight}
                  itemKey={(index) =>
                    currentLoading && index === displayMessages.length
                      ? 'loading'
                      : String(displayMessages[index]?.id ?? index)
                  }
                >
                  {({ index, style }) => {
                    if (currentLoading && index === displayMessages.length) {
                      return (
                        <div style={style} className="px-1 py-2">
                          <div className="flex gap-3">
                            <div className="size-8 rounded-full bg-surface-highlight flex items-center justify-center">
                              <Bot className="size-4 text-primary" />
                            </div>
                            <div className="bg-surface-dark border border-border-dark rounded-xl px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Loader2 className="size-5 text-primary animate-spin" />
                                {currentIntentProfile && (effectiveProvider === 'claude' || effectiveProvider === 'openai' || effectiveProvider === 'gemini') && (
                                  <span className="text-xs text-gray-400">
                                    {getProfileDescription(currentIntentProfile)}...
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    const message = displayMessages[index]
                    if (!message) return null

                    return (
                      <div style={style} className="px-1 py-2">
                        <div
                          className={cn(
                            'flex gap-3',
                            message.role === 'user' ? 'flex-row-reverse' : ''
                          )}
                        >
                          <div
                            className={cn(
                              'size-8 rounded-full flex items-center justify-center shrink-0',
                              message.role === 'user' ? 'bg-primary' : 'bg-surface-highlight'
                            )}
                          >
                            {message.role === 'user' ? (
                              <User className="size-4 text-white" />
                            ) : (
                              <Bot className="size-4 text-primary" />
                            )}
                          </div>
                          <div
                            className={cn(
                              'max-w-[80%] rounded-xl px-4 py-3',
                              message.role === 'user'
                                ? 'bg-primary text-white'
                                : 'bg-surface-dark border border-border-dark text-white'
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                            {message.thinking_content && (
                              <ThinkingBlock content={message.thinking_content} />
                            )}

                            {message.web_search_results && message.web_search_results.length > 0 && (
                              <WebSearchResults results={message.web_search_results} />
                            )}

                            {message.cost_usd && showCosts && (
                              <MessageCost costUsd={message.cost_usd} />
                            )}

                            <p
                              className={cn(
                                'text-xs mt-2',
                                message.role === 'user' ? 'text-white/70' : 'text-gray-500'
                              )}
                            >
                              {message.timestamp.toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {message.intent_profile && message.role === 'assistant' && (
                                <span className="ml-2 px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[10px]">
                                  {getProfileDescription(message.intent_profile)}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                </VariableSizeList>
              )
            }}
          </AutoSizer>
        </div>
      </div>

      {/* Input */}
      <div className="mt-4 pt-4 border-t border-border-dark">
        {/* Uploaded Files Badge */}
        {uploadedFiles.length > 0 && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs text-gray-400">Arquivos carregados:</span>
            {uploadedFiles.map(file => (
              <span
                key={file.id}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border",
                  file.error
                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                )}
              >
                {getFileIcon(file.type)}
                <span className="max-w-[120px] truncate">{file.name}</span>
                <span className="text-[10px] opacity-70">
                  ({formatFileSize(file.size)})
                </span>
                {file.error ? (
                  <span title={file.error}><AlertCircle className="size-3" /></span>
                ) : (
                  <span title="Texto extraído"><Check className="size-3" /></span>
                )}
                <button
                  onClick={() => handleRemoveUploadedFile(file.id)}
                  className="hover:bg-white/10 rounded-full p-0.5"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <button
              onClick={handleClearUploadedFiles}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Limpar todos
            </button>
          </div>
        )}

        {/* Selected Documents Badge */}
        {selectedDocs.length > 0 && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs text-gray-400">Documentos anexados:</span>
            {documents
              .filter(d => selectedDocs.includes(d.id))
              .map(doc => (
                <span
                  key={doc.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/30"
                >
                  <FileText className="size-3" />
                  <span className="max-w-[150px] truncate">{doc.name}</span>
                  <button
                    onClick={() => setSelectedDocs(prev => prev.filter(id => id !== doc.id))}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            <button
              onClick={() => setSelectedDocs([])}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Limpar todos
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {/* Hidden file input for upload */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={getSupportedExtensions().join(',')}
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Upload File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              'p-3 rounded-lg border transition-colors relative',
              uploadedFiles.length > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-surface-dark border-border-dark text-gray-400 hover:text-white hover:bg-surface-highlight',
              isUploading && 'opacity-50 cursor-not-allowed'
            )}
            title="Carregar arquivo (PDF, CSV, Excel, Word, TXT)"
          >
            {isUploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            {uploadedFiles.length > 0 && !isUploading && (
              <span className="absolute -top-1 -right-1 size-5 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center">
                {uploadedFiles.length}
              </span>
            )}
          </button>

          {/* Document Selector Button - Only in Tauri mode */}
          {isTauri && (
            <div className="relative">
              <button
                onClick={() => setShowDocSelector(!showDocSelector)}
                className={cn(
                  'p-3 rounded-lg border transition-colors relative',
                  selectedDocs.length > 0
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-surface-dark border-border-dark text-gray-400 hover:text-white hover:bg-surface-highlight'
                )}
                title="Anexar documentos do sistema"
              >
                <Paperclip className="size-5" />
                {selectedDocs.length > 0 && (
                  <span className="absolute -top-1 -right-1 size-5 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                    {selectedDocs.length}
                  </span>
                )}
              </button>

              {/* Document Selector Dropdown */}
              {showDocSelector && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-surface-dark border border-border-dark rounded-lg shadow-xl z-10">
                  <div className="p-3 border-b border-border-dark">
                    <h3 className="text-sm font-medium text-white">Anexar Documentos</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Selecione documentos para usar como contexto
                    </p>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {documents.length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500">
                        Nenhum documento disponível
                      </div>
                    )}
                    {documents.map(doc => (
                      <label
                        key={doc.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-surface-highlight cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocs.includes(doc.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDocs(prev => [...prev, doc.id])
                            } else {
                              setSelectedDocs(prev => prev.filter(id => id !== doc.id))
                            }
                          }}
                          className="size-4 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{doc.name}</p>
                          <p className="text-xs text-gray-500">
                            {doc.extracted_text && doc.extracted_text !== '__LAZY_LOAD__' ? 'Texto extraído' : doc.extracted_text === '__LAZY_LOAD__' ? 'Texto disponível' : 'Sem texto'}
                          </p>
                        </div>
                        <FileText className="size-4 text-gray-500 shrink-0" />
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t border-border-dark">
                    <button
                      onClick={() => setShowDocSelector(false)}
                      className="w-full px-3 py-2 bg-primary/10 text-primary rounded text-sm hover:bg-primary/20 transition-colors"
                    >
                      Confirmar ({selectedDocs.length} selecionados)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 relative">
            <label htmlFor="ai-message-input" className="sr-only">
              Digite sua mensagem para o assistente jurídico
            </label>
            <textarea
              id="ai-message-input"
              name="message"
              aria-label="Digite sua mensagem para o assistente jurídico"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                effectiveProvider === 'ollama' && ollamaStatus === 'offline'
                  ? 'Ollama não está rodando...'
                  : uploadedFiles.length > 0 || selectedDocs.length > 0
                    ? `Pergunte sobre os ${uploadedFiles.length + selectedDocs.length} arquivo(s)/documento(s) anexado(s)...`
                    : 'Digite sua mensagem...'
              }
              disabled={effectiveProvider === 'ollama' && ollamaStatus === 'offline'}
              rows={1}
              className="w-full bg-surface-dark border border-border-dark rounded-lg px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || currentLoading || (effectiveProvider === 'ollama' && ollamaStatus === 'offline')}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all active:scale-95',
                input.trim() && !currentLoading && !(effectiveProvider === 'ollama' && ollamaStatus === 'offline')
                  ? 'bg-primary hover:bg-primary-dark text-white'
                  : 'bg-surface-highlight text-gray-500'
              )}
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Provider: {providers.find((p) => p.id === effectiveProvider)?.name} | Modelo: {effectiveModel}
          {isTauri && activeSession && ` | Sessão: ${activeSession.id}`}
          {!isTauri && ' | Modo Local (sem persistência)'}
          {uploadedFiles.length > 0 && ` | ${uploadedFiles.length} arquivo(s)`}
          {selectedDocs.length > 0 && ` | ${selectedDocs.length} doc(s)`}
        </p>
      </div>

      {/* Click outside handlers */}
      {(showProviderMenu || showModelMenu || showSessionList || showDocSelector) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowProviderMenu(false)
            setShowModelMenu(false)
            setShowSessionList(false)
            setShowDocSelector(false)
          }}
        />
      )}

      <Modal
        isOpen={showProviderModelConfirmModal}
        onClose={closeProviderModelConfirmModal}
        title="Alterar provider/modelo"
        description="Escolha como aplicar a mudanca para manter o contexto da conversa."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={closeProviderModelConfirmModal}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={handleConfirmUpdateActiveSessionProviderModel}
              disabled={!activeSession || !pendingProviderModel}
            >
              Atualizar conversa atual
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmCreateSessionForProviderModel}
              disabled={!pendingProviderModel}
            >
              Criar nova conversa
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
          <p>
            Conversa ativa: <span className="text-[var(--color-text-primary)]">#{activeSession?.id}</span>
          </p>
          <p>
            Destino: <span className="text-[var(--color-text-primary)]">
              {providers.find((p) => p.id === pendingProviderModel?.provider)?.name || '-'} / {pendingProviderModel?.model || '-'}
            </span>
          </p>
        </div>
      </Modal>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop"
            onClick={() => {
              setShowNewSessionModal(false)
              setSelectedCaseForSession(null)
              setCaseSearchQuery('')
            }}
          />
          <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-md mx-4 shadow-lg motion-overlay-panel">
            <div className="flex items-center justify-between p-5 border-b border-border-dark">
              <h2 className="text-lg font-semibold text-white">
                Nova Conversa
              </h2>
              <button
                onClick={() => {
                  setShowNewSessionModal(false)
                  setSelectedCaseForSession(null)
                  setCaseSearchQuery('')
                }}
                className="p-1 hover:bg-surface-highlight rounded transition-colors"
              >
                <X className="size-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Case Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Vincular a um caso? (opcional)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  A conversa será associada ao caso selecionado para melhor organização
                </p>

                {/* Search */}
                <div className="relative mb-3">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="size-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={caseSearchQuery}
                    onChange={(e) => setCaseSearchQuery(e.target.value)}
                    placeholder="Buscar caso..."
                    className="w-full pl-9 pr-3 py-2 border border-border-dark rounded-lg bg-background-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                </div>

                {/* Options */}
                <div className="max-h-48 overflow-y-auto space-y-1 border border-border-dark rounded-lg bg-background-dark">
                  {/* No link option */}
                  <label className="flex items-center gap-3 px-3 py-2 hover:bg-surface-highlight cursor-pointer border-b border-border-dark">
                    <input
                      type="radio"
                      name="caseSelector"
                      checked={selectedCaseForSession === null}
                      onChange={() => setSelectedCaseForSession(null)}
                      className="size-4 border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-white">Sem vínculo</p>
                      <p className="text-xs text-gray-500">Conversa geral</p>
                    </div>
                  </label>

                  {/* Cases */}
                  {filteredCases.length === 0 && caseSearchQuery && (
                    <div className="px-3 py-3 text-sm text-gray-500 text-center">
                      Nenhum caso encontrado
                    </div>
                  )}
                  {filteredCases.length === 0 && !caseSearchQuery && cases.length === 0 && (
                    <div className="px-3 py-3 text-sm text-gray-500 text-center">
                      Nenhum caso cadastrado
                    </div>
                  )}
                  {filteredCases.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-surface-highlight cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="caseSelector"
                        checked={selectedCaseForSession === c.id}
                        onChange={() => setSelectedCaseForSession(c.id)}
                        className="size-4 border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{c.title}</p>
                        <p className="text-xs text-gray-500">
                          {c.case_number && `${c.case_number} • `}{c.type || 'Sem tipo'}
                        </p>
                      </div>
                      <Scale className="size-4 text-gray-500 shrink-0" />
                    </label>
                  ))}
                </div>
              </div>

              {/* Provider/Model Info */}
              <div className="flex gap-3 p-3 bg-background-dark rounded-lg">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Provider</p>
                  <p className="text-sm text-white">{providers.find((p) => p.id === effectiveProvider)?.name}</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Modelo</p>
                  <p className="text-sm text-white">{effectiveModel}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-dark">
                <button
                  onClick={() => {
                    setShowNewSessionModal(false)
                    setSelectedCaseForSession(null)
                    setCaseSearchQuery('')
                  }}
                  className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateSessionWithCase}
                  className="px-4 py-2.5 bg-primary hover:bg-primary-dark rounded-lg text-white text-sm font-medium transition-all active:scale-95"
                >
                  Criar Conversa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

