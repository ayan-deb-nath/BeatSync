import { useState } from 'react'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, validateSettings } from './preferences'
import type { VisualizerSettings } from './preferences'

export function useVisualizerSettings() {
  const [settings, setSettings] = useState<VisualizerSettings>(() => {
    try { return loadSettings(window.localStorage) }
    catch { return { ...DEFAULT_SETTINGS } }
  })
  const [storageUnavailable, setStorageUnavailable] = useState(false)

  function updateSettings(next: VisualizerSettings) {
    const validated = validateSettings(next)
    setSettings(validated)
    try { setStorageUnavailable(!saveSettings(window.localStorage, validated)) }
    catch { setStorageUnavailable(true) }
  }

  return { settings, updateSettings, storageUnavailable }
}
