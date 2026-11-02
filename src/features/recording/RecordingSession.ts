import { recordingExtension, recordingFilename, selectRecordingMime } from './formats.ts'

export const RECORDING_LIMITS = { durationMs: 120_000, bytes: 64 * 1024 * 1024, frameRate: 30, videoBitrate: 3_000_000 } as const

export interface CompletedRecording {
  blob: Blob
  url: string
  filename: string
  mime: string
  durationMs: number
  downloadRequested: boolean
}

export interface RecordingState {
  status: 'idle' | 'starting' | 'recording' | 'stopping' | 'ready' | 'error'
  supported: boolean
  supportReason: string
  elapsedMs: number
  message: string
  result: CompletedRecording | null
}

export interface RecordingPlatform {
  Recorder: typeof MediaRecorder | undefined
  Stream: typeof MediaStream | undefined
  now: () => number
  date: () => Date
  createURL: (blob: Blob) => string
  revokeURL: (url: string) => void
  interval: typeof setInterval
  clearInterval: typeof clearInterval
  timeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
}

function browserPlatform(): RecordingPlatform {
  return {
    Recorder: typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
    Stream: typeof MediaStream === 'undefined' ? undefined : MediaStream,
    now: () => performance.now(), date: () => new Date(),
    createURL: blob => URL.createObjectURL(blob), revokeURL: url => URL.revokeObjectURL(url),
    interval: setInterval.bind(globalThis), clearInterval: clearInterval.bind(globalThis),
    timeout: setTimeout.bind(globalThis), clearTimeout: clearTimeout.bind(globalThis),
  }
}

interface ActiveRecording {
  recorder: MediaRecorder | null
  tracks: MediaStreamTrack[]
  chunks: Blob[]
  bytes: number
  mime: string
  startedAt: number | null
  durationMs: number
  timer: ReturnType<typeof setInterval> | null
  watchdog: ReturnType<typeof setTimeout> | null
  removers: (() => void)[]
  redraw: () => void
}

/** Owns only Canvas capture tracks and a microphone clone, never shared originals. */
export class RecordingSession {
  private readonly platform: RecordingPlatform
  private active: ActiveRecording | null = null
  private listeners = new Set<() => void>()
  private state: RecordingState = {
    status: 'idle', supported: false, supportReason: 'Checking recording support…',
    elapsedMs: 0, message: '', result: null,
  }

  constructor(platform = browserPlatform()) { this.platform = platform }
  getState = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private update(patch: Partial<RecordingState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach(listener => listener())
  }

  checkSupport = (canvas: HTMLCanvasElement | null): string | null => {
    const { Recorder, Stream } = this.platform
    let reason = ''
    let mime: string | null = null
    if (!Recorder || !Stream) reason = 'Video recording is unavailable in this browser.'
    else if (!canvas || typeof canvas.captureStream !== 'function') reason = 'This browser cannot record the visualizer Canvas.'
    else if (typeof Recorder.isTypeSupported !== 'function') reason = 'This browser cannot verify a compatible audio/video recording format.'
    else {
      mime = selectRecordingMime(type => Recorder.isTypeSupported(type))
      if (!mime) reason = 'No compatible video recording format with microphone audio was found.'
    }
    this.update({ supported: mime !== null, supportReason: reason })
    return mime
  }

  start = (canvas: HTMLCanvasElement | null, cloneAudio: () => MediaStreamTrack | null, redraw = () => {}) => {
    if (this.active) return
    if (this.state.result) {
      this.update({ message: 'Download this take if you want to keep it, then discard it before recording another.' })
      return
    }
    const mime = this.checkSupport(canvas)
    if (!mime || !canvas) return
    const run: ActiveRecording = {
      recorder: null, tracks: [], chunks: [], bytes: 0, mime, startedAt: null,
      durationMs: 0, timer: null, watchdog: null, removers: [], redraw,
    }
    this.active = run
    this.update({ status: 'starting', elapsedMs: 0, message: 'Starting local video and microphone recording…' })
    try {
      const audio = cloneAudio()
      if (!audio) throw new Error('Start microphone listening before recording.')
      run.tracks.push(audio)
      const captured = canvas.captureStream(RECORDING_LIMITS.frameRate)
      // Own every track returned by captureStream, even if the browser returns no video.
      run.tracks.push(...captured.getTracks())
      const video = captured.getVideoTracks()[0]
      if (!video || video.readyState !== 'live' || audio.readyState !== 'live') throw new Error('A live Canvas video track and microphone audio track are required.')
      const stream = new this.platform.Stream!([video, audio])
      const recorder = new this.platform.Recorder!(stream, {
        mimeType: mime, videoBitsPerSecond: RECORDING_LIMITS.videoBitrate, audioBitsPerSecond: 128_000,
      })
      run.recorder = recorder
      const listen = (target: EventTarget, event: string, callback: EventListener) => {
        target.addEventListener(event, callback)
        run.removers.push(() => target.removeEventListener(event, callback))
      }
      listen(recorder, 'start', () => {
        if (this.active !== run || this.state.status !== 'starting') return
        if (run.watchdog !== null) this.platform.clearTimeout(run.watchdog)
        run.watchdog = null
        run.startedAt ??= this.platform.now()
        this.update({ status: 'recording', elapsedMs: Math.max(0, this.platform.now() - run.startedAt), message: 'Recording Canvas video and microphone audio locally.' })
        run.timer = this.platform.interval(() => this.tick(run), 250)
        this.requestFrame(run)
      })
      listen(recorder, 'dataavailable', event => {
        if (this.active !== run) return
        const data = (event as BlobEvent).data
        if (!data?.size) return
        if (run.bytes + data.size > RECORDING_LIMITS.bytes) {
          this.fail('The recording exceeded the 64 MiB memory safety limit. No video was kept. Try a shorter take.')
          return
        }
        run.chunks.push(data); run.bytes += data.size
        if (run.bytes >= RECORDING_LIMITS.bytes - 4 * 1024 * 1024) this.stop('The memory limit was reached. Recording finalized early.')
      })
      listen(recorder, 'stop', () => this.finish(run))
      listen(recorder, 'error', () => { if (this.active === run) this.fail('The browser could not complete the recording. No video was kept. Try again or use another supported browser.') })
      for (const track of run.tracks) listen(track, 'ended', () => this.stop('A recording track ended. The available performance has been finalized.'))
      // Timeslices bound retained chunks under normal browser scheduling; they are not a clock.
      run.watchdog = this.platform.timeout(() => {
        if (this.active === run && this.state.status === 'starting') this.fail('The browser did not start recording. Please try again.')
      }, 5000)
      run.startedAt = this.platform.now()
      recorder.start(1000)
      // A static Canvas must paint once before some browsers can start the encoder.
      this.requestFrame(run)
    } catch (error) {
      this.fail(error instanceof Error && (error.message.startsWith('Start microphone') || error.message.startsWith('A live Canvas'))
        ? error.message : 'Could not start audio/video recording. The selected format or stream may be unsupported. Try again or use another browser.')
      if (error instanceof DOMException && (error.name === 'NotSupportedError' || error.name === 'SecurityError')) {
        this.update({ supported: false, supportReason: 'This browser rejected combined Canvas and microphone recording. Try another supported browser or check the page permissions.' })
      }
    }
  }

  private requestFrame(run: ActiveRecording) {
    if (this.active !== run) return
    try { run.redraw() }
    catch { this.fail('Canvas capture was interrupted. No video was kept. Please try again.'); return }
    // Also supplies held frames when reduced motion leaves the Canvas static.
    for (const track of run.tracks) {
      const video = track as CanvasCaptureMediaStreamTrack
      if (track.kind === 'video' && typeof video.requestFrame === 'function') {
        try { video.requestFrame() } catch { /* Track-ending handlers will finalize capture. */ }
      }
    }
  }

  private tick(run: ActiveRecording) {
    if (this.active !== run || this.state.status !== 'recording' || run.startedAt === null) return
    run.durationMs = Math.max(0, this.platform.now() - run.startedAt)
    if (run.durationMs >= RECORDING_LIMITS.durationMs) {
      this.stop('The two-minute limit was reached. Recording finalized automatically.')
      return
    }
    if (Math.floor(run.durationMs / 1000) !== Math.floor(this.state.elapsedMs / 1000)) this.update({ elapsedMs: run.durationMs })
    this.requestFrame(run)
  }

  stop = (message = 'Recording finished. Preview or download your performance below.') => {
    const run = this.active
    if (!run || this.state.status === 'stopping') return
    run.durationMs = run.startedAt === null ? 0 : Math.max(0, this.platform.now() - run.startedAt)
    if (run.timer !== null) this.platform.clearInterval(run.timer)
    if (run.watchdog !== null) this.platform.clearTimeout(run.watchdog)
    this.update({ status: 'stopping', elapsedMs: run.durationMs, message })
    run.watchdog = this.platform.timeout(() => {
      if (this.active === run) this.fail('The browser did not finalize the recording. No video was kept. Please try again.')
    }, 5000)
    try {
      if (run.recorder && run.recorder.state !== 'inactive') run.recorder.stop()
      // stop() queues final data/stop events; release our independent tracks now.
      run.tracks.forEach(track => track.stop())
    } catch { this.fail('The browser could not stop recording cleanly. No video was kept.') }
  }

  private finish(run: ActiveRecording) {
    if (this.active !== run) return
    const unexpected = this.state.status !== 'stopping'
    if (unexpected) run.durationMs = run.startedAt === null ? 0 : Math.max(0, this.platform.now() - run.startedAt)
    const mime = run.recorder?.mimeType || run.chunks.find(chunk => chunk.type)?.type || run.mime
    if (!run.bytes || !recordingExtension(mime)) { this.fail('The browser produced an empty or unsupported recording. No downloadable video was created. Please try again.'); return }
    try {
      const blob = new Blob(run.chunks, { type: mime })
      const filename = recordingFilename(mime, this.platform.date())
      const url = this.platform.createURL(blob)
      const result = { blob, url, filename, mime, durationMs: run.durationMs, downloadRequested: false }
      this.cleanup(run)
      this.update({ status: 'ready', result, elapsedMs: result.durationMs,
        message: unexpected ? 'Recording stopped unexpectedly. The available video is ready; review it before downloading.' : this.state.message })
    } catch { this.fail('The recording could not be prepared for download. Please try a shorter take.') }
  }

  private cleanup(run: ActiveRecording) {
    this.active = null
    if (run.timer !== null) this.platform.clearInterval(run.timer)
    if (run.watchdog !== null) this.platform.clearTimeout(run.watchdog)
    run.removers.forEach(remove => remove())
    if (run.recorder && run.recorder.state !== 'inactive') {
      try { run.recorder.stop() } catch { /* Tracks still release below. */ }
    }
    run.tracks.forEach(track => track.stop())
    run.chunks.length = 0
  }

  private fail(message: string) {
    if (this.active) this.cleanup(this.active)
    this.update({ status: 'error', message })
  }

  markDownloadRequested = () => {
    if (this.state.result) this.update({ result: { ...this.state.result, downloadRequested: true } })
  }

  discard = () => {
    if (this.active) return
    if (this.state.result) this.platform.revokeURL(this.state.result.url)
    this.update({ status: 'idle', result: null, elapsedMs: 0, message: '' })
  }

  dispose = () => {
    if (this.active) this.cleanup(this.active)
    this.discard()
  }
}
