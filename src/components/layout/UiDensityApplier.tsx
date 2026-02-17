import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

export default function UiDensityApplier() {
  const uiDensitySetting = useSettingsStore((s) => s.settings['ui_density'])
  const density = uiDensitySetting === 'compact' ? 'compact' : 'normal'

  useEffect(() => {
    document.documentElement.dataset.density = density
  }, [density])

  return null
}

