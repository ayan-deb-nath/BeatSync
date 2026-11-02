import { VISUALIZER_CONFIG } from './config.ts'

type Band = 'low' | 'mid' | 'high'

/** Relative-level onset heuristic, not a sound classifier. Times are seconds. */
export class OnsetDetector {
  private baseline = 0
  private previous = 0
  private elapsed = 0
  private cooldown = 0
  private armed = true
  private initialized = false
  private readonly band: Band

  constructor(band: Band) { this.band = band }

  reset() {
    this.baseline = this.previous = this.elapsed = this.cooldown = 0
    this.armed = true
    this.initialized = false
  }

  update(level: number, dt: number): boolean {
    const tuning = VISUALIZER_CONFIG.onset[this.band]
    if (!this.initialized) {
      this.baseline = this.previous = level
      this.initialized = true
    }
    this.elapsed += dt
    this.cooldown = Math.max(0, this.cooldown - dt)
    const excess = level - this.baseline
    const slope = (level - this.previous) / Math.max(dt, 0.001)
    // A sustained tone/noise must fall toward its baseline before it can re-arm.
    if (excess < tuning.margin * 0.4) this.armed = true
    const onset = this.elapsed > VISUALIZER_CONFIG.onset.warmup && this.armed
      && this.cooldown === 0 && level >= tuning.minimum && excess > tuning.margin && slope > tuning.slope
    if (onset) {
      this.armed = false
      this.cooldown = tuning.cooldown
    }
    this.baseline += (level - this.baseline) * (1 - Math.exp(-dt / VISUALIZER_CONFIG.onset.baselineSeconds))
    this.previous = level
    return onset
  }
}
