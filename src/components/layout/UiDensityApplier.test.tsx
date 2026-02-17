import { render } from '@testing-library/react'
import { act } from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import UiDensityApplier from './UiDensityApplier'
import { useSettingsStore } from '@/stores/settingsStore'

describe('UiDensityApplier', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.density
    useSettingsStore.setState({ settings: {} })
  })

  it('should default to normal when setting is missing', () => {
    render(<UiDensityApplier />)
    expect(document.documentElement.dataset.density).toBe('normal')
  })

  it('should apply compact density when configured', () => {
    useSettingsStore.setState({ settings: { ui_density: 'compact' } })
    render(<UiDensityApplier />)
    expect(document.documentElement.dataset.density).toBe('compact')
  })

  it('should react to setting changes', () => {
    render(<UiDensityApplier />)
    expect(document.documentElement.dataset.density).toBe('normal')

    act(() => {
      useSettingsStore.setState((s) => ({ settings: { ...s.settings, ui_density: 'compact' } }))
    })
    expect(document.documentElement.dataset.density).toBe('compact')

    act(() => {
      useSettingsStore.setState((s) => ({ settings: { ...s.settings, ui_density: null } }))
    })
    expect(document.documentElement.dataset.density).toBe('normal')
  })
})

