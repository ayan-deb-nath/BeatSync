import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { AudioMeasurements } from '../audio/types'
import { zeroMeasurements } from '../audio/types'
import { VISUALIZER_CONFIG } from './engine/config'
import { CanvasRenderer } from './engine/CanvasRenderer'
import { VisualizerSimulation } from './engine/VisualizerSimulation'
import { DEFAULT_SETTINGS } from './settings/preferences'
import type { VisualizerSettings } from './settings/preferences'
import { getCanvasContext } from './canvasContext'

interface Props {
  measurementsRef: RefObject<AudioMeasurements>
  listening: boolean
  settings?: VisualizerSettings
  captureRef?: RefObject<HTMLCanvasElement | null>
  captureRedrawRef?: RefObject<(() => void) | null>
}

export function AudioReactiveCanvas({ measurementsRef, listening, settings = DEFAULT_SETTINGS, captureRef, captureRedrawRef }: Props) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = captureRef ?? internalCanvasRef
  const listeningRef = useRef(listening)
  const simulationRef = useRef<VisualizerSimulation | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const settingsRef = useRef(settings)
  const redrawRef = useRef<(() => void) | null>(null)
  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    // React invokes callback refs during commit; this is the shared capture ref assignment.
    // eslint-disable-next-line react-hooks/immutability
    canvasRef.current = canvas
    if (canvas) setUnavailable(getCanvasContext(canvas) === null)
  }, [canvasRef])

  useEffect(() => {
    settingsRef.current = settings
    redrawRef.current?.()
  }, [settings])

  useEffect(() => {
    listeningRef.current = listening
    simulationRef.current?.resetOnsets()
  }, [listening])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = getCanvasContext(canvas)
    if (!context) return
    const renderer = new CanvasRenderer(context)
    const simulation = new VisualizerSimulation()
    simulationRef.current = simulation
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const silence = zeroMeasurements()
    let frame: number | null = null
    let previous = 0
    let width = 0, height = 0, pixelRatio = 0
    let disposed = false

    const redraw = () => {
      if (disposed) return
      renderer.setTheme(settingsRef.current.theme)
      renderer.draw(simulation, motion.matches)
    }
    redrawRef.current = redraw
    // Repaint identical pixels for capture, without advancing reduced-motion artwork.
    if (captureRedrawRef) captureRedrawRef.current = () => { if (motion.matches) redraw() }

    const resize = () => {
      if (disposed) return
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, VISUALIZER_CONFIG.maxDpr)
      if (rect.width === width && rect.height === height && dpr === pixelRatio) return
      width = rect.width; height = rect.height; pixelRatio = dpr
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      simulation.setMobile(width <= VISUALIZER_CONFIG.mobileBreakpoint)
      renderer.resize(width, height)
      redraw()
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
      simulation.step(dt, listeningRef.current ? measurementsRef.current : silence, listeningRef.current, false, settingsRef.current.sensitivity)
      renderer.setTheme(settingsRef.current.theme)
      renderer.draw(simulation, false)
      frame = requestAnimationFrame(tick)
    }
    const refresh = () => {
      if (disposed) return
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      previous = 0
      // Discard stale transients after hidden tabs or motion-preference changes.
      simulation.clear()
      resize()
      redraw()
      if (!document.hidden && !motion.matches) frame = requestAnimationFrame(tick)
    }
    const contextLost = () => {
      disposed = true
      if (frame !== null) cancelAnimationFrame(frame)
      if (captureRedrawRef) captureRedrawRef.current = null
      setUnavailable(true)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', refresh)
    motion.addEventListener('change', refresh)
    canvas.addEventListener('contextlost', contextLost)
    refresh()

    return () => {
      disposed = true
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', refresh)
      motion.removeEventListener('change', refresh)
      canvas.removeEventListener('contextlost', contextLost)
      simulation.clear()
      simulationRef.current = null
      redrawRef.current = null
      if (captureRedrawRef) captureRedrawRef.current = null
    }
  }, [measurementsRef, canvasRef, captureRedrawRef])

  return (
    <div className="orbit-scene canvas-scene">
      <canvas ref={attachCanvas} className="reactive-canvas" role="img" aria-label="Neon rings with an audio-reactive core, low-frequency shockwaves, mid-frequency particle bursts, and high-frequency sparks. Calm when inactive; static with reduced motion.">
        Neon audio visualizer. Live measurements are also available in the audio meters below.
      </canvas>
      {unavailable && <p className="canvas-fallback" role="status">Canvas is unavailable. Microphone controls and live audio meters are still available. Try reloading the page or another browser to restore visuals.</p>}
    </div>
  )
}
