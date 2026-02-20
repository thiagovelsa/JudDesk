import { Bell, MessageSquare, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import SearchBar from './SearchBar'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDeadlineStore } from '@/stores/deadlineStore'
import { cn, toLocalDateKey } from '@/lib/utils'

interface HeaderProps {
  onMenuClick?: () => void
}

// Generate a consistent gradient based on name
function getAvatarGradient(name: string): string {
  const gradients = [
    'from-amber-600 to-yellow-500',
    'from-stone-600 to-stone-500',
    'from-zinc-600 to-zinc-500',
    'from-neutral-600 to-neutral-500',
    'from-rose-600 to-rose-500',
    'from-slate-600 to-slate-500',
  ]

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return gradients[Math.abs(hash) % gradients.length]
}

export default function Header({ onMenuClick }: HeaderProps) {
  const lawyerName = useSettingsStore((state) => state.settings['lawyer_name']) || 'Usuario'
  const notificationsEnabled = useSettingsStore((state) => state.settings['notifications_enabled'])
  const notifyOverdue = useSettingsStore((state) => state.settings['notify_overdue'])
  const notifyUpcoming = useSettingsStore((state) => state.settings['notify_upcoming'])
  const deadlines = useDeadlineStore((state) => state.deadlines)
  const navigate = useNavigate()

  const initials = lawyerName
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase())
    .slice(0, 2)
    .join('')

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const avatarGradient = getAvatarGradient(lawyerName)
  const pendingNotifications = useMemo(() => {
    if (notificationsEnabled === 'false') return 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = toLocalDateKey(today)
    const pendingIds = new Set<number>()

    for (const deadline of deadlines) {
      if (deadline.completed) continue

      if (notifyOverdue !== 'false') {
        const dueDate = new Date(deadline.due_date)
        dueDate.setHours(0, 0, 0, 0)
        if (dueDate < today) {
          pendingIds.add(deadline.id)
          continue
        }
      }

      if (notifyUpcoming !== 'false') {
        const reminderIsToday = Boolean(deadline.reminder_date?.startsWith(todayStr))
        const dueIsTodayWithoutReminder =
          !deadline.reminder_date && deadline.due_date.startsWith(todayStr)

        if (reminderIsToday || dueIsTodayWithoutReminder) {
          pendingIds.add(deadline.id)
        }
      }
    }

    return pendingIds.size
  }, [deadlines, notificationsEnabled, notifyOverdue, notifyUpcoming])

  const hasPendingNotifications = pendingNotifications > 0
  const notificationBadgeLabel = pendingNotifications > 99 ? '99+' : String(pendingNotifications)

  return (
    <header className="sticky top-0 h-14 border-b border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/95 backdrop-blur flex items-center justify-between px-6 shrink-0 z-30">
      {/* Mobile menu button */}
      <button
        className="md:hidden text-[var(--color-text-primary)] mr-4 p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
        onClick={onMenuClick}
      >
        <Menu className="size-5" />
      </button>

      <div className="flex items-center gap-6 flex-1 min-w-0">
        <button
          className="font-display text-[var(--color-text-primary)] text-xl font-semibold truncate hidden sm:block tracking-tight text-left hover:text-[var(--color-primary-light)] transition-colors motion-hover"
          onClick={() => navigate('/settings?section=profile')}
          title="Abrir perfil do advogado"
        >
          {getGreeting()}, <span className="text-[var(--color-primary-light)]">{lawyerName}</span>
        </button>

        {/* Global Search */}
        <div className="ml-4 flex-1 max-w-md">
          <SearchBar />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {/* Notifications */}
        <button
          className={cn(
            'relative p-2.5 rounded-lg bg-[var(--color-bg-secondary)] border transition-all duration-200 button-press motion-hover motion-press',
            hasPendingNotifications
              ? 'text-[var(--color-urgent)] border-red-500/40 hover:border-red-500/60'
              : 'border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-default)]'
          )}
          onClick={() => navigate('/settings?section=notifications')}
          title={
            hasPendingNotifications
              ? `Voce tem ${pendingNotifications} notificacao(oes) pendente(s)`
              : 'Abrir configuracoes de notificacoes'
          }
        >
          <Bell className={cn('size-5', hasPendingNotifications && 'animate-pulse')} />
          {hasPendingNotifications && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-urgent)] text-white text-[10px] font-semibold leading-none flex items-center justify-center ring-2 ring-[var(--color-bg-secondary)] animate-pulse">
              {notificationBadgeLabel}
            </span>
          )}
        </button>

        {/* Messages */}
        <button
          className="p-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-default)] transition-all duration-200 button-press motion-hover motion-press"
          onClick={() => navigate('/assistant')}
          title="Abrir assistente"
        >
          <MessageSquare className="size-5" />
        </button>

        <div className="h-8 w-px bg-[var(--color-border-default)] mx-2" />

        {/* Avatar */}
        <button
          className={cn(
            'size-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-semibold text-sm cursor-pointer ring-2 ring-[var(--color-border-subtle)] hover:ring-[var(--color-border-default)] transition-all duration-200 motion-hover',
            avatarGradient
          )}
          title={lawyerName}
          onClick={() => navigate('/settings?section=profile')}
        >
          {initials || 'U'}
        </button>
      </div>
    </header>
  )
}
