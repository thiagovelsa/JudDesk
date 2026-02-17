import { useEffect, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Documents from './pages/Documents'
import Calendar from './pages/Calendar'
import Assistant from './pages/Assistant'
import ActivityHistory from './pages/ActivityHistory'
import Settings from './pages/Settings'
import { isTauriEnvironment } from './lib/db'
import { useDeadlineStore } from './stores/deadlineStore'
import { useSettingsStore } from './stores/settingsStore'
import { useClientStore } from './stores/clientStore'
import { useCaseStore } from './stores/caseStore'
import { useDocumentStore } from './stores/documentStore'
import { useFolderStore } from './stores/folderStore'
import { useChatStore } from './stores/chatStore'
import { checkAndNotifyUpcomingDeadlines, checkAndNotifyOverdueDeadlines } from './lib/notifications'
import { initAutoBackup } from './lib/autoBackup'
import { cleanupOrphanChatAttachments } from './lib/attachmentCleanup'
import { cleanupOrphanClientDocuments } from './lib/documentCleanup'

function App() {
  const { deadlines, fetchDeadlines } = useDeadlineStore()
  const { fetchSettings } = useSettingsStore()
  const notificationsEnabled = useSettingsStore((state) => state.settings['notifications_enabled'])
  const { fetchClients } = useClientStore()
  const { fetchCases } = useCaseStore()
  const { fetchDocuments } = useDocumentStore()
  const { fetchFolders } = useFolderStore()
  const { fetchSessions } = useChatStore()

  // Load all data on startup
  useEffect(() => {
    if (!isTauriEnvironment()) return

    // Load all stores on app initialization
    fetchSettings()
    fetchClients()
    fetchCases()
    fetchDocuments()
    fetchFolders()
    fetchSessions().catch((err) => {
      console.error('Failed to load chat sessions:', err)
    })

    const checkDeadlines = async () => {
      // Check if notifications are enabled (get fresh value from store)
      const notifEnabled = useSettingsStore.getState().settings['notifications_enabled']
      if (notifEnabled === 'false') return

      // Fetch deadlines and check for notifications
      await fetchDeadlines()
      const currentDeadlines = useDeadlineStore.getState().deadlines

      await checkAndNotifyUpcomingDeadlines(currentDeadlines)
      await checkAndNotifyOverdueDeadlines(currentDeadlines)
    }

    checkDeadlines()

    cleanupOrphanChatAttachments().catch(() => {})
    cleanupOrphanClientDocuments().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track if initial load has completed
  const initialLoadDoneRef = useRef(false)

  // Re-check notifications when deadlines change (after initial load)
  useEffect(() => {
    if (!isTauriEnvironment()) return
    if (deadlines.length === 0) return
    if (notificationsEnabled === 'false') return

    // Skip first render (initial load is handled above)
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true
      return
    }

    // Check for notifications on subsequent deadline changes
    const recheckNotifications = async () => {
      await checkAndNotifyUpcomingDeadlines(deadlines)
    }
    recheckNotifications()
  }, [deadlines, notificationsEnabled])

  // Initialize auto backup system
  useEffect(() => {
    if (!isTauriEnvironment()) return
    initAutoBackup()
  }, [])

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/history" element={<ActivityHistory />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </MainLayout>
  )
}

export default App
