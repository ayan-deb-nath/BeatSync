import assert from 'node:assert/strict'
import { test } from 'node:test'
import { zeroMeasurements } from '../src/features/audio/types.ts'
import type { AudioMeasurements } from '../src/features/audio/types.ts'
import { OnsetDetector } from '../src/features/visualizer/engine/OnsetDetector.ts'
import { VisualizerSimulation } from '../src/features/visualizer/engine/VisualizerSimulation.ts'
import { VISUALIZER_CONFIG as config } from '../src/features/visualizer/engine/config.ts'

const silence = zeroMeasurements()
function advance(simulation: VisualizerSimulation, seconds: number, levels = silence, listening = true) {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) simulation.step(1 / 60, levels, listening)
}

test('detectors suppress initial sound, sustained noise, and sub-threshold fluctuations', () => {
  for (const band of ['low', 'mid', 'high'] as const) {
    const detector = new OnsetDetector(band)
    let events = 0
    for (let frame = 0; frame < 600; frame++) if (detector.update(.3, 1 / 60)) events++
    assert.equal(events, 0, 'constant room noise must not create events')
    detector.reset()
    for (let frame = 0; frame < 600; frame++) if (detector.update(.02 + Math.sin(frame) * .008, 1 / 60)) events++
    assert.equal(events, 0)
  }
})

test('strong rises trigger once; cooldown blocks a rapid retrigger; later rise can trigger', () => {
  const detector = new OnsetDetector('low')
  for (let i = 0; i < 30; i++) detector.update(0, 1 / 60)
  assert.equal(detector.update(.5, 1 / 60), true)
  assert.equal(detector.update(.7, 1 / 60), false)
  detector.update(0, 1 / 60)
  assert.equal(detector.update(.7, 1 / 60), false)
  for (let i = 0; i < 30; i++) detector.update(0, 1 / 60)
  assert.equal(detector.update(.7, 1 / 60), true)
  detector.reset()
  assert.equal(detector.update(.8, 1 / 60), false, 'reset must restore warmup')
})

test('onset detection works with the gradual attack of smoothed audio measurements', () => {
  const detector = new OnsetDetector('mid')
  for (let i = 0; i < 30; i++) detector.update(.03, 1 / 60)
  let count = 0
  for (let i = 1; i <= 15; i++) if (detector.update(.03 + i * .018, 1 / 60)) count++
  assert.equal(count, 1)
})

test('RMS expands the core smoothly and Stop contracts it toward idle', () => {
  const simulation = new VisualizerSimulation()
  simulation.step(1 / 60, { ...silence, volume: .3 }, true)
  assert.ok(simulation.coreScale > 1 && simulation.coreScale < 1.16)
  const first = simulation.coreScale
  advance(simulation, .4, { ...silence, volume: .3 })
  assert.ok(simulation.coreScale > first)
  assert.ok(simulation.coreScale <= 1 + config.core.expansion)
  advance(simulation, 2, silence, false)
  assert.ok(simulation.coreScale - 1 < .001)
})

for (const band of ['low', 'mid', 'high'] as const) {
  test(`${band} energy maps to its own effect after a real-level rise`, () => {
    const simulation = new VisualizerSimulation()
    advance(simulation, .5)
    const levels: AudioMeasurements = { ...silence, [band]: .5 }
    simulation.step(1 / 60, levels, true)
    assert.equal(simulation.waves.length, band === 'low' ? 1 : 0)
    assert.equal(simulation.particles.length, band === 'mid' ? config.particles.burst : band === 'high' ? config.particles.sparks : 0)
    if (band !== 'low') assert.ok(simulation.particles.every(particle => particle.spark === (band === 'high')))
  })
}

test('inactive input cannot fabricate events, even with stale high measurements', () => {
  const simulation = new VisualizerSimulation()
  advance(simulation, 5, { volume: 1, low: 1, mid: 1, high: 1 }, false)
  assert.equal(simulation.energy, 0)
  assert.equal(simulation.particles.length, 0)
  assert.equal(simulation.waves.length, 0)
})

test('particles move outward, decay, and expire; waves expire after Stop', () => {
  const simulation = new VisualizerSimulation()
  advance(simulation, .5)
  simulation.step(1 / 60, { volume: .2, low: .5, mid: .5, high: .5 }, true)
  const particle = simulation.particles[0]!
  const distance = Math.hypot(particle.x, particle.y)
  const speed = Math.hypot(particle.vx, particle.vy)
  advance(simulation, .1, silence, false)
  assert.ok(Math.hypot(particle.x, particle.y) > distance)
  assert.ok(Math.hypot(particle.vx, particle.vy) < speed)
  assert.ok(simulation.waves[0]!.age > .1)
  assert.ok(simulation.particles.length > 0, 'Stop should allow a natural fade')
  advance(simulation, 1.3, silence, false)
  assert.equal(simulation.particles.length, 0)
  assert.equal(simulation.waves.length, 0)
  advance(simulation, .5)
  simulation.step(1 / 60, { ...silence, low: .5 }, true)
  assert.equal(simulation.waves.length, 1, 'a later session can trigger again')
})

test('particle and shockwave counts stay within desktop and mobile budgets', () => {
  const simulation = new VisualizerSimulation()
  simulation.setMobile(true)
  advance(simulation, .5)
  let emitted = false
  for (let i = 0; i < 2000; i++) {
    const pulse = i % 24 < 8 ? .8 : 0
    simulation.step(1 / 60, { volume: .5, low: pulse, mid: pulse, high: pulse }, true)
    emitted ||= simulation.particles.length > 0
    assert.ok(simulation.particles.length <= config.particles.mobile)
    assert.ok(simulation.waves.length <= config.waves.maximum)
  }
  assert.ok(emitted)
  simulation.setMobile(false)
  assert.ok(simulation.particles.length <= config.particles.desktop)
})

test('reduced motion clears effects and maintains a static core despite loud audio', () => {
  const simulation = new VisualizerSimulation()
  advance(simulation, .5)
  simulation.step(1 / 60, { volume: .5, low: .5, mid: .5, high: .5 }, true)
  assert.ok(simulation.particles.length > 0)
  simulation.step(1 / 60, { volume: 1, low: 1, mid: 1, high: 1 }, true, true)
  assert.equal(simulation.particles.length, 0)
  assert.equal(simulation.waves.length, 0)
  assert.equal(simulation.coreScale, 1)
  assert.equal(simulation.time, 0)
})

test('simulation clear resets effects, core, and onset history', () => {
  const simulation = new VisualizerSimulation()
  advance(simulation, .5)
  simulation.step(1 / 60, { volume: .5, low: .5, mid: .5, high: .5 }, true)
  simulation.clear()
  assert.equal(simulation.particles.length + simulation.waves.length, 0)
  assert.equal(simulation.coreScale, 1)
  assert.equal(simulation.energy, 0)
  simulation.step(1 / 60, { volume: .5, low: .5, mid: .5, high: .5 }, true)
  assert.equal(simulation.particles.length + simulation.waves.length, 0)
})

test('core smoothing is consistent at 30 and 60 Hz', () => {
  const lowRate = new VisualizerSimulation(), highRate = new VisualizerSimulation()
  const levels = { ...silence, volume: .2 }
  for (let i = 0; i < 30; i++) lowRate.step(1 / 30, levels, true)
  for (let i = 0; i < 60; i++) highRate.step(1 / 60, levels, true)
  assert.ok(Math.abs(lowRate.coreScale - highRate.coreScale) < .00001)
})
