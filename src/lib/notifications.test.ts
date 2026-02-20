import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkNotificationPermission,
  notifyDeadline,
  checkAndNotifyUpcomingDeadlines,
  checkAndNotifyOverdueDeadlines,
  resetNotificationTracking,
} from './notifications'
import { toLocalDateKey } from './utils'
import type { Deadline } from '@/types'

// Mock the Tauri notification plugin
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}))

// Mock the db module
vi.mock('./db', () => ({
  isTauriEnvironment: vi.fn(),
}))

import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { isTauriEnvironment } from './db'

describe('notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetNotificationTracking()
  })

  describe('checkNotificationPermission', () => {
    it('returns false when not in Tauri environment', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(false)

      const result = await checkNotificationPermission()

      expect(result).toBe(false)
      expect(isPermissionGranted).not.toHaveBeenCalled()
    })

    it('returns true when permission is already granted', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(true)

      const result = await checkNotificationPermission()

      expect(result).toBe(true)
      expect(requestPermission).not.toHaveBeenCalled()
    })

    it('requests permission when not granted', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(false)
      vi.mocked(requestPermission).mockResolvedValue('granted')

      const result = await checkNotificationPermission()

      expect(result).toBe(true)
      expect(requestPermission).toHaveBeenCalled()
    })

    it('returns false when permission is denied', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(false)
      vi.mocked(requestPermission).mockResolvedValue('denied')

      const result = await checkNotificationPermission()

      expect(result).toBe(false)
    })

    it('handles errors gracefully', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockRejectedValue(new Error('Test error'))

      const result = await checkNotificationPermission()

      expect(result).toBe(false)
    })
  })

  describe('notifyDeadline', () => {
    it('does nothing when not in Tauri environment', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(false)

      await notifyDeadline('Test', 'Body')

      expect(sendNotification).not.toHaveBeenCalled()
    })

    it('sends notification when permission is granted', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(true)

      await notifyDeadline('Test Title', 'Test Body')

      expect(sendNotification).toHaveBeenCalledWith({
        title: 'Test Title',
        body: 'Test Body',
      })
    })

    it('does not send notification when permission is denied', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(false)
      vi.mocked(requestPermission).mockResolvedValue('denied')

      await notifyDeadline('Test', 'Body')

      expect(sendNotification).not.toHaveBeenCalled()
    })
  })

  describe('checkAndNotifyUpcomingDeadlines', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = toLocalDateKey(today)

    const createDeadline = (overrides: Partial<Deadline> = {}): Deadline => ({
      id: 1,
      title: 'Test Deadline',
      description: null,
      due_date: `${todayStr}T12:00:00.000Z`,
      reminder_date: null,
      priority: 'normal',
      completed: false,
      case_id: null,
      client_id: null,
      created_at: '2024-01-01T00:00:00.000Z',
      ...overrides,
    })

    it('does nothing when not in Tauri environment', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(false)

      await checkAndNotifyUpcomingDeadlines([createDeadline()])

      expect(sendNotification).not.toHaveBeenCalled()
    })

    it('notifies for deadlines with reminder_date today', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(true)

      const deadline = createDeadline({
        reminder_date: `${todayStr}T09:00:00.000Z`,
      })

      await checkAndNotifyUpcomingDeadlines([deadline])

      expect(sendNotification).toHaveBeenCalledWith({
        title: 'Lembrete de Prazo',
        body: expect.stringContaining('Test Deadline'),
      })
    })

    it('notifies for deadlines due today without reminder', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(true)

      const deadline = createDeadline({
        due_date: `${todayStr}T12:00:00.000Z`,
        reminder_date: null,
      })

      await checkAndNotifyUpcomingDeadlines([deadline])

      expect(sendNotification).toHaveBeenCalledWith({
        title: 'Prazo Vencendo Hoje',
        body: expect.stringContaining('Test Deadline'),
      })
    })

    it('does not notify for completed deadlines', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(true)

      const deadline = createDeadline({
        completed: true,
        reminder_date: `${todayStr}T09:00:00.000Z`,
      })

      await checkAndNotifyUpcomingDeadlines([deadline])

      expect(sendNotification).not.toHaveBeenCalled()
    })

    it('does not notify for future deadlines', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(true)

      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = toLocalDateKey(tomorrow)

      const deadline = createDeadline({
        due_date: `${tomorrowStr}T12:00:00.000Z`,
        reminder_date: `${tomorrowStr}T09:00:00.000Z`,
      })

      await checkAndNotifyUpcomingDeadlines([deadline])

      expect(sendNotification).not.toHaveBeenCalled()
    })
  })

  describe('checkAndNotifyOverdueDeadlines', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = toLocalDateKey(yesterday)

    const createDeadline = (overrides: Partial<Deadline> = {}): Deadline => ({
      id: 1,
      title: 'Test Deadline',
      description: null,
      due_date: `${yesterdayStr}T12:00:00.000Z`,
      reminder_date: null,
      priority: 'normal',
      completed: false,
      case_id: null,
      client_id: null,
      created_at: '2024-01-01T00:00:00.000Z',
      ...overrides,
    })

    it('does nothing when not in Tauri environment', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(false)

      await checkAndNotifyOverdueDeadlines([createDeadline()])

      expect(sendNotification).not.toHaveBeenCalled()
    })

    it('notifies when there are overdue deadlines', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(true)

      const deadlines = [
        createDeadline({ id: 1 }),
        createDeadline({ id: 2 }),
      ]

      await checkAndNotifyOverdueDeadlines(deadlines)

      expect(sendNotification).toHaveBeenCalledWith({
        title: 'Prazos Vencidos',
        body: 'Você tem 2 prazo(s) vencido(s). Verifique sua agenda.',
      })
    })

    it('does not notify for completed deadlines', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(true)

      const deadline = createDeadline({ completed: true })

      await checkAndNotifyOverdueDeadlines([deadline])

      expect(sendNotification).not.toHaveBeenCalled()
    })

    it('does not notify when no overdue deadlines', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true)
      vi.mocked(isPermissionGranted).mockResolvedValue(true)

      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = toLocalDateKey(tomorrow)

      const deadline = createDeadline({
        due_date: `${tomorrowStr}T12:00:00.000Z`,
      })

      await checkAndNotifyOverdueDeadlines([deadline])

      expect(sendNotification).not.toHaveBeenCalled()
    })
  })
})
