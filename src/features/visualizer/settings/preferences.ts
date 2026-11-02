import { isThemeId } from './themes.ts'
import type { ThemeId } from './themes.ts'

export interface VisualizerSettings { theme: ThemeId; sensitivity: number }
export const DEFAULT_SETTINGS: VisualizerSettings = { theme: 'neon-festival', sensitivity: 1 }
export const SENSITIVITY = { minimum: 0.5, maximum: 2, step: 0.05 } as const
export const SETTINGS_KEY = 'beatsync.visualizer.v1'

export function clampSensitivity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  const clamped = Math.max(SENSITIVITY.minimum, Math.min(SENSITIVITY.maximum, value))
  return Math.round(Math.round(clamped / SENSITIVITY.step) * SENSITIVITY.step * 100) / 100
}

export function validateSettings(value: unknown): VisualizerSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS }
  const candidate = value as Record<string, unknown>
  return {
    theme: isThemeId(candidate.theme) ? candidate.theme : DEFAULT_SETTINGS.theme,
    sensitivity: clampSensitivity(candidate.sensitivity),
  }
}

export function loadSettings(storage: Pick<Storage, 'getItem'>): VisualizerSettings {
  try { return validateSettings(JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null')) }
  catch { return { ...DEFAULT_SETTINGS } }
}

export function saveSettings(storage: Pick<Storage, 'setItem'>, settings: VisualizerSettings): boolean {
  try { storage.setItem(SETTINGS_KEY, JSON.stringify(validateSettings(settings))); return true }
  catch { return false }
}
