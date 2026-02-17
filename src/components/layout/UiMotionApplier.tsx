import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

function resolveMotionMode(setting: string | null): 'normal' | 'reduced' {
  if (setting === 'normal') return 'normal'
  if (setting === 'reduced') return 'reduced'

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(REDUCED_QUERY).matches ? 'reduced' : 'normal'
  }

  return 'normal'
}

export default function UiMotionApplier() {
  const uiMotionSetting = useSettingsStore((s) => s.settings['ui_motion'])

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.motion = resolveMotionMode(uiMotionSetting)
    }

    apply()

    if (uiMotionSetting && uiMotionSetting !== 'system') return

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(REDUCED_QUERY)
    const onChange = () => apply()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange)
      return () => mediaQuery.removeEventListener('change', onChange)
    }

    mediaQuery.addListener(onChange)
    return () => mediaQuery.removeListener(onChange)
  }, [uiMotionSetting])

  return null
}
