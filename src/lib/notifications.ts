import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import type { Deadline } from '@/types'
import { isTauriEnvironment } from './db'

// Track notified deadline IDs to prevent duplicates (resets daily)
const notifiedDeadlineIds = new Set<number>()
let lastNotificationDate = ''

/**
 * Reset notification tracking (for testing purposes)
 */
export function resetNotificationTracking(): void {
  notifiedDeadlineIds.clear()
  lastNotificationDate = ''
}

/**
 * Check and request notification permission
 * Returns true if notifications are granted
 */
export async function checkNotificationPermission(): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return false
  }

  try {
    let granted = await isPermissionGranted()
    if (!granted) {
      const permission = await requestPermission()
      granted = permission === 'granted'
    }
    return granted
  } catch (error) {
    console.error('Error checking notification permission:', error)
    return false
  }
}

/**
 * Send a notification for a deadline
 */
export async function notifyDeadline(title: string, body: string): Promise<void> {
  if (!isTauriEnvironment()) {
    return
  }

  try {
    const granted = await checkNotificationPermission()
    if (granted) {
      sendNotification({ title, body })
    }
  } catch (error) {
    console.error('Error sending notification:', error)
  }
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Check deadlines and send notifications for those with reminders due today
 */
export async function checkAndNotifyUpcomingDeadlines(deadlines: Deadline[]): Promise<void> {
  if (!isTauriEnvironment()) {
    return
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Reset notified set if day changed
  if (lastNotificationDate !== todayStr) {
    notifiedDeadlineIds.clear()
    lastNotificationDate = todayStr
  }

  // Find deadlines with reminder_date set to today and not completed
  const dueToday = deadlines.filter(d => {
    if (d.completed) return false
    if (!d.reminder_date) return false
    if (notifiedDeadlineIds.has(d.id)) return false // Skip already notified
    return d.reminder_date.startsWith(todayStr)
  })

  // Also check for deadlines due today without reminder_date
  const dueTodayWithoutReminder = deadlines.filter(d => {
    if (d.completed) return false
    if (d.reminder_date) return false // Skip if has reminder
    if (notifiedDeadlineIds.has(d.id)) return false // Skip already notified
    return d.due_date.startsWith(todayStr)
  })

  // Group notifications to avoid spamming the user
  const allReminders = [...dueToday, ...dueTodayWithoutReminder]

  if (allReminders.length === 0) return // Nothing new to notify

  // Mark all as notified before sending
  for (const d of allReminders) {
    notifiedDeadlineIds.add(d.id)
  }

  if (allReminders.length > 3) {
    // Send a single grouped notification
    await notifyDeadline(
      'Lembretes de Prazo',
      `Você tem ${allReminders.length} prazo(s) para hoje. Verifique sua agenda.`
    )
  } else {
    // Notify for deadlines with reminder
    for (const deadline of dueToday) {
      await notifyDeadline(
        'Lembrete de Prazo',
        `${deadline.title} - Vence em ${formatDate(deadline.due_date)}`
      )
    }

    // Notify for deadlines due today
    for (const deadline of dueTodayWithoutReminder) {
      await notifyDeadline(
        'Prazo Vencendo Hoje',
        `${deadline.title} - Vence ${formatDate(deadline.due_date)}`
      )
    }
  }
}

/**
 * Check for overdue deadlines and send notifications
 */
export async function checkAndNotifyOverdueDeadlines(deadlines: Deadline[]): Promise<void> {
  if (!isTauriEnvironment()) {
    return
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find overdue deadlines that are not completed
  const overdue = deadlines.filter(d => {
    if (d.completed) return false
    const dueDate = new Date(d.due_date)
    dueDate.setHours(0, 0, 0, 0)
    return dueDate < today
  })

  if (overdue.length > 0) {
    await notifyDeadline(
      'Prazos Vencidos',
      `Você tem ${overdue.length} prazo(s) vencido(s). Verifique sua agenda.`
    )
  }
}
