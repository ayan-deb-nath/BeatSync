import type { VisualizerSimulation } from './VisualizerSimulation.ts'
import { THEMES } from '../settings/themes.ts'
import type { ThemeId } from '../settings/themes.ts'

const TAU = Math.PI * 2
const alpha = (color: string, opacity: number) => `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`

function glowSprite(color: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 32
  const context = sprite.getContext('2d')
  if (context) {
    const glow = context.createRadialGradient(16, 16, 0, 16, 16, 16)
    glow.addColorStop(0, '#ffffff')
    glow.addColorStop(0.12, color)
    glow.addColorStop(0.35, `${color}90`)
    glow.addColorStop(1, `${color}00`)
    context.fillStyle = glow
    context.fillRect(0, 0, 32, 32)
  }
  return sprite
}

/** Drawing only. Small glow sprites are cached once, not recreated per particle. */
export class CanvasRenderer {
  private width = 0
  private height = 0
  private radius = 1
  private background: CanvasGradient | null = null
  private cyan = glowSprite('#00e5ff')
  private purple = glowSprite('#ac7cff')
  private pink = glowSprite('#ff70cb')
  private themeId: ThemeId = 'neon-festival'
  private theme = THEMES[this.themeId]
  private readonly context: CanvasRenderingContext2D

  constructor(context: CanvasRenderingContext2D) { this.context = context }

  setTheme(id: ThemeId) {
    if (id === this.themeId) return
    this.themeId = id
    this.theme = THEMES[id]
    this.cyan = glowSprite(this.theme.spark)
    this.purple = glowSprite(this.theme.burst)
    this.pink = glowSprite(this.theme.sparkAccent)
    this.resize(this.width, this.height)
  }

  resize(width: number, height: number) {
    this.width = width; this.height = height
    this.radius = Math.min(width * 0.30, height * 0.30)
    const glow = this.context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.5)
    glow.addColorStop(0, this.theme.background[0])
    glow.addColorStop(0.35, this.theme.background[1])
    glow.addColorStop(1, this.theme.background[2])
    this.background = glow
  }

  draw(simulation: VisualizerSimulation, reducedMotion: boolean) {
    const ctx = this.context, radius = this.radius
    if (!this.width || !this.height) return
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.fillStyle = this.background ?? '#0a0a14'
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.save()
    ctx.translate(this.width / 2, this.height / 2)
    const phase = reducedMotion ? 0 : simulation.time * 0.08
    const energy = reducedMotion ? 0 : simulation.energy
    const ring = ctx.createLinearGradient(-radius, -radius, radius, radius)
    ring.addColorStop(0, this.theme.primary); ring.addColorStop(0.55, this.theme.secondary); ring.addColorStop(1, this.theme.accent)

    // Quiet orbital guides, then three luminous rings. Glow is confined to a few strokes.
    ctx.strokeStyle = `${this.theme.guide}26`
    ctx.lineWidth = 1
    this.circle(radius * 1.25)
    ctx.setLineDash([2, 6])
    this.circle(radius * 1.18)
    ctx.setLineDash([])
    ctx.save()
    ctx.rotate(phase)
    ctx.strokeStyle = ring
    ctx.shadowColor = this.theme.glow
    ctx.shadowBlur = (9 + energy * 7) * this.theme.bloom
    ctx.globalAlpha = 0.64 + energy * 0.36
    ctx.lineWidth = 1.2
    this.circle(radius * 1.08)
    ctx.lineWidth = 2 + energy
    this.circle(radius * (1 + energy * 0.025))
    ctx.lineWidth = 1
    this.circle(radius * 0.92)
    ctx.restore()
    ctx.strokeStyle = `${this.theme.guide}25`
    this.circle(radius * 0.69)

    const coreRadius = radius * 0.35 * (reducedMotion ? 1 : simulation.coreScale)
    const coreGlow = ctx.createRadialGradient(0, 0, coreRadius * 0.3, 0, 0, radius * 0.83)
    coreGlow.addColorStop(0, alpha(this.theme.glow, 0.12 + energy * 0.24))
    coreGlow.addColorStop(1, `${this.theme.glow}00`)
    ctx.fillStyle = coreGlow
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
    ctx.fillStyle = this.theme.core
    ctx.beginPath(); ctx.arc(0, 0, coreRadius, 0, TAU); ctx.fill()
    ctx.strokeStyle = ring
    ctx.globalAlpha = 0.35 + energy * 0.35
    this.circle(coreRadius)
    ctx.globalAlpha = 1
    ctx.lineCap = 'round'
    ctx.strokeStyle = this.theme.symbol
    ctx.lineWidth = 2
    // Brand waveform is decorative, not a synthetic equalizer.
    for (let index = -2; index <= 2; index++) {
      const halfHeight = (3 - Math.abs(index)) * coreRadius * 0.12
      const x = index * coreRadius * 0.15
      ctx.beginPath(); ctx.moveTo(x, -halfHeight); ctx.lineTo(x, halfHeight); ctx.stroke()
    }

    if (this.theme.motif === 'angular') {
      ctx.strokeStyle = this.theme.accent
      ctx.lineWidth = 1.5
      for (let index = 0; index < 4; index++) {
        const angle = index * Math.PI / 2 + Math.PI / 4
        ctx.save(); ctx.rotate(angle)
        ctx.beginPath(); ctx.moveTo(radius * 1.12, -8)
        ctx.lineTo(radius * 1.20, 0); ctx.lineTo(radius * 1.12, 8); ctx.stroke()
        ctx.restore()
      }
    }

    if (!reducedMotion) {
      ctx.globalCompositeOperation = 'lighter'
      for (const wave of simulation.waves) {
        const progress = wave.age / wave.lifetime
        ctx.globalAlpha = (1 - progress) ** 2 * (0.45 + wave.strength * 0.45)
        ctx.strokeStyle = this.theme.wave
        ctx.lineWidth = 1.5 * (1 - progress) + 0.3
        this.circle(radius * (1.05 + progress * 0.65))
      }
      for (const particle of simulation.particles) {
        const progress = particle.age / particle.lifetime
        ctx.globalAlpha = Math.min(1, (1 - progress) * 1.3)
        const x = particle.x * radius, y = particle.y * radius
        if (particle.spark) {
          ctx.lineWidth = 1
          ctx.strokeStyle = particle.pink ? this.theme.sparkAccent : this.theme.spark
          ctx.beginPath()
          ctx.moveTo(x - particle.vx * radius * 0.025, y - particle.vy * radius * 0.025)
          ctx.lineTo(x, y); ctx.stroke()
        }
        const size = particle.spark ? 10 : 13
        ctx.drawImage(particle.spark ? (particle.pink ? this.pink : this.cyan) : this.purple, x - size / 2, y - size / 2, size, size)
        if (this.theme.motif === 'stars' && !particle.spark) {
          ctx.strokeStyle = this.theme.symbol
          ctx.lineWidth = 0.8
          ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.lineTo(x + 2.5, y)
          ctx.moveTo(x, y - 2.5); ctx.lineTo(x, y + 2.5); ctx.stroke()
        }
      }
      // Sparse, fixed ambient lights; no bursts or shockwaves are fabricated while idle.
      ctx.globalCompositeOperation = 'source-over'
      for (let index = 0; index < 12; index++) {
        const angle = index * 2.399963 + phase * 0.1
        const distance = radius * (1.28 + (index % 4) * 0.10)
        ctx.globalAlpha = (0.2 + Math.sin(simulation.time * 0.5 + index) * 0.09) * this.theme.ambience
        ctx.drawImage(index % 2 ? this.purple : this.cyan, Math.cos(angle) * distance - 4, Math.sin(angle) * distance - 4, 8, 8)
      }
    }
    ctx.restore()
  }

  private circle(radius: number) {
    this.context.beginPath(); this.context.arc(0, 0, radius, 0, TAU); this.context.stroke()
  }
}
