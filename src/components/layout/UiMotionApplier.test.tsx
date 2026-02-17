import { render } from '@testing-library/react'
import { act } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import UiMotionApplier from './UiMotionApplier'
import { useSettingsStore } from '@/stores/settingsStore'

describe('UiMotionApplier', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.motion
    useSettingsStore.setState({ settings: {} })
  })

  it('should default to normal when setting is missing and media query is false', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))

    render(<UiMotionApplier />)
    expect(document.documentElement.dataset.motion).toBe('normal')
  })

  it('should apply reduced mode when configured explicitly', () => {
    useSettingsStore.setState({ settings: { ui_motion: 'reduced' } })
    render(<UiMotionApplier />)
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })

  it('should react to setting changes', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))

    render(<UiMotionApplier />)
    expect(document.documentElement.dataset.motion).toBe('normal')

    act(() => {
      useSettingsStore.setState((s) => ({ settings: { ...s.settings, ui_motion: 'reduced' } }))
    })

    expect(document.documentElement.dataset.motion).toBe('reduced')
  })

  it('should respect system reduced motion when ui_motion is system', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))

    useSettingsStore.setState({ settings: { ui_motion: 'system' } })
    render(<UiMotionApplier />)

    expect(document.documentElement.dataset.motion).toBe('reduced')
  })
})
