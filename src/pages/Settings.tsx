import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Key,
  Bot,
  Bell,
  Database,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  BellRing,
  Clock,
  Loader2,
  Download,
  Upload,
  Users,
  FolderOpen,
  Scale,
  HardDrive,
  User,
  Brain,
  Search,
  Zap,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settingsStore'
import { useClientStore } from '@/stores/clientStore'
import { useCaseStore } from '@/stores/caseStore'
import { useDocumentStore } from '@/stores/documentStore'
import { useFolderStore } from '@/stores/folderStore'
import { useDeadlineStore } from '@/stores/deadlineStore'
import { useChatStore } from '@/stores/chatStore'
import { BackupSettings } from '@/components/settings/BackupSettings'
import {
  isTauriEnvironment,
  exportDatabase,
  importDatabase,
  exportTableAsCSV,
  getDatabaseStats,
  getDatabaseHealth,
  DATABASE_CHANGED_EVENT,
  type DatabaseStats,
  type DatabaseBackup,
  type DatabaseHealth,
} from '@/lib/db'
import { checkNotificationPermission } from '@/lib/notifications'
import { testAPIConnection } from '@/lib/ai'

interface SettingsSection {
  id: string
  icon: React.ElementType
  title: string
  description: string
}

const sections: SettingsSection[] = [
  {
    id: 'profile',
    icon: User,
    title: 'Perfil do Advogado',
    description: 'Seu nome e registro profissional',
  },
  {
    id: 'interface',
    icon: Scale,
    title: 'Interface',
    description: 'Densidade e preferências visuais',
  },
  {
    id: 'ai',
    icon: Bot,
    title: 'Inteligência Artificial',
    description: 'Configure os provedores de IA e modelos',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notificações',
    description: 'Configure alertas e lembretes',
  },
  {
    id: 'database',
    icon: Database,
    title: 'Banco de Dados',
    description: 'Backup e exportação de dados',
  },
]

export default function Settings() {
  const location = useLocation()
  const [activeSection, setActiveSection] = useState('profile')
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [showClaudeKey, setShowClaudeKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [defaultProvider, setDefaultProvider] = useState('ollama')
  const [defaultModel, setDefaultModel] = useState('llama3.1')
  const [saved, setSaved] = useState(false)

  // Ref to track timeout for cleanup
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uiSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current)
      }
      if (uiSavedTimeoutRef.current) {
        clearTimeout(uiSavedTimeoutRef.current)
      }
      if (dbRefreshDebounceRef.current) {
        clearTimeout(dbRefreshDebounceRef.current)
      }
      if (dbUpdatedNowTimeoutRef.current) {
        clearTimeout(dbUpdatedNowTimeoutRef.current)
      }
    }
  }, [])

  // Lawyer profile
  const [lawyerName, setLawyerName] = useState('')
  const [lawyerOAB, setLawyerOAB] = useState('')

  // UI settings
  const [uiDensity, setUiDensity] = useState<'normal' | 'compact'>('normal')
  const [uiMotion, setUiMotion] = useState<'system' | 'normal' | 'reduced'>('system')
  const [uiSaved, setUiSaved] = useState(false)

  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [notifyOverdue, setNotifyOverdue] = useState(true)
  const [notifyUpcoming, setNotifyUpcoming] = useState(true)
  const [reminderDays, setReminderDays] = useState('1')
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'checking'>('checking')
  const [isTauri, setIsTauri] = useState(true)

  // Database/Backup settings
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null)
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null)
  const [dbHealthLoading, setDbHealthLoading] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [pendingImport, setPendingImport] = useState<DatabaseBackup | null>(null)
  const [lastDbRefreshAt, setLastDbRefreshAt] = useState<number | null>(null)
  const [dbUpdatedNow, setDbUpdatedNow] = useState(false)
  const dbRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dbUpdatedNowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // API Test states
  const [claudeTestStatus, setClaudeTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [openaiTestStatus, setOpenaiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [claudeTestError, setClaudeTestError] = useState<string | null>(null)
  const [openaiTestError, setOpenaiTestError] = useState<string | null>(null)

  // Claude Advanced Settings
  const [claudeThinkingEnabled, setClaudeThinkingEnabled] = useState(true)
  const [claudeWebSearchEnabled, setClaudeWebSearchEnabled] = useState(true)
  const [claudeCacheEnabled, setClaudeCacheEnabled] = useState(true)
  const [claudeDailyLimitUsd, setClaudeDailyLimitUsd] = useState('5.00')
  const [claudeShowCosts, setClaudeShowCosts] = useState(true)

  // OpenAI/GPT-5 Advanced Settings
  const [openaiReasoningEnabled, setOpenaiReasoningEnabled] = useState(true)
  const [openaiWebSearchEnabled, setOpenaiWebSearchEnabled] = useState(true)
  const [openaiCacheEnabled, setOpenaiCacheEnabled] = useState(true)
  const [openaiDailyLimitUsd, setOpenaiDailyLimitUsd] = useState('2.00')
  const [openaiShowCosts, setOpenaiShowCosts] = useState(true)

  // Google Gemini API
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [geminiTestStatus, setGeminiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [geminiTestError, setGeminiTestError] = useState<string | null>(null)

  // Gemini Advanced Settings
  const [geminiThinkingEnabled, setGeminiThinkingEnabled] = useState(true)
  const [geminiWebSearchEnabled, setGeminiWebSearchEnabled] = useState(true)
  const [geminiDailyLimitUsd, setGeminiDailyLimitUsd] = useState('3.00')
  const [geminiShowCosts, setGeminiShowCosts] = useState(true)

  const { setSetting, fetchSettings, loading: settingsLoading } = useSettingsStore()
  const { fetchClients } = useClientStore()
  const { fetchCases } = useCaseStore()
  const { fetchDocuments } = useDocumentStore()
  const { fetchFolders } = useFolderStore()
  const { fetchDeadlines } = useDeadlineStore()
  const { fetchSessions, clearMessages } = useChatStore()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const section = params.get('section')
    if (!section) return

    const isValidSection = sections.some((item) => item.id === section)
    if (isValidSection) {
      setActiveSection(section)
    }
  }, [location.search])

  const syncSettingsFromStore = () => {
    const settings = useSettingsStore.getState().settings

    // Load saved values
    const claudeKey = settings['claude_api_key']
    const openaiKey = settings['openai_api_key']
    const provider = settings['default_provider']
    const model = settings['default_model']
    const ollama = settings['ollama_url']
    const notifEnabled = settings['notifications_enabled']
    const notifOverdue = settings['notify_overdue']
    const notifUpcoming = settings['notify_upcoming']
    const remindDays = settings['reminder_days']

    if (claudeKey) setClaudeApiKey(claudeKey)
    if (openaiKey) setOpenaiApiKey(openaiKey)
    if (provider) setDefaultProvider(provider)
    if (model) setDefaultModel(model)
    if (ollama) setOllamaUrl(ollama)
    if (notifEnabled !== undefined) setNotificationsEnabled(notifEnabled !== 'false')
    if (notifOverdue !== undefined) setNotifyOverdue(notifOverdue !== 'false')
    if (notifUpcoming !== undefined) setNotifyUpcoming(notifUpcoming !== 'false')
    if (remindDays) setReminderDays(remindDays)

    // Load lawyer profile
    const name = settings['lawyer_name']
    const oab = settings['lawyer_oab']
    if (name) setLawyerName(name)
    if (oab) setLawyerOAB(oab)

    // Load UI density
    const density = settings['ui_density']
    setUiDensity(density === 'compact' ? 'compact' : 'normal')
    const motion = settings['ui_motion']
    setUiMotion(motion === 'normal' || motion === 'reduced' ? motion : 'system')

    // Load Claude Advanced Settings
    const thinking = settings['claude_thinking_enabled']
    const webSearch = settings['claude_web_search_enabled']
    const cache = settings['claude_cache_enabled']
    const dailyLimit = settings['claude_daily_limit_usd']
    const showCosts = settings['claude_show_costs']

    if (thinking !== null) setClaudeThinkingEnabled(thinking !== 'false')
    if (webSearch !== null) setClaudeWebSearchEnabled(webSearch !== 'false')
    if (cache !== null) setClaudeCacheEnabled(cache !== 'false')
    if (dailyLimit) setClaudeDailyLimitUsd(dailyLimit)
    if (showCosts !== null) setClaudeShowCosts(showCosts !== 'false')

    // Load OpenAI/GPT-5 Advanced Settings
    const openaiReasoning = settings['openai_reasoning_enabled']
    const openaiWebSearch = settings['openai_web_search_enabled']
    const openaiCache = settings['openai_cache_enabled']
    const openaiDailyLimit = settings['openai_daily_limit_usd']
    const openaiShowCosts = settings['openai_show_costs']

    if (openaiReasoning !== null) setOpenaiReasoningEnabled(openaiReasoning !== 'false')
    if (openaiWebSearch !== null) setOpenaiWebSearchEnabled(openaiWebSearch !== 'false')
    if (openaiCache !== null) setOpenaiCacheEnabled(openaiCache !== 'false')
    if (openaiDailyLimit) setOpenaiDailyLimitUsd(openaiDailyLimit)
    if (openaiShowCosts !== null) setOpenaiShowCosts(openaiShowCosts !== 'false')

    // Load Google Gemini API key
    const geminiKey = settings['gemini_api_key']
    if (geminiKey) setGeminiApiKey(geminiKey)

    // Load Gemini Advanced Settings
    const geminiThinking = settings['gemini_thinking_enabled']
    const geminiWebSearch = settings['gemini_web_search_enabled']
    const geminiDailyLimit = settings['gemini_daily_limit_usd']
    const geminiShowCosts = settings['gemini_show_costs']

    if (geminiThinking !== null) setGeminiThinkingEnabled(geminiThinking !== 'false')
    if (geminiWebSearch !== null) setGeminiWebSearchEnabled(geminiWebSearch !== 'false')
    if (geminiDailyLimit) setGeminiDailyLimitUsd(geminiDailyLimit)
    if (geminiShowCosts !== null) setGeminiShowCosts(geminiShowCosts !== 'false')
  }

  // Check environment and load settings
  useEffect(() => {
    const tauriAvailable = isTauriEnvironment()
    setIsTauri(tauriAvailable)

    if (tauriAvailable) {
      fetchSettings().then(syncSettingsFromStore)

      // Check notification permission
      checkNotificationPermission().then(granted => {
        setNotificationPermission(granted ? 'granted' : 'denied')
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    if (isTauri) {
      // Save to database
      await setSetting('claude_api_key', claudeApiKey)
      await setSetting('openai_api_key', openaiApiKey)
      await setSetting('default_provider', defaultProvider)
      await setSetting('default_model', defaultModel)
      await setSetting('ollama_url', ollamaUrl)

      // Save Claude Advanced Settings
      await setSetting('claude_thinking_enabled', claudeThinkingEnabled.toString())
      await setSetting('claude_web_search_enabled', claudeWebSearchEnabled.toString())
      await setSetting('claude_cache_enabled', claudeCacheEnabled.toString())
      await setSetting('claude_daily_limit_usd', claudeDailyLimitUsd)
      await setSetting('claude_show_costs', claudeShowCosts.toString())

      // Save OpenAI/GPT-5 Advanced Settings
      await setSetting('openai_reasoning_enabled', openaiReasoningEnabled.toString())
      await setSetting('openai_web_search_enabled', openaiWebSearchEnabled.toString())
      await setSetting('openai_cache_enabled', openaiCacheEnabled.toString())
      await setSetting('openai_daily_limit_usd', openaiDailyLimitUsd)
      await setSetting('openai_show_costs', openaiShowCosts.toString())

      // Save Gemini API Key and Settings
      await setSetting('gemini_api_key', geminiApiKey)
      await setSetting('gemini_thinking_enabled', geminiThinkingEnabled.toString())
      await setSetting('gemini_web_search_enabled', geminiWebSearchEnabled.toString())
      await setSetting('gemini_daily_limit_usd', geminiDailyLimitUsd)
      await setSetting('gemini_show_costs', geminiShowCosts.toString())
    }
    setSaved(true)
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current)
    savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveNotifications = async () => {
    if (isTauri) {
      await setSetting('notifications_enabled', notificationsEnabled.toString())
      await setSetting('notify_overdue', notifyOverdue.toString())
      await setSetting('notify_upcoming', notifyUpcoming.toString())
      await setSetting('reminder_days', reminderDays)
    }
    setSaved(true)
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current)
    savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveLawyerProfile = async () => {
    if (isTauri) {
      await setSetting('lawyer_name', lawyerName || null)
      await setSetting('lawyer_oab', lawyerOAB || null)
    }
    setSaved(true)
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current)
    savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveInterface = async () => {
    if (isTauri) {
      await setSetting('ui_density', uiDensity)
      await setSetting('ui_motion', uiMotion)
    }
    setUiSaved(true)
    if (uiSavedTimeoutRef.current) clearTimeout(uiSavedTimeoutRef.current)
    uiSavedTimeoutRef.current = setTimeout(() => setUiSaved(false), 2000)
  }

  const requestNotificationPermission = async () => {
    setNotificationPermission('checking')
    const granted = await checkNotificationPermission()
    setNotificationPermission(granted ? 'granted' : 'denied')
  }

  const refreshDatabaseSection = useCallback(async () => {
    setDbHealthLoading(true)
    try {
      const [stats, health] = await Promise.all([getDatabaseStats(), getDatabaseHealth()])
      setDbStats(stats)
      setDbHealth(health)
      setLastDbRefreshAt(Date.now())
      setDbUpdatedNow(true)
      if (dbUpdatedNowTimeoutRef.current) {
        clearTimeout(dbUpdatedNowTimeoutRef.current)
      }
      dbUpdatedNowTimeoutRef.current = setTimeout(() => {
        setDbUpdatedNow(false)
      }, 2500)
    } catch (err) {
      console.error(err)
    } finally {
      setDbHealthLoading(false)
    }
  }, [])

  const getDbRefreshLabel = () => {
    if (!lastDbRefreshAt) return 'Aguardando atualização'
    if (dbUpdatedNow) return 'Atualizado agora'
    return `Atualizado às ${new Date(lastDbRefreshAt).toLocaleTimeString('pt-BR')}`
  }

  // Load database stats when switching to database section
  useEffect(() => {
    if (activeSection !== 'database' || !isTauri) return
    void refreshDatabaseSection()
  }, [activeSection, isTauri, refreshDatabaseSection])

  // Refresh immediately after writes while database section is open.
  useEffect(() => {
    if (activeSection !== 'database' || !isTauri) return

    const handleDatabaseChanged = () => {
      if (dbRefreshDebounceRef.current) {
        clearTimeout(dbRefreshDebounceRef.current)
      }
      dbRefreshDebounceRef.current = setTimeout(() => {
        void refreshDatabaseSection()
      }, 120)
    }

    window.addEventListener(DATABASE_CHANGED_EVENT, handleDatabaseChanged)
    return () => {
      window.removeEventListener(DATABASE_CHANGED_EVENT, handleDatabaseChanged)
      if (dbRefreshDebounceRef.current) {
        clearTimeout(dbRefreshDebounceRef.current)
        dbRefreshDebounceRef.current = null
      }
    }
  }, [activeSection, isTauri, refreshDatabaseSection])

  // Database backup/export functions
  const handleExportBackup = async () => {
    setBackupLoading(true)
    setBackupMessage(null)
    try {
      const backup = await exportDatabase()
      const jsonStr = JSON.stringify(backup, null, 2)

      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')

      const savePath = await save({
        defaultPath: `jurisdesk_backup_${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (savePath) {
        await writeTextFile(savePath, jsonStr)
        setBackupMessage({ type: 'success', text: 'Backup exportado com sucesso!' })
      }
    } catch (err) {
      console.error('Export error:', err)
      setBackupMessage({ type: 'error', text: 'Erro ao exportar backup.' })
    } finally {
      setBackupLoading(false)
    }
  }

  const handleImportBackup = async () => {
    setBackupMessage(null)
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const { readTextFile } = await import('@tauri-apps/plugin-fs')

      const filePath = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
      })

      if (filePath && typeof filePath === 'string') {
        const content = await readTextFile(filePath)
        const backup = JSON.parse(content) as DatabaseBackup

        if (!backup.version || !backup.clients) {
          setBackupMessage({ type: 'error', text: 'Arquivo de backup inválido.' })
          return
        }

        setPendingImport(backup)
        setShowImportConfirm(true)
      }
    } catch (err) {
      console.error('Import error:', err)
      setBackupMessage({ type: 'error', text: 'Erro ao ler arquivo de backup.' })
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return

    setImportLoading(true)
    setShowImportConfirm(false)
    try {
      await importDatabase(pendingImport)
      clearMessages()
      await Promise.all([
        fetchClients(),
        fetchCases(),
        fetchDocuments(),
        fetchFolders(),
        fetchDeadlines(),
        fetchSessions(),
      ])
      await fetchSettings()
      syncSettingsFromStore()

      // Refresh stats
      const stats = await getDatabaseStats()
      setDbStats(stats)
      setBackupMessage({ type: 'success', text: 'Backup importado com sucesso! Dados sincronizados.' })
    } catch (err) {
      console.error('Import error:', err)
      setBackupMessage({ type: 'error', text: 'Erro ao importar backup.' })
    } finally {
      setImportLoading(false)
      setPendingImport(null)
    }
  }

  const handleExportCSV = async (tableName: string) => {
    setExportLoading(tableName)
    setBackupMessage(null)
    try {
      const csv = await exportTableAsCSV(tableName)

      if (!csv) {
        setBackupMessage({ type: 'error', text: `Tabela ${tableName} está vazia.` })
        return
      }

      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')

      const savePath = await save({
        defaultPath: `${tableName}_${new Date().toISOString().split('T')[0]}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })

      if (savePath) {
        await writeTextFile(savePath, csv)
        setBackupMessage({ type: 'success', text: `${tableName} exportado com sucesso!` })
      }
    } catch (err) {
      console.error('CSV export error:', err)
      setBackupMessage({ type: 'error', text: `Erro ao exportar ${tableName}.` })
    } finally {
      setExportLoading(null)
    }
  }

  // API Test functions
  const handleTestClaude = async () => {
    if (!claudeApiKey) {
      setClaudeTestError('Insira uma API key primeiro.')
      setClaudeTestStatus('error')
      return
    }

    setClaudeTestStatus('testing')
    setClaudeTestError(null)

    const result = await testAPIConnection('claude', claudeApiKey)
    if (result.success) {
      setClaudeTestStatus('success')
    } else {
      setClaudeTestStatus('error')
      setClaudeTestError(result.error || 'Falha na conexão')
    }
  }

  const handleTestOpenAI = async () => {
    if (!openaiApiKey) {
      setOpenaiTestError('Insira uma API key primeiro.')
      setOpenaiTestStatus('error')
      return
    }

    setOpenaiTestStatus('testing')
    setOpenaiTestError(null)

    const result = await testAPIConnection('openai', openaiApiKey)
    if (result.success) {
      setOpenaiTestStatus('success')
    } else {
      setOpenaiTestStatus('error')
      setOpenaiTestError(result.error || 'Falha na conexão')
    }
  }

  const handleTestGemini = async () => {
    if (!geminiApiKey) {
      setGeminiTestError('Insira uma API key primeiro.')
      setGeminiTestStatus('error')
      return
    }

    setGeminiTestStatus('testing')
    setGeminiTestError(null)

    const result = await testAPIConnection('gemini', geminiApiKey)
    if (result.success) {
      setGeminiTestStatus('success')
    } else {
      setGeminiTestStatus('error')
      setGeminiTestError(result.error || 'Falha na conexão')
    }
  }

  const checkOllamaConnection = async () => {
    setOllamaStatus('checking')
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`)
      if (response.ok) {
        setOllamaStatus('connected')
      } else {
        setOllamaStatus('disconnected')
      }
    } catch {
      setOllamaStatus('disconnected')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-400 text-sm mt-1">
          Gerencie as configurações do sistema
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                  activeSection === section.id
                    ? 'bg-surface-highlight text-white'
                    : 'text-gray-400 hover:bg-surface-dark hover:text-white'
                )}
              >
                <section.icon className="size-5" />
                <div>
                  <p className="font-medium text-sm">{section.title}</p>
                  <p className="text-xs text-gray-500 hidden lg:block">
                    {section.description}
                  </p>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeSection === 'profile' && (
            <form onSubmit={(e) => { e.preventDefault(); handleSaveLawyerProfile(); }} className="bg-surface-dark border border-border-dark rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="size-5 text-primary" />
                Perfil do Advogado
              </h2>

              <p className="text-sm text-gray-400">
                Configure seu nome e registro profissional. Essas informações serão exibidas na interface do sistema.
              </p>

              {/* Name */}
              <div className="space-y-3">
                <label htmlFor="lawyer-name" className="text-sm font-medium text-white">Nome Completo</label>
                <input
                  id="lawyer-name"
                  name="lawyerName"
                  type="text"
                  value={lawyerName}
                  onChange={(e) => setLawyerName(e.target.value)}
                  placeholder="Ex: Dr. João Silva"
                  className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* OAB */}
              <div className="space-y-3">
                <label htmlFor="lawyer-oab" className="text-sm font-medium text-white">Registro OAB</label>
                <input
                  id="lawyer-oab"
                  name="lawyerOAB"
                  type="text"
                  value={lawyerOAB}
                  onChange={(e) => setLawyerOAB(e.target.value)}
                  placeholder="Ex: OAB/SP 123.456"
                  className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-border-dark">
                <button
                  type="submit"
                  disabled={settingsLoading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    saved
                      ? 'bg-green-500 text-white'
                      : 'bg-primary hover:bg-primary-dark text-white',
                    settingsLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {saved ? (
                    <>
                      <CheckCircle className="size-4" />
                      Salvo!
                    </>
                  ) : settingsLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Salvar Perfil
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeSection === 'interface' && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSaveInterface(); }}
              className="bg-surface-dark border border-border-dark rounded-lg p-5 space-y-4"
            >
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Scale className="size-5 text-primary" />
                Interface
              </h2>

              <p className="text-sm text-gray-400">
                Ajuste a densidade da interface para mostrar mais ou menos informação por tela.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Densidade</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer border border-border-dark">
                    <div>
                      <p className="text-sm text-white">Normal</p>
                      <p className="text-xs text-gray-500">Mais confortável para leitura contínua</p>
                    </div>
                    <input
                      type="radio"
                      name="uiDensity"
                      value="normal"
                      checked={uiDensity === 'normal'}
                      onChange={() => setUiDensity('normal')}
                      className="size-5 border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer border border-border-dark">
                    <div>
                      <p className="text-sm text-white">Compacto</p>
                      <p className="text-xs text-gray-500">Mais itens visíveis, menos scroll</p>
                    </div>
                    <input
                      type="radio"
                      name="uiDensity"
                      value="compact"
                      checked={uiDensity === 'compact'}
                      onChange={() => setUiDensity('compact')}
                      className="size-5 border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Movimento da Interface</label>
                <p className="text-xs text-gray-500">
                  Controla animações de transição e hover. "Sistema" respeita a preferência de redução de movimento do sistema operacional.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer border border-border-dark">
                    <div>
                      <p className="text-sm text-white">Sistema</p>
                      <p className="text-xs text-gray-500">Usar preferência do sistema</p>
                    </div>
                    <input
                      type="radio"
                      name="uiMotion"
                      value="system"
                      checked={uiMotion === 'system'}
                      onChange={() => setUiMotion('system')}
                      className="size-5 border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer border border-border-dark">
                    <div>
                      <p className="text-sm text-white">Normal</p>
                      <p className="text-xs text-gray-500">Transições sutis ativas</p>
                    </div>
                    <input
                      type="radio"
                      name="uiMotion"
                      value="normal"
                      checked={uiMotion === 'normal'}
                      onChange={() => setUiMotion('normal')}
                      className="size-5 border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer border border-border-dark">
                    <div>
                      <p className="text-sm text-white">Reduzido</p>
                      <p className="text-xs text-gray-500">Minimiza animações</p>
                    </div>
                    <input
                      type="radio"
                      name="uiMotion"
                      value="reduced"
                      checked={uiMotion === 'reduced'}
                      onChange={() => setUiMotion('reduced')}
                      className="size-5 border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border-dark">
                <button
                  type="submit"
                  disabled={settingsLoading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    uiSaved
                      ? 'bg-green-500 text-white'
                      : 'bg-primary hover:bg-primary-dark text-white',
                    settingsLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {uiSaved ? (
                    <>
                      <CheckCircle className="size-4" />
                      Salvo!
                    </>
                  ) : settingsLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Salvar Interface
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeSection === 'ai' && (
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="bg-surface-dark border border-border-dark rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot className="size-5 text-primary" />
                Configuração de IA
              </h2>

              {/* Ollama */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Ollama (Local)</label>
                  <div className="flex items-center gap-2">
                    {ollamaStatus === 'connected' && (
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <CheckCircle className="size-4" />
                        Conectado
                      </span>
                    )}
                    {ollamaStatus === 'disconnected' && (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <AlertCircle className="size-4" />
                        Desconectado
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    id="ollama-url"
                    name="ollamaUrl"
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="flex-1 bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={checkOllamaConnection}
                    className="px-4 py-2 bg-surface-highlight border border-border-dark rounded-lg text-sm text-white hover:bg-border-dark transition-colors"
                  >
                    Testar
                  </button>
                </div>
              </div>

              {/* Claude API */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <Key className="size-4" />
                  Claude API Key
                </label>
                <div className="relative">
                  <input
                    id="claude-api-key"
                    name="claudeApiKey"
                    type={showClaudeKey ? 'text' : 'password'}
                    value={claudeApiKey}
                    onChange={(e) => {
                      setClaudeApiKey(e.target.value)
                      setClaudeTestStatus('idle')
                    }}
                    placeholder="sk-ant-..."
                    autoComplete="off"
                    className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClaudeKey(!showClaudeKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showClaudeKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestClaude}
                    disabled={claudeTestStatus === 'testing'}
                    className="px-3 py-1.5 bg-surface-highlight border border-border-dark rounded text-sm text-white hover:bg-border-dark transition-colors disabled:opacity-50"
                  >
                    {claudeTestStatus === 'testing' ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Testando...
                      </span>
                    ) : (
                      'Testar Conexão'
                    )}
                  </button>
                  {claudeTestStatus === 'success' && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <CheckCircle className="size-4" />
                      Conexão válida!
                    </span>
                  )}
                  {claudeTestStatus === 'error' && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="size-4" />
                      {claudeTestError}
                    </span>
                  )}
                </div>
              </div>

              {/* OpenAI API */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <Key className="size-4" />
                  OpenAI API Key
                </label>
                <div className="relative">
                  <input
                    id="openai-api-key"
                    name="openaiApiKey"
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiApiKey}
                    onChange={(e) => {
                      setOpenaiApiKey(e.target.value)
                      setOpenaiTestStatus('idle')
                    }}
                    placeholder="sk-..."
                    autoComplete="off"
                    className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showOpenaiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestOpenAI}
                    disabled={openaiTestStatus === 'testing'}
                    className="px-3 py-1.5 bg-surface-highlight border border-border-dark rounded text-sm text-white hover:bg-border-dark transition-colors disabled:opacity-50"
                  >
                    {openaiTestStatus === 'testing' ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Testando...
                      </span>
                    ) : (
                      'Testar Conexão'
                    )}
                  </button>
                  {openaiTestStatus === 'success' && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <CheckCircle className="size-4" />
                      Conexão válida!
                    </span>
                  )}
                  {openaiTestStatus === 'error' && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="size-4" />
                      {openaiTestError}
                    </span>
                  )}
                </div>
              </div>

              {/* Google Gemini API */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <Key className="size-4" />
                  Google AI API Key (Gemini)
                </label>
                <div className="relative">
                  <input
                    id="gemini-api-key"
                    name="geminiApiKey"
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => {
                      setGeminiApiKey(e.target.value)
                      setGeminiTestStatus('idle')
                    }}
                    placeholder="AIza..."
                    autoComplete="off"
                    className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showGeminiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestGemini}
                    disabled={geminiTestStatus === 'testing'}
                    className="px-3 py-1.5 bg-surface-highlight border border-border-dark rounded text-sm text-white hover:bg-border-dark transition-colors disabled:opacity-50"
                  >
                    {geminiTestStatus === 'testing' ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Testando...
                      </span>
                    ) : (
                      'Testar Conexão'
                    )}
                  </button>
                  {geminiTestStatus === 'success' && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <CheckCircle className="size-4" />
                      Conexão válida!
                    </span>
                  )}
                  {geminiTestStatus === 'error' && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="size-4" />
                      {geminiTestError}
                    </span>
                  )}
                </div>
              </div>

              {/* Default Provider */}
              <div className="space-y-3">
                <label htmlFor="default-provider" className="text-sm font-medium text-white">Provider Padrão</label>
                <select
                  id="default-provider"
                  name="defaultProvider"
                  value={defaultProvider}
                  onChange={(e) => setDefaultProvider(e.target.value)}
                  className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="claude">Claude</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>

              {/* Default Model */}
              <div className="space-y-3">
                <label htmlFor="default-model" className="text-sm font-medium text-white">Modelo Padrão</label>
                <input
                  id="default-model"
                  name="defaultModel"
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="llama3.1, gpt-4o, claude-sonnet-4-20250514, models/gemini-3-flash-preview..."
                  className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-gray-500">
                  Ollama: llama3.1, mistral | Claude: claude-sonnet-4-20250514 | OpenAI: gpt-4o | Gemini: models/gemini-3-flash-preview
                </p>
              </div>

              {/* Claude Advanced Settings */}
              {defaultProvider === 'claude' && (
                <div className="space-y-4 pt-6 border-t border-border-dark">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Brain className="size-4 text-purple-400" />
                    Configurações Avançadas do Claude
                  </h3>

                  {/* Extended Thinking Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Brain className="size-5 text-purple-400" />
                      <div>
                        <p className="text-sm text-white">Extended Thinking</p>
                        <p className="text-xs text-gray-500">Raciocínio mais profundo em tarefas complexas</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={claudeThinkingEnabled}
                      onChange={(e) => setClaudeThinkingEnabled(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Web Search Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Search className="size-5 text-blue-400" />
                      <div>
                        <p className="text-sm text-white">Web Search</p>
                        <p className="text-xs text-gray-500">Busca informações atualizadas na internet</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={claudeWebSearchEnabled}
                      onChange={(e) => setClaudeWebSearchEnabled(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Prompt Caching Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Zap className="size-5 text-yellow-400" />
                      <div>
                        <p className="text-sm text-white">Prompt Caching</p>
                        <p className="text-xs text-gray-500">Reduz custos em conversas longas (até 90%)</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={claudeCacheEnabled}
                      onChange={(e) => setClaudeCacheEnabled(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Daily Limit Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white flex items-center gap-2">
                      <DollarSign className="size-4 text-green-400" />
                      Limite Diário (USD)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={claudeDailyLimitUsd}
                      onChange={(e) => setClaudeDailyLimitUsd(e.target.value)}
                      placeholder="5.00"
                      className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500">
                      Define um limite diário de gastos com a API. Use 0 para desativar.
                    </p>
                  </div>

                  {/* Show Costs Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <DollarSign className="size-5 text-green-400" />
                      <div>
                        <p className="text-sm text-white">Exibir Custos</p>
                        <p className="text-xs text-gray-500">Mostra o custo de cada mensagem no chat</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={claudeShowCosts}
                      onChange={(e) => setClaudeShowCosts(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>
                </div>
              )}

              {/* OpenAI/GPT-5 Advanced Settings */}
              {defaultProvider === 'openai' && (
                <div className="space-y-4 pt-6 border-t border-border-dark">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Brain className="size-4 text-emerald-400" />
                    Configurações Avançadas do GPT-5 Mini
                  </h3>
                  <p className="text-xs text-gray-500">
                    O GPT-5 Mini utiliza a nova Responses API com reasoning integrado e é ~75% mais barato que o Claude.
                  </p>

                  {/* Reasoning Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Brain className="size-5 text-emerald-400" />
                      <div>
                        <p className="text-sm text-white">Reasoning (Raciocínio)</p>
                        <p className="text-xs text-gray-500">Ativa raciocínio adaptativo por tipo de tarefa</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={openaiReasoningEnabled}
                      onChange={(e) => setOpenaiReasoningEnabled(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Web Search Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Search className="size-5 text-blue-400" />
                      <div>
                        <p className="text-sm text-white">Web Search</p>
                        <p className="text-xs text-gray-500">Busca informações atualizadas na internet</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={openaiWebSearchEnabled}
                      onChange={(e) => setOpenaiWebSearchEnabled(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Prompt Caching Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Zap className="size-5 text-yellow-400" />
                      <div>
                        <p className="text-sm text-white">Prompt Caching</p>
                        <p className="text-xs text-gray-500">Cache automático com 90% de desconto</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={openaiCacheEnabled}
                      onChange={(e) => setOpenaiCacheEnabled(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Daily Limit Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white flex items-center gap-2">
                      <DollarSign className="size-4 text-green-400" />
                      Limite Diário (USD)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={openaiDailyLimitUsd}
                      onChange={(e) => setOpenaiDailyLimitUsd(e.target.value)}
                      placeholder="2.00"
                      className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500">
                      Define um limite diário de gastos com a API. Use 0 para desativar.
                    </p>
                  </div>

                  {/* Show Costs Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <DollarSign className="size-5 text-green-400" />
                      <div>
                        <p className="text-sm text-white">Exibir Custos</p>
                        <p className="text-xs text-gray-500">Mostra o custo de cada mensagem no chat</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={openaiShowCosts}
                      onChange={(e) => setOpenaiShowCosts(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Pricing Info */}
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-xs text-emerald-400 font-medium mb-1">Preços GPT-5 Mini</p>
                    <p className="text-xs text-gray-400">
                      Input: $0.25/MTok • Output: $2.00/MTok • Cache: 90% desconto
                    </p>
                  </div>
                </div>
              )}

              {/* Google Gemini Advanced Settings */}
              {defaultProvider === 'gemini' && (
                <div className="space-y-4 pt-6 border-t border-border-dark">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Brain className="size-4 text-cyan-400" />
                    Configurações Avançadas do Gemini 3 Flash
                  </h3>
                  <p className="text-xs text-gray-500">
                    O Gemini 3 Flash utiliza thinking levels para controlar a profundidade do raciocínio e é 3x mais rápido que o Gemini 2.5 Pro.
                  </p>

                  {/* Thinking Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Brain className="size-5 text-cyan-400" />
                      <div>
                        <p className="text-sm text-white">Thinking (Raciocínio)</p>
                        <p className="text-xs text-gray-500">Ativa raciocínio adaptativo por tipo de tarefa</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={geminiThinkingEnabled}
                      onChange={(e) => setGeminiThinkingEnabled(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Google Search Grounding Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Search className="size-5 text-blue-400" />
                      <div>
                        <p className="text-sm text-white">Google Search Grounding</p>
                        <p className="text-xs text-gray-500">Busca informações atualizadas no Google</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={geminiWebSearchEnabled}
                      onChange={(e) => setGeminiWebSearchEnabled(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Daily Limit Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white flex items-center gap-2">
                      <DollarSign className="size-4 text-green-400" />
                      Limite Diário (USD)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={geminiDailyLimitUsd}
                      onChange={(e) => setGeminiDailyLimitUsd(e.target.value)}
                      placeholder="3.00"
                      className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500">
                      Define um limite diário de gastos com a API. Use 0 para desativar.
                    </p>
                  </div>

                  {/* Show Costs Toggle */}
                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <DollarSign className="size-5 text-green-400" />
                      <div>
                        <p className="text-sm text-white">Exibir Custos</p>
                        <p className="text-xs text-gray-500">Mostra o custo de cada mensagem no chat</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={geminiShowCosts}
                      onChange={(e) => setGeminiShowCosts(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  {/* Pricing Info */}
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                    <p className="text-xs text-cyan-400 font-medium mb-1">Preços Gemini 3 Flash</p>
                    <p className="text-xs text-gray-400">
                      Input: $0.50/MTok • Output: $3.00/MTok • Context: 1M tokens
                    </p>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-border-dark">
                <button
                  type="submit"
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    saved
                      ? 'bg-green-500 text-white'
                      : 'bg-primary hover:bg-primary-dark text-white'
                  )}
                >
                  {saved ? (
                    <>
                      <CheckCircle className="size-4" />
                      Salvo!
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Salvar Configurações
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeSection === 'notifications' && (
            <form onSubmit={(e) => { e.preventDefault(); handleSaveNotifications(); }} className="bg-surface-dark border border-border-dark rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="size-5 text-primary" />
                Notificações
              </h2>

              {/* Environment Warning */}
              {!isTauri && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="size-4" />
                    Ambiente de Desenvolvimento
                  </div>
                  <p className="mt-1">
                    Notificações só funcionam no ambiente Tauri. Execute com <code className="bg-yellow-500/20 px-1 rounded">npm run tauri dev</code>.
                  </p>
                </div>
              )}

              {/* Permission Status */}
              {isTauri && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-white">Permissão do Sistema</label>
                  <div className="flex items-center justify-between p-3 bg-background-dark rounded-lg">
                    <div className="flex items-center gap-3">
                      <BellRing className="size-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-white">Notificações do Sistema</p>
                        <p className="text-xs text-gray-500">
                          {notificationPermission === 'granted' && 'Permissão concedida'}
                          {notificationPermission === 'denied' && 'Permissão negada'}
                          {notificationPermission === 'checking' && 'Verificando...'}
                        </p>
                      </div>
                    </div>
                    {notificationPermission === 'granted' ? (
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <CheckCircle className="size-4" />
                        Ativado
                      </span>
                    ) : notificationPermission === 'denied' ? (
                      <button
                        onClick={requestNotificationPermission}
                        className="px-3 py-1.5 bg-primary/10 text-primary rounded text-sm hover:bg-primary/20 transition-colors"
                      >
                        Solicitar Permissão
                      </button>
                    ) : (
                      <Loader2 className="size-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>
              )}

              {/* Enable/Disable Notifications */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Configurações Gerais</label>
                <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Bell className="size-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-white">Habilitar Notificações</p>
                      <p className="text-xs text-gray-500">Ativar ou desativar todas as notificações</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                  />
                </label>
              </div>

              {/* Notification Types */}
              {notificationsEnabled && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-white">Tipos de Notificação</label>

                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="size-5 text-red-400" />
                      <div>
                        <p className="text-sm text-white">Prazos Vencidos</p>
                        <p className="text-xs text-gray-500">Notificar sobre prazos que já venceram</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyOverdue}
                      onChange={(e) => setNotifyOverdue(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-background-dark rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Clock className="size-5 text-amber-400" />
                      <div>
                        <p className="text-sm text-white">Prazos Próximos</p>
                        <p className="text-xs text-gray-500">Notificar sobre prazos que estão vencendo</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyUpcoming}
                      onChange={(e) => setNotifyUpcoming(e.target.checked)}
                      className="size-5 rounded border-gray-600 bg-surface-highlight text-primary focus:ring-primary focus:ring-offset-0"
                    />
                  </label>
                </div>
              )}

              {/* Reminder Days */}
              {notificationsEnabled && notifyUpcoming && (
                <div className="space-y-3">
                  <label htmlFor="reminder-days" className="text-sm font-medium text-white">Antecedência do Lembrete</label>
                  <select
                    id="reminder-days"
                    name="reminderDays"
                    value={reminderDays}
                    onChange={(e) => setReminderDays(e.target.value)}
                    className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="0">No dia do prazo</option>
                    <option value="1">1 dia antes</option>
                    <option value="2">2 dias antes</option>
                    <option value="3">3 dias antes</option>
                    <option value="7">1 semana antes</option>
                  </select>
                  <p className="text-xs text-gray-500">
                    Quando você será notificado antes do vencimento do prazo
                  </p>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-border-dark">
                <button
                  type="submit"
                  disabled={settingsLoading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    saved
                      ? 'bg-green-500 text-white'
                      : 'bg-primary hover:bg-primary-dark text-white',
                    settingsLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {saved ? (
                    <>
                      <CheckCircle className="size-4" />
                      Salvo!
                    </>
                  ) : settingsLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Salvar Configurações
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeSection === 'database' && (
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="size-5 text-primary" />
                Banco de Dados
              </h2>

              {/* Environment Warning */}
              {!isTauri && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="size-4" />
                    Ambiente de Desenvolvimento
                  </div>
                  <p className="mt-1">
                    Backup só funciona no ambiente Tauri. Execute com <code className="bg-yellow-500/20 px-1 rounded">npm run tauri dev</code>.
                  </p>
                </div>
              )}

              {/* Backup Message */}
              {backupMessage && (
                <div className={cn(
                  'p-4 rounded-lg text-sm flex items-center gap-2',
                  backupMessage.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                )}>
                  {backupMessage.type === 'success' ? (
                    <CheckCircle className="size-4" />
                  ) : (
                    <AlertCircle className="size-4" />
                  )}
                  {backupMessage.text}
                </div>
              )}

              {/* Persistence Status */}
              {isTauri && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-white flex items-center gap-2">
                      <HardDrive className="size-4" />
                      Status de Persistência
                    </label>
                    <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                      <span className={cn('size-1.5 rounded-full bg-emerald-400', dbUpdatedNow && 'animate-pulse')} />
                      {getDbRefreshLabel()}
                    </span>
                  </div>

                  <div className="p-4 bg-background-dark border border-border-dark rounded-lg">
                    {dbHealthLoading && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="size-4 animate-spin" />
                        Verificando integridade e configuração...
                      </div>
                    )}

                    {!dbHealthLoading && dbHealth && (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm">
                            {dbHealth.ok ? (
                              <>
                                <CheckCircle className="size-4 text-green-400" />
                                <span className="text-green-400 font-medium">OK</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="size-4 text-red-400" />
                                <span className="text-red-400 font-medium">Atenção</span>
                              </>
                            )}
                            <span className="text-gray-500">
                              Integridade:{' '}
                              <span className="text-white">
                                {dbHealth.integrity ?? '-'}
                              </span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span>
                              FK:{' '}
                              {dbHealth.foreignKeys === null ? (
                                <span className="text-white">-</span>
                              ) : dbHealth.foreignKeys ? (
                                <span className="text-green-400">ON</span>
                              ) : (
                                <span className="text-red-400">OFF</span>
                              )}
                            </span>
                            <span>
                              Journal:{' '}
                              <span className="text-white">
                                {dbHealth.journalMode ?? '-'}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-gray-500">
                          <p className="mb-1">Arquivo do banco:</p>
                          <p className="font-mono text-gray-300 break-all">
                            {dbHealth.dbFile ?? '-'}
                          </p>
                          {dbHealth.error && (
                            <p className="mt-2 text-red-400">
                              {dbHealth.error}
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {!dbHealthLoading && !dbHealth && (
                      <p className="text-sm text-gray-500">
                        Status indisponível.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Full Backup */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Backup Completo</label>
                <p className="text-xs text-gray-500">
                  Exportar ou importar todos os dados do sistema (clientes, casos, documentos, prazos, conversas)
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleExportBackup}
                    disabled={backupLoading || !isTauri}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {backupLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Exportar Backup
                  </button>
                  <button
                    onClick={handleImportBackup}
                    disabled={importLoading || !isTauri}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-sm hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    Importar Backup
                  </button>
                </div>
              </div>

              {/* CSV Export */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Exportar Dados (CSV)</label>
                <p className="text-xs text-gray-500">
                  Exportar tabelas individuais em formato CSV para análise em planilhas
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleExportCSV('clients')}
                    disabled={exportLoading !== null || !isTauri}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-highlight border border-border-dark rounded text-sm text-white hover:bg-border-dark transition-colors disabled:opacity-50"
                  >
                    {exportLoading === 'clients' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Users className="size-4" />
                    )}
                    Clientes
                  </button>
                  <button
                    onClick={() => handleExportCSV('cases')}
                    disabled={exportLoading !== null || !isTauri}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-highlight border border-border-dark rounded text-sm text-white hover:bg-border-dark transition-colors disabled:opacity-50"
                  >
                    {exportLoading === 'cases' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Scale className="size-4" />
                    )}
                    Casos
                  </button>
                  <button
                    onClick={() => handleExportCSV('documents')}
                    disabled={exportLoading !== null || !isTauri}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-highlight border border-border-dark rounded text-sm text-white hover:bg-border-dark transition-colors disabled:opacity-50"
                  >
                    {exportLoading === 'documents' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FolderOpen className="size-4" />
                    )}
                    Documentos
                  </button>
                  <button
                    onClick={() => handleExportCSV('deadlines')}
                    disabled={exportLoading !== null || !isTauri}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-highlight border border-border-dark rounded text-sm text-white hover:bg-border-dark transition-colors disabled:opacity-50"
                  >
                    {exportLoading === 'deadlines' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Clock className="size-4" />
                    )}
                    Prazos
                  </button>
                </div>
              </div>

              {/* Database Stats */}
              {isTauri && dbStats && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-white flex items-center gap-2">
                    <HardDrive className="size-4" />
                    Estatísticas do Banco
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-background-dark rounded-lg">
                      <p className="text-xs text-gray-500">Clientes</p>
                      <p className="text-lg font-bold text-white">{dbStats.clients}</p>
                    </div>
                    <div className="p-3 bg-background-dark rounded-lg">
                      <p className="text-xs text-gray-500">Casos</p>
                      <p className="text-lg font-bold text-white">{dbStats.cases}</p>
                    </div>
                    <div className="p-3 bg-background-dark rounded-lg">
                      <p className="text-xs text-gray-500">Documentos</p>
                      <p className="text-lg font-bold text-white">{dbStats.documents}</p>
                    </div>
                    <div className="p-3 bg-background-dark rounded-lg">
                      <p className="text-xs text-gray-500">Prazos</p>
                      <p className="text-lg font-bold text-white">{dbStats.deadlines}</p>
                    </div>
                    <div className="p-3 bg-background-dark rounded-lg">
                      <p className="text-xs text-gray-500">Conversas</p>
                      <p className="text-lg font-bold text-white">{dbStats.chat_sessions}</p>
                    </div>
                    <div className="p-3 bg-background-dark rounded-lg">
                      <p className="text-xs text-gray-500">Mensagens</p>
                      <p className="text-lg font-bold text-white">{dbStats.chat_messages}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto Backup Section */}
              {isTauri && (
                <div className="pt-6 border-t border-border-dark">
                  <BackupSettings
                    onRestore={() => {
                      void refreshDatabaseSection()
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Import Confirmation Modal */}
          {showImportConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop"
                onClick={() => {
                  setShowImportConfirm(false)
                  setPendingImport(null)
                }}
              />
              <div className="relative bg-surface-dark border border-border-dark rounded-lg w-full max-w-md mx-4 p-[var(--space-modal)] shadow-lg motion-overlay-panel">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <AlertCircle className="size-5 text-amber-400" />
                  Confirmar Importação
                </h3>
                <p className="text-gray-400 mb-4">
                  <strong className="text-red-400">Atenção:</strong> Esta ação irá substituir <strong className="text-white">todos os dados existentes</strong> pelos dados do backup.
                </p>
                {pendingImport && (
                  <div className="mb-4 p-3 bg-background-dark rounded-lg text-sm">
                    <p className="text-gray-400">
                      Backup criado em: <span className="text-white">{new Date(pendingImport.created_at).toLocaleString('pt-BR')}</span>
                    </p>
                    <p className="text-gray-400">
                      Versão: <span className="text-white">{pendingImport.version}</span>
                    </p>
                    <p className="text-gray-400">
                      Registros: <span className="text-white">
                        {pendingImport.clients.length} clientes, {pendingImport.cases.length} casos
                      </span>
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowImportConfirm(false)
                      setPendingImport(null)
                    }}
                    className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmImport}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-colors"
                  >
                    Substituir Dados
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
