import type { AudioMeasurements } from '../../audio/types.ts'
import { VISUALIZER_CONFIG as config } from './config.ts'
import { OnsetDetector } from './OnsetDetector.ts'
import { clampSensitivity } from '../settings/preferences.ts'

export interface Particle {
  x: number; y: number
  vx: number; vy: number; age: number; lifetime: number
  spark: boolean; pink: boolean
}

export interface Shockwave { age: number; lifetime: number; strength: number }

const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

/** Pure, bounded simulation in ring-radius units. No browser or React dependencies. */
export class VisualizerSimulation {
  readonly particles: Particle[] = []
  readonly waves: Shockwave[] = []
  energy = 0
  coreScale = 1
  time = 0
  private limit: number = config.particles.desktop
  private low = new OnsetDetector('low')
  private mid = new OnsetDetector('mid')
  private high = new OnsetDetector('high')
  private emission = 0

  setMobile(mobile: boolean) {
    this.limit = mobile ? config.particles.mobile : config.particles.desktop
    if (this.particles.length > this.limit) this.particles.length = this.limit
  }

  resetOnsets() { this.low.reset(); this.mid.reset(); this.high.reset() }

  clear() {
    this.particles.length = this.waves.length = 0
    this.energy = this.time = this.emission = 0
    this.coreScale = 1
    this.resetOnsets()
  }

  step(dt: number, levels: AudioMeasurements, listening: boolean, reducedMotion = false, sensitivity = 1) {
    dt = Math.max(0, Math.min(0.05, dt))
    if (reducedMotion) { this.clear(); return }
    this.time += dt
    sensitivity = clampSensitivity(sensitivity)
    const target = listening ? 1 - Math.exp(-unit(levels.volume) * config.core.gain * sensitivity) : 0
    this.energy += (target - this.energy) * (1 - Math.exp(-dt / (target > this.energy ? config.core.attack : config.core.release)))
    this.coreScale = 1 + this.energy * config.core.expansion
    if (listening) {
      if (this.low.update(unit(levels.low), dt, sensitivity) && this.waves.length < config.waves.maximum) {
        this.waves.push({ age: 0, lifetime: config.waves.lifetime, strength: unit(levels.low) })
      }
      if (this.mid.update(unit(levels.mid), dt, sensitivity)) this.emit(false)
      if (this.high.update(unit(levels.high), dt, sensitivity)) this.emit(true)
    } else this.resetOnsets()

    let write = 0
    for (const particle of this.particles) {
      particle.age += dt
      if (particle.age >= particle.lifetime) continue
      const drag = Math.exp(-dt * (particle.spark ? 0.8 : 1.6))
      particle.vx *= drag; particle.vy *= drag
      particle.x += particle.vx * dt; particle.y += particle.vy * dt
      this.particles[write++] = particle
    }
    this.particles.length = write
    write = 0
    for (const wave of this.waves) {
      wave.age += dt
      if (wave.age < wave.lifetime) this.waves[write++] = wave
    }
    this.waves.length = write
  }

  private emit(spark: boolean) {
    const count = spark ? config.particles.sparks : config.particles.burst
    // Deterministic placement changes each burst; it never supplies synthetic audio.
    const offset = this.emission++ * 2.399963
    for (let index = 0; index < count && this.particles.length < this.limit; index++) {
      const angle = offset + (index / count) * Math.PI * 2
      const radius = spark ? 1.03 : 0.92
      const speed = spark ? 1.45 : 0.48 + (index % 4) * 0.12
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        age: 0, lifetime: spark ? config.particles.sparkLifetime : config.particles.lifetime,
        spark, pink: spark && index % 2 === 0,
      })
    }
  }
}
