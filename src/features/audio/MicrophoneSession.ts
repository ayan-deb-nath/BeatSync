import { FFT_SIZE, UI_INTERVAL_MS, updateMeasurements } from './analysis.ts'
import { zeroMeasurements } from './types.ts'
import type { MicrophoneState, MicrophoneStatus } from './types.ts'

interface SessionResources {
  context: AudioContext
  stream: MediaStream | null
  source: MediaStreamAudioSourceNode | null
  analyser: AnalyserNode | null
  frame: number | null
  removeListeners: (() => void)[]
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext }

function errorMessage(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was denied. Allow microphone access in your browser’s site settings, then try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found. Connect a microphone, then try again.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your microphone could not be opened. Check your system permissions and whether another app is using it, then try again.'
    case 'AbortError':
      return 'Microphone startup was interrupted. Please try again.'
    default:
      return 'Audio could not be initialized. Check your microphone and browser audio settings, then try again.'
  }
}

/** Owns browser resources. Construction and subscription never request permission. */
export class MicrophoneSession {
  readonly measurementsRef = { current: zeroMeasurements() }
  private state: MicrophoneState = { status: 'inactive', error: null, permissionPending: false, releasing: false }
  private levels = zeroMeasurements()
  private resources: SessionResources | null = null
  private permissionPending = false
  private closing: Promise<void> | null = null
  private stateListeners = new Set<() => void>()
  private levelListeners = new Set<() => void>()

  getState = () => this.state
  getLevels = () => this.levels
  subscribe = (listener: () => void) => {
    this.stateListeners.add(listener)
    return () => { this.stateListeners.delete(listener) }
  }
  subscribeLevels = (listener: () => void) => {
    this.levelListeners.add(listener)
    return () => { this.levelListeners.delete(listener) }
  }

  private publishState(status: MicrophoneStatus = this.state.status, error = this.state.error) {
    const next = { status, error, permissionPending: this.permissionPending, releasing: this.closing !== null }
    if (next.status === this.state.status && next.error === this.state.error
      && next.permissionPending === this.state.permissionPending && next.releasing === this.state.releasing) return
    this.state = next
    this.stateListeners.forEach(listener => listener())
  }

  private publishLevels() {
    this.levels = { ...this.measurementsRef.current }
    this.levelListeners.forEach(listener => listener())
  }

  private release() {
    const session = this.resources
    this.resources = null // Invalidates every pending continuation before teardown.
    if (session) {
      if (session.frame !== null) cancelAnimationFrame(session.frame)
      session.removeListeners.forEach(remove => remove())
      session.stream?.getTracks().forEach(track => track.stop())
      session.source?.disconnect()
      session.analyser?.disconnect()
      // Serialize context teardown with the next start; streams are stopped synchronously.
      this.closing = session.context.close().catch(() => undefined).then(() => {
        this.closing = null
        this.publishState()
      })
    }
    Object.assign(this.measurementsRef.current, zeroMeasurements())
    this.publishLevels()
  }

  stop = () => {
    this.release()
    this.publishState('inactive', null)
  }

  private fail(message: string) {
    this.release()
    this.publishState('error', message)
  }

  start = async (): Promise<void> => {
    // A browser permission prompt cannot be aborted. Keep the lock until it settles,
    // even after Stop, and immediately stop any stream returned to a canceled session.
    if (this.resources || this.permissionPending || this.closing) return
    if (!window.isSecureContext) {
      this.fail('Microphone access requires HTTPS or localhost. Open BeatSync using a secure address, then try again.')
      return
    }
    const Context = window.AudioContext ?? (window as AudioWindow).webkitAudioContext
    if (!navigator.mediaDevices?.getUserMedia || !Context) {
      this.fail('This browser does not support microphone capture and Web Audio. Try a current version of Chrome, Edge, Firefox, or Safari.')
      return
    }

    let session: SessionResources | null = null
    try {
      session = {
        context: new Context(), stream: null, source: null, analyser: null,
        frame: null, removeListeners: [],
      }
      const current = session
      this.resources = current
      this.publishState('requesting', null)
      // Resume in the explicit click's activation scope (important on mobile browsers).
      // Both promises are observed immediately, including if permission is left pending.
      const resume = current.context.resume()
      this.permissionPending = true
      let request: Promise<MediaStream>
      try {
        request = navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      } catch (error) {
        this.permissionPending = false
        void resume.catch(() => undefined)
        throw error
      }
      this.publishState()
      const capture = request.then(stream => {
        if (this.resources !== current) stream.getTracks().forEach(track => track.stop())
        else current.stream = stream
        return stream
      }).finally(() => {
        this.permissionPending = false
        this.publishState()
      })
      const [stream] = await Promise.all([capture, resume])
      if (this.resources !== current) return
      if (current.context.state !== 'running') throw new Error('Audio context is not running')
      const tracks = stream.getAudioTracks()
      if (!tracks.length || tracks.some(track => track.readyState !== 'live' || track.muted)) {
        this.fail('The microphone disconnected before capture started. Reconnect it, then try again.')
        return
      }
      const analyser = current.context.createAnalyser()
      current.analyser = analyser
      analyser.fftSize = FFT_SIZE
      analyser.minDecibels = -100
      analyser.maxDecibels = -30
      analyser.smoothingTimeConstant = 0.7
      current.source = current.context.createMediaStreamSource(stream)
      current.source.connect(analyser)
      // Intentionally no connection to context.destination: no monitoring or feedback.
      const disconnected = () => {
        if (this.resources === current) this.fail('Microphone input was disconnected or interrupted. Check your device, then try again.')
      }
      for (const track of tracks) {
        track.addEventListener('ended', disconnected)
        track.addEventListener('mute', disconnected)
        current.removeListeners.push(() => {
          track.removeEventListener('ended', disconnected)
          track.removeEventListener('mute', disconnected)
        })
      }
      const contextChanged = () => {
        if (this.resources === current && current.context.state !== 'running') {
          this.fail('Browser audio was suspended or interrupted. Press Start to resume a new microphone session.')
        }
      }
      current.context.addEventListener('statechange', contextChanged)
      current.removeListeners.push(() => current.context.removeEventListener('statechange', contextChanged))
      this.publishState('listening', null)
      this.sample(current, analyser)
    } catch (error) {
      if (session === null || this.resources === session) this.fail(errorMessage(error))
    }
  }

  private sample(session: SessionResources, analyser: AnalyserNode) {
    const waveform = new Float32Array(analyser.fftSize)
    const spectrum = new Uint8Array(analyser.frequencyBinCount)
    let previous = performance.now()
    let lastPublished = previous
    const tick = (now: number) => {
      if (this.resources !== session) return
      try {
        analyser.getFloatTimeDomainData(waveform)
        analyser.getByteFrequencyData(spectrum)
        updateMeasurements(this.measurementsRef.current, waveform, spectrum, session.context.sampleRate, Math.min(now - previous, 100))
        previous = now
        if (now - lastPublished >= UI_INTERVAL_MS) {
          this.publishLevels()
          lastPublished = now
        }
        session.frame = requestAnimationFrame(tick)
      } catch {
        this.fail('Audio analysis was interrupted. Check your device, then try again.')
      }
    }
    session.frame = requestAnimationFrame(tick)
  }
}
