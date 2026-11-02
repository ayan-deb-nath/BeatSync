import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { AudioMeasurements } from '../audio/types'
import { zeroMeasurements } from '../audio/types'
import { VISUALIZER_CONFIG } from './engine/config'
import { CanvasRenderer } from './engine/CanvasRenderer'
import { VisualizerSimulation } from './engine/VisualizerSimulation'

interface Props {
  measurementsRef: RefObject<AudioMeasurements>
  listening: boolean
}

export function AudioReactiveCanvas({ measurementsRef, listening }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const listeningRef = useRef(listening)
  const simulationRef = useRef<VisualizerSimulation | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    listeningRef.current = listening
    simulationRef.current?.resetOnsets()
  }, [listening])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) { setUnavailable(true); return }
    const renderer = new CanvasRenderer(context)
    const simulation = new VisualizerSimulation()
    simulationRef.current = simulation
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const silence = zeroMeasurements()
    let frame: number | null = null
    let previous = 0
    let width = 0, height = 0, pixelRatio = 0
    let disposed = false

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, VISUALIZER_CONFIG.maxDpr)
      if (rect.width === width && rect.height === height && dpr === pixelRatio) return
      width = rect.width; height = rect.height; pixelRatio = dpr
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      simulation.setMobile(width <= VISUALIZER_CONFIG.mobileBreakpoint)
      renderer.resize(width, height)
      renderer.draw(simulation, motion.matches)
    }
    const tick = (now: number) => {
      frame = null
      if (disposed || document.hidden || motion.matches) return
      if (previous && now - previous < 1000 / VISUALIZER_CONFIG.maxFps - 0.5) {
        frame = requestAnimationFrame(tick)
        return
      }
      // A display move or zoom can change DPR without changing the CSS dimensions.
      if (pixelRatio !== Math.min(window.devicePixelRatio || 1, VISUALIZER_CONFIG.maxDpr)) resize()
      const dt = previous ? (now - previous) / 1000 : 1 / 60
      previous = now
      simulation.step(dt, listeningRef.current ? measurementsRef.current : silence, listeningRef.current)
      renderer.draw(simulation, false)
      frame = requestAnimationFrame(tick)
    }
    const refresh = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      previous = 0
      // Discard stale transients after hidden tabs or motion-preference changes.
      simulation.clear()
      resize()
      renderer.draw(simulation, motion.matches)
      if (!document.hidden && !motion.matches) frame = requestAnimationFrame(tick)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', refresh)
    motion.addEventListener('change', refresh)
    refresh()

    return () => {
      disposed = true
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', refresh)
      motion.removeEventListener('change', refresh)
      simulation.clear()
      simulationRef.current = null
    }
  }, [measurementsRef])

  return (
    <div className="orbit-scene canvas-scene">
      <canvas ref={canvasRef} className="reactive-canvas" role="img" aria-label="Neon rings with an audio-reactive core, low-frequency shockwaves, mid-frequency particle bursts, and high-frequency sparks. Calm when inactive; static with reduced motion.">
        Neon audio visualizer. Live measurements are also available in the audio meters below.
      </canvas>
      {unavailable && <p className="canvas-fallback">Canvas is unavailable in this browser. Microphone controls and live audio meters are still available.</p>}
      <span className="scene-coordinate coordinate-left" aria-hidden="true">BS / NF—01</span>
      <span className="scene-coordinate coordinate-right" aria-hidden="true">{listening ? 'LIVE AUDIO' : 'IDLE STAGE'}</span>
    </div>
  )
}
