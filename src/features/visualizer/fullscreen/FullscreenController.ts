export interface FullscreenState {
  supported: boolean
  active: boolean
  pending: boolean
  error: string | null
}

type FullscreenDocument = Pick<Document, 'fullscreenEnabled' | 'fullscreenElement' | 'exitFullscreen' | 'addEventListener' | 'removeEventListener'>

/** State is derived from fullscreenElement, never from an optimistic request. */
export class FullscreenController {
  private readonly target: () => HTMLElement | null
  private readonly host: FullscreenDocument
  private listeners = new Set<() => void>()
  private state: FullscreenState = { supported: false, active: false, pending: false, error: null }

  constructor(target: () => HTMLElement | null, host: FullscreenDocument) {
    this.target = target; this.host = host
  }

  getState = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private sync = (error: string | null = this.state.error, pending = this.state.pending) => {
    const target = this.target()
    const next = {
      supported: typeof target?.requestFullscreen === 'function' && typeof this.host.exitFullscreen === 'function' && !!this.host.fullscreenEnabled,
      active: target !== null && this.host.fullscreenElement === target,
      pending, error,
    }
    if (next.supported === this.state.supported && next.active === this.state.active
      && next.pending === this.state.pending && next.error === this.state.error) return
    this.state = next
    this.listeners.forEach(listener => listener())
  }

  private changed = () => this.sync(null)
  private failed = () => this.sync('Fullscreen was not allowed. Try again from the Fullscreen button, or check your browser permissions.')

  connect = () => {
    this.host.addEventListener('fullscreenchange', this.changed)
    this.host.addEventListener('fullscreenerror', this.failed)
    this.sync()
    return () => {
      this.host.removeEventListener('fullscreenchange', this.changed)
      this.host.removeEventListener('fullscreenerror', this.failed)
    }
  }

  toggle = async () => {
    if (this.state.pending) return
    this.sync(null)
    if (!this.state.supported) {
      this.sync('Fullscreen is unavailable in this browser or embedded page. The visualizer still works in the current view.')
      return
    }
    this.sync(null, true)
    try {
      if (this.state.active) await this.host.exitFullscreen()
      else await this.target()?.requestFullscreen()
      this.sync(null)
    } catch {
      this.failed()
    } finally {
      this.sync(this.state.error, false)
    }
  }
}
