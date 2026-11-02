import assert from 'node:assert/strict'
import { test } from 'node:test'
import { THEMES, isThemeId } from '../src/features/visualizer/settings/themes.ts'
import { DEFAULT_SETTINGS, SETTINGS_KEY, clampSensitivity, loadSettings, saveSettings, validateSettings } from '../src/features/visualizer/settings/preferences.ts'
import { VisualizerSimulation } from '../src/features/visualizer/engine/VisualizerSimulation.ts'
import { OnsetDetector } from '../src/features/visualizer/engine/OnsetDetector.ts'

test('all three themes have valid palettes and distinct visual motifs', () => {
  assert.deepEqual(Object.keys(THEMES), ['neon-festival', 'cyberpunk', 'galaxy'])
  for (const [id, theme] of Object.entries(THEMES)) {
    assert.ok(isThemeId(id))
    assert.ok(theme.name.length > 0)
    for (const key of ['primary', 'secondary', 'accent', 'wave', 'burst', 'spark', 'sparkAccent', 'glow', 'guide', 'core', 'symbol'] as const) {
      assert.match(theme[key], /^#[0-9a-f]{6}$/i)
    }
    for (const color of theme.background) assert.match(color, /^#[0-9a-f]{6}$/i)
    assert.ok(theme.bloom > 0 && theme.bloom < 2)
    assert.ok(theme.ambience > 0 && theme.ambience <= 1)
  }
  assert.equal(new Set(Object.values(THEMES).map(theme => theme.motif)).size, 3)
})

test('theme validation rejects invalid and inherited object keys', () => {
  for (const value of ['unknown', '__proto__', 'constructor', '', null, 1]) {
    assert.equal(isThemeId(value), false)
    assert.equal(validateSettings({ theme: value }).theme, 'neon-festival')
  }
  assert.equal(validateSettings({ theme: 'galaxy' }).theme, 'galaxy')
})

test('sensitivity values are validated, clamped, and rounded to slider steps', () => {
  for (const value of [null, undefined, '2', NaN, Infinity, -Infinity]) assert.equal(clampSensitivity(value), 1)
  assert.equal(clampSensitivity(-5), .5)
  assert.equal(clampSensitivity(99), 2)
  assert.equal(clampSensitivity(1.234), 1.25)
  assert.equal(clampSensitivity(1.2), 1.2)
  assert.equal(clampSensitivity(.5), .5)
})

test('preferences round-trip with one versioned storage key', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS)
  assert.equal(saveSettings(storage, { theme: 'cyberpunk', sensitivity: 1.75 }), true)
  assert.equal(values.size, 1)
  assert.ok(values.has(SETTINGS_KEY))
  assert.deepEqual(loadSettings(storage), { theme: 'cyberpunk', sensitivity: 1.75 })
  storage.setItem(SETTINGS_KEY, '{"theme":"invalid","sensitivity":9}')
  assert.deepEqual(loadSettings(storage), { theme: 'neon-festival', sensitivity: 2 })
})

test('corrupt preferences and unavailable storage fail safely', () => {
  assert.deepEqual(loadSettings({ getItem: () => 'broken json' }), DEFAULT_SETTINGS)
  assert.deepEqual(loadSettings({ getItem: () => { throw new Error('Storage blocked') } }), DEFAULT_SETTINGS)
  assert.equal(saveSettings({ setItem: () => { throw new Error('Quota exceeded') } }, DEFAULT_SETTINGS), false)
  for (const value of [null, false, 23, 'bad']) assert.deepEqual(validateSettings(value), DEFAULT_SETTINGS)
})

test('higher sensitivity reveals quieter onsets; lower sensitivity rejects them', () => {
  const low = new OnsetDetector('low'), high = new OnsetDetector('low')
  for (let frame = 0; frame < 30; frame++) { low.update(0, 1 / 60, .5); high.update(0, 1 / 60, 2) }
  assert.equal(low.update(.11, 1 / 60, .5), false)
  assert.equal(high.update(.11, 1 / 60, 2), true)
  assert.equal(high.update(.15, 1 / 60, 2), false, 'sensitivity must not bypass cooldown/latching')
})

test('changing sensitivity does not turn steady noise into artificial transients', () => {
  const detector = new OnsetDetector('mid')
  for (let frame = 0; frame < 600; frame++) {
    const sensitivity = frame % 2 === 0 ? .5 : 2
    assert.equal(detector.update(.3 + Math.sin(frame * .1) * .02, 1 / 60, sensitivity), false)
  }
})

test('sensitivity affects smooth visual gain without mutating raw measurements', () => {
  const measurements = Object.freeze({ volume: .1, low: 0, mid: 0, high: 0 })
  const low = new VisualizerSimulation(), high = new VisualizerSimulation()
  for (let frame = 0; frame < 60; frame++) {
    low.step(1 / 60, measurements, true, false, .5)
    high.step(1 / 60, measurements, true, false, 2)
  }
  assert.ok(high.energy > low.energy)
  assert.ok(high.coreScale <= 1.16)
  assert.deepEqual(measurements, { volume: .1, low: 0, mid: 0, high: 0 })
})
