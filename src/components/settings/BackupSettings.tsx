import { useState, useEffect, useCallback, useRef } from 'react'
import {
  HardDrive,
  FolderOpen,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import {
  getBackupConfig,
  loadBackupConfig,
  setBackupEnabled,
  setBackupPath,
  setMaxBackups,
  getBackupList,
  executeBackup,
  deleteBackup,
  restoreFromBackup,
  getLastBackupTime,
  formatFileSize,
  type BackupInfo,
} from '@/lib/autoBackup'
import { DATABASE_CHANGED_EVENT } from '@/lib/db'

interface BackupSettingsProps {
  onRestore?: () => void
}

export function BackupSettings({ onRestore }: BackupSettingsProps) {
  const [enabled, setEnabled] = useState(true)
  const [backupPath, setBackupPathState] = useState<string | null>(null)
  const [maxBackups, setMaxBackupsState] = useState(10)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [backupInProgress, setBackupInProgress] = useState(false)
  const [restoreInProgress, setRestoreInProgress] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      await loadBackupConfig()
      const config = getBackupConfig()
      setEnabled(config.enabled)
      setBackupPathState(config.backupPath)
      setMaxBackupsState(config.maxBackups)

      const backupList = await getBackupList()
      setBackups(backupList)

      const last = await getLastBackupTime()
      setLastBackup(last)
    } catch (error) {
      console.error('Failed to load backup settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    const handleDatabaseChanged = () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current)
      }
      refreshDebounceRef.current = setTimeout(() => {
        void loadSettings()
      }, 120)
    }

    window.addEventListener(DATABASE_CHANGED_EVENT, handleDatabaseChanged)
    return () => {
      window.removeEventListener(DATABASE_CHANGED_EVENT, handleDatabaseChanged)
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current)
        refreshDebounceRef.current = null
      }
    }
  }, [loadSettings])

  const handleToggleEnabled = async () => {
    const newValue = !enabled
    setEnabled(newValue)
    await setBackupEnabled(newValue)
    showMessage('success', newValue ? 'Backup automático ativado' : 'Backup automático desativado')
  }

  const handleSelectFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Selecionar pasta de backup',
      })

      if (selected && typeof selected === 'string') {
        setBackupPathState(selected)
        await setBackupPath(selected)
        showMessage('success', 'Pasta de backup atualizada')
        await loadSettings()
      }
    } catch (error) {
      showMessage('error', 'Falha ao selecionar pasta')
    }
  }

  const handleUseDefaultPath = async () => {
    setBackupPathState(null)
    await setBackupPath(null)
    showMessage('success', 'Usando pasta padrão do sistema')
    await loadSettings()
  }

  const handleMaxBackupsChange = async (value: number) => {
    setMaxBackupsState(value)
    await setMaxBackups(value)
  }

  const handleBackupNow = async () => {
    setBackupInProgress(true)
    try {
      const result = await executeBackup()
      if (result) {
        showMessage('success', `Backup criado: ${result.filename}`)
        await loadSettings()
      } else {
        showMessage('error', 'Falha ao criar backup')
      }
    } catch (error) {
      showMessage('error', 'Erro ao criar backup')
    } finally {
      setBackupInProgress(false)
    }
  }

  const handleDeleteBackup = async (filename: string) => {
    try {
      await deleteBackup(filename)
      showMessage('success', 'Backup excluído')
      await loadSettings()
    } catch (error) {
      showMessage('error', 'Falha ao excluir backup')
    }
  }

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return

    setRestoreInProgress(true)
    setShowRestoreConfirm(false)

    try {
      await restoreFromBackup(selectedBackup)
      showMessage('success', 'Backup restaurado com sucesso! Recarregando dados...')
      onRestore?.()
    } catch (error) {
      showMessage('error', 'Falha ao restaurar backup')
    } finally {
      setRestoreInProgress(false)
      setSelectedBackup(null)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR')
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HardDrive className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-zinc-100">Backup Automatico</h3>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Enable Toggle */}
      <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-3">
        <div>
          <p className="font-medium text-zinc-200">Ativar backup automatico</p>
          <p className="text-sm text-zinc-500">
            Salva automaticamente apos cada alteracao
          </p>
        </div>
        <button
          onClick={handleToggleEnabled}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            enabled ? 'bg-blue-500' : 'bg-zinc-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Backup Path */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300">
          Pasta de backup
        </label>
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
            {backupPath || 'Pasta padrao do sistema (AppData)'}
          </div>
          <button
            onClick={handleSelectFolder}
            className="flex items-center gap-2 rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
          >
            <FolderOpen className="h-4 w-4" />
            Escolher
          </button>
        </div>
        {backupPath && (
          <button
            onClick={handleUseDefaultPath}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Usar pasta padrao
          </button>
        )}
        <p className="text-xs text-zinc-500">
          Dica: Escolha uma pasta do OneDrive, Google Drive ou Dropbox para backup em nuvem
        </p>
      </div>

      {/* Max Backups */}
      <div className="space-y-2">
        <label htmlFor="max-backups" className="block text-sm font-medium text-zinc-300">
          Manter ultimos backups
        </label>
        <select
          id="max-backups"
          name="maxBackups"
          value={maxBackups}
          onChange={(e) => handleMaxBackupsChange(Number(e.target.value))}
          className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={5}>5 backups</option>
          <option value={10}>10 backups</option>
          <option value={15}>15 backups</option>
          <option value={20}>20 backups</option>
          <option value={30}>30 backups</option>
        </select>
      </div>

      {/* Last Backup */}
      {lastBackup && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Clock className="h-4 w-4" />
          <span>Ultimo backup: {formatDate(lastBackup)}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleBackupNow}
          disabled={backupInProgress}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {backupInProgress ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {backupInProgress ? 'Salvando...' : 'Fazer Backup Agora'}
        </button>
      </div>

      {/* Backup List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-zinc-300">Backups Disponiveis</h4>
          <button
            onClick={loadSettings}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 py-4">
            Nenhum backup encontrado
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800">
            {backups.map((backup) => (
              <div
                key={backup.filename}
                onClick={() => setSelectedBackup(backup.filename)}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b border-zinc-800 last:border-b-0 ${
                  selectedBackup === backup.filename
                    ? 'bg-blue-500/20'
                    : 'hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">
                    {backup.filename}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(backup.createdAt)} • {formatFileSize(backup.size)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteBackup(backup.filename)
                  }}
                  className="ml-2 p-1 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedBackup && (
          <button
            onClick={() => setShowRestoreConfirm(true)}
            disabled={restoreInProgress}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {restoreInProgress ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {restoreInProgress ? 'Restaurando...' : 'Restaurar Selecionado'}
          </button>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-100">
              Confirmar Restauracao
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Esta acao ira substituir TODOS os dados atuais pelo backup selecionado.
              Esta acao nao pode ser desfeita.
            </p>
            <p className="mt-2 text-sm font-medium text-amber-400">
              Backup: {selectedBackup}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowRestoreConfirm(false)}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestoreBackup}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Sim, Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
