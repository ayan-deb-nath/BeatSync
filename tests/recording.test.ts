import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RecordingSession, RECORDING_LIMITS } from '../src/features/recording/RecordingSession.ts'
import type { RecordingPlatform } from '../src/features/recording/RecordingSession.ts'
import { formatDuration, recordingExtension, recordingFilename, selectRecordingMime } from '../src/features/recording/formats.ts'

class TestTrack extends EventTarget {
  kind: string
  readyState = 'live'
  stops = 0
  frames = 0
  constructor(kind: string) { super(); this.kind = kind }
  stop() { this.readyState = 'ended'; this.stops++ }
  clone() { return new TestTrack(this.kind) }
  requestFrame() { this.frames++ }
}

class TestStream {
  tracks: TestTrack[]
  constructor(tracks: TestTrack[]) { this.tracks = tracks }
  getTracks() { return this.tracks }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video') }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio') }
}

const flush = () => new Promise<void>(resolve => queueMicrotask(resolve))

function fixture() {
  let time = 0, id = 0
  const intervals = new Map<number, () => void>()
  const timeouts = new Map<number, { due: number; callback: () => void }>()
  const revoked: string[] = [], created: Blob[] = []
  const original = new TestTrack('audio'), video = new TestTrack('video')
  const clones: TestTrack[] = []
  const configuration = { constructError: false, startError: false, runtimeEmpty: false, hangStop: false, holdStart: false, captureError: false, unsupportedCodec: false }
  class Recorder extends EventTarget {
    static instances: Recorder[] = []
    static isTypeSupported(mime: string) { return mime.startsWith('video/webm') }
    state = 'inactive'
    mimeType: string
    stream: TestStream
    stops = 0
    constructor(stream: TestStream, options: MediaRecorderOptions) {
      super()
      if (configuration.unsupportedCodec) throw new DOMException('Combined stream unsupported', 'NotSupportedError')
      if (configuration.constructError) throw new Error('Codec failure')
      this.stream = stream; this.mimeType = options.mimeType!
      Recorder.instances.push(this)
    }
    start() {
      if (configuration.startError) throw new Error('Start failed')
      this.state = 'recording'
      if (!configuration.holdStart) this.dispatchEvent(new Event('start'))
    }
    chunk(blob = new Blob(['media'], { type: this.mimeType })) {
      const event = new Event('dataavailable')
      Object.defineProperty(event, 'data', { value: blob })
      this.dispatchEvent(event)
    }
    stop() {
      this.stops++; this.state = 'inactive'
      if (configuration.hangStop) return
      queueMicrotask(() => {
        if (!configuration.runtimeEmpty) this.chunk()
        this.dispatchEvent(new Event('stop'))
      })
    }
  }
  const platform: RecordingPlatform = {
    Recorder: Recorder as unknown as typeof MediaRecorder,
    Stream: TestStream as unknown as typeof MediaStream,
    now: () => time, date: () => new Date(2026, 10, 2, 14, 5, 6),
    createURL: blob => { created.push(blob); return `blob:test-${created.length}` },
    revokeURL: url => { revoked.push(url) },
    interval: ((callback: () => void) => { intervals.set(++id, callback); return id }) as unknown as typeof setInterval,
    clearInterval: ((key: number) => { intervals.delete(key) }) as unknown as typeof clearInterval,
    timeout: ((callback: () => void, ms: number) => { timeouts.set(++id, { due: time + ms, callback }); return id }) as unknown as typeof setTimeout,
    clearTimeout: ((key: number) => { timeouts.delete(key) }) as unknown as typeof clearTimeout,
  }
  let capturedFps = 0
  const canvas = {
    getContext: () => ({}),
    captureStream: (fps: number) => {
      if (configuration.captureError) throw new Error('Canvas blocked')
      capturedFps = fps
      return new TestStream([video])
    },
  } as unknown as HTMLCanvasElement
  const clone = () => { const track = original.clone(); clones.push(track); return track as unknown as MediaStreamTrack }
  const session = new RecordingSession(platform)
  const advance = (ms: number) => {
    time += ms
    for (const callback of [...intervals.values()]) callback()
    for (const [key, timer] of [...timeouts]) if (timer.due <= time) { timeouts.delete(key); timer.callback() }
  }
  return { session, canvas, platform, clone, original, video, clones, configuration, Recorder, advance, intervals, timeouts, created, revoked, fps: () => capturedFps }
}

test('recording MIME selection prefers verified VP8/Opus and has verified fallbacks', () => {
  assert.equal(selectRecordingMime(() => true), 'video/webm;codecs=vp8,opus')
  assert.equal(selectRecordingMime(mime => mime === 'video/mp4'), 'video/mp4')
  assert.equal(selectRecordingMime(() => false), null)
  assert.equal(selectRecordingMime(() => { throw new Error('No capability probe') }), null)
  assert.equal(recordingExtension('video/webm;codecs=vp9,opus'), 'webm')
  assert.equal(recordingExtension('video/mp4'), 'mp4')
  assert.equal(recordingExtension('audio/webm'), null)
})

test('filenames and elapsed times use actual output container and zero padding', () => {
  assert.equal(recordingFilename('video/mp4', new Date(2026, 10, 2, 14, 5, 6)), 'BeatSync-Performance-2026-11-02-140506.mp4')
  assert.match(recordingFilename('video/webm;codecs=vp8,opus', new Date()), /\.webm$/)
  assert.throws(() => recordingFilename('invalid', new Date()))
  assert.equal(formatDuration(0), '00:00')
  assert.equal(formatDuration(61_900), '01:01')
})

test('construction and capability checking never capture media', () => {
  const f = fixture()
  assert.equal(f.Recorder.instances.length, 0)
  assert.ok(f.session.checkSupport(f.canvas))
  assert.equal(f.fps(), 0)
  assert.equal(f.clones.length, 0)
})

test('unsupported recording APIs, Canvas, and MIME formats are explained', () => {
  const f = fixture()
  f.platform.Recorder = undefined
  assert.equal(f.session.checkSupport(f.canvas), null)
  assert.match(f.session.getState().supportReason, /unavailable/)
  f.platform.Recorder = f.Recorder as unknown as typeof MediaRecorder
  assert.equal(f.session.checkSupport({} as HTMLCanvasElement), null)
  assert.match(f.session.getState().supportReason, /Canvas/)
  f.Recorder.isTypeSupported = () => false
  assert.equal(f.session.checkSupport(f.canvas), null)
  assert.match(f.session.getState().supportReason, /No compatible/)
})

test('unavailable, lost, or throwing Canvas contexts cannot start recording or clone audio', () => {
  for (const getContext of [() => null, () => ({ isContextLost: () => true }), () => { throw new Error('Canvas disabled') }]) {
    const f = fixture()
    f.canvas.getContext = getContext as typeof f.canvas.getContext
    f.session.start(f.canvas, f.clone)
    assert.equal(f.session.getState().supported, false)
    assert.match(f.session.getState().supportReason, /could not render/)
    assert.equal(f.clones.length, 0)
    assert.equal(f.fps(), 0)
    assert.equal(f.Recorder.instances.length, 0)
  }
})

test('recording combines exactly one Canvas video and a cloned audio track', async () => {
  const f = fixture()
  f.session.start(f.canvas, f.clone)
  assert.equal(f.session.getState().status, 'recording')
  assert.equal(f.fps(), 30)
  const recorder = f.Recorder.instances[0]!
  assert.equal(recorder.stream.getVideoTracks().length, 1)
  assert.equal(recorder.stream.getAudioTracks().length, 1)
  assert.notEqual(recorder.stream.getAudioTracks()[0], f.original)
  f.advance(2400)
  assert.equal(f.session.getState().elapsedMs, 2400)
  f.session.stop()
  assert.equal(f.session.getState().status, 'stopping')
  assert.equal(f.original.readyState, 'live')
  assert.equal(f.clones[0]!.readyState, 'ended')
  assert.equal(f.video.readyState, 'ended')
  await flush()
  assert.equal(f.session.getState().status, 'ready')
  assert.ok(f.session.getState().result!.blob.size > 0)
  assert.equal(f.session.getState().result!.durationMs, 2400)
  assert.equal(f.intervals.size + f.timeouts.size, 0)
})

test('rapid repeated Start/Stop cannot create concurrent sessions', async () => {
  const f = fixture()
  f.session.start(f.canvas, f.clone)
  f.session.start(f.canvas, f.clone)
  f.session.stop(); f.session.stop()
  f.session.start(f.canvas, f.clone)
  assert.equal(f.Recorder.instances.length, 1)
  assert.equal(f.clones.length, 1)
  assert.equal(f.Recorder.instances[0]!.stops, 1)
  await flush()
  f.session.start(f.canvas, f.clone)
  assert.equal(f.Recorder.instances.length, 1, 'completed take must never be silently replaced')
  assert.match(f.session.getState().message, /discard/)
})

test('two-minute limit uses wall-clock elapsed time and automatically finalizes', async () => {
  const f = fixture()
  f.session.start(f.canvas, f.clone)
  f.advance(RECORDING_LIMITS.durationMs + 50)
  assert.equal(f.session.getState().status, 'stopping')
  assert.match(f.session.getState().message, /two-minute/)
  await flush()
  assert.equal(f.session.getState().status, 'ready')
  assert.equal(f.original.stops, 0)
})

test('memory safety rejects an oversized chunk and releases owned resources', async () => {
  const f = fixture()
  f.session.start(f.canvas, f.clone)
  const oversized = new Blob(['test'])
  Object.defineProperty(oversized, 'size', { value: RECORDING_LIMITS.bytes + 1 })
  f.Recorder.instances[0]!.chunk(oversized)
  await flush()
  assert.equal(f.session.getState().status, 'error')
  assert.match(f.session.getState().message, /memory safety/)
  assert.equal(f.session.getState().result, null)
  assert.equal(f.created.length, 0)
  assert.equal(f.clones[0]!.readyState, 'ended')
  assert.equal(f.original.stops, 0)
})

test('empty recording output is an error, never a successful download', async () => {
  const f = fixture()
  f.configuration.runtimeEmpty = true
  f.session.start(f.canvas, f.clone)
  f.session.stop()
  await flush()
  assert.equal(f.session.getState().status, 'error')
  assert.match(f.session.getState().message, /empty/)
  assert.equal(f.created.length, 0)
})

for (const failure of ['constructError', 'startError', 'captureError'] as const) {
  test(`${failure} cleans up the clone and permits an explicit retry`, async () => {
    const f = fixture()
    f.configuration[failure] = true
    f.session.start(f.canvas, f.clone)
    assert.equal(f.session.getState().status, 'error')
    assert.ok(f.clones.every(track => track.readyState === 'ended'))
    assert.equal(f.original.readyState, 'live')
    f.configuration[failure] = false
    // A new Canvas capture gets a fresh video track in real browsers.
    f.video.readyState = 'live'
    f.session.start(f.canvas, f.clone)
    assert.equal(f.session.getState().status, 'recording')
    f.session.dispose()
    await flush()
    assert.equal(f.intervals.size + f.timeouts.size, 0)
  })
}

test('runtime encoder failure produces no success and cleans up', async () => {
  const f = fixture()
  f.session.start(f.canvas, f.clone)
  f.Recorder.instances[0]!.dispatchEvent(new Event('error'))
  await flush()
  assert.equal(f.session.getState().status, 'error')
  assert.equal(f.session.getState().result, null)
  assert.equal(f.video.readyState, 'ended')
  assert.equal(f.original.readyState, 'live')
})

test('a verified format rejected for the combined stream disables recording honestly', () => {
  const f = fixture()
  f.configuration.unsupportedCodec = true
  f.session.start(f.canvas, f.clone)
  assert.equal(f.session.getState().status, 'error')
  assert.equal(f.session.getState().supported, false)
  assert.match(f.session.getState().supportReason, /rejected combined/)
  assert.equal(f.original.readyState, 'live')
  assert.ok(f.clones.every(track => track.readyState === 'ended'))
})

test('a stalled start is not reported as recording and its watchdog cleans up', async () => {
  const f = fixture()
  f.configuration.holdStart = true
  f.session.start(f.canvas, f.clone)
  assert.equal(f.session.getState().status, 'starting')
  assert.equal(f.session.getState().elapsedMs, 0)
  f.advance(5100)
  await flush()
  assert.equal(f.session.getState().status, 'error')
  assert.match(f.session.getState().message, /did not start/)
  assert.equal(f.intervals.size + f.timeouts.size, 0)
  assert.equal(f.original.readyState, 'live')
})

test('near the memory cap, recording finalizes early with an explanation', async () => {
  const f = fixture()
  f.session.start(f.canvas, f.clone)
  const chunk = new Blob(['test'])
  Object.defineProperty(chunk, 'size', { value: RECORDING_LIMITS.bytes - 4 * 1024 * 1024 })
  f.Recorder.instances[0]!.chunk(chunk)
  assert.equal(f.session.getState().status, 'stopping')
  await flush()
  assert.equal(f.session.getState().status, 'ready')
  assert.match(f.session.getState().message, /memory limit/)
})

test('duration includes native start-event delay and static capture paints before that event', async () => {
  const f = fixture()
  f.configuration.holdStart = true
  let paints = 0
  f.session.start(f.canvas, f.clone, () => { paints++ })
  assert.ok(paints > 0, 'static Canvas must repaint before the encoder start event')
  f.advance(1200)
  f.Recorder.instances[0]!.dispatchEvent(new Event('start'))
  assert.equal(f.session.getState().elapsedMs, 1200)
  f.advance(300)
  f.session.stop()
  await flush()
  assert.equal(f.session.getState().result!.durationMs, 1500)
  assert.ok(paints >= 2)
})

test('track ending finalizes safely and unexpected encoder stop is clearly labeled', async () => {
  const f = fixture()
  f.session.start(f.canvas, f.clone)
  f.clones[0]!.dispatchEvent(new Event('ended'))
  await flush()
  assert.equal(f.session.getState().status, 'ready')
  assert.match(f.session.getState().message, /track ended/)
  f.session.discard()
  f.video.readyState = 'live'
  f.session.start(f.canvas, f.clone)
  f.Recorder.instances.at(-1)!.stop()
  await flush()
  assert.match(f.session.getState().message, /unexpectedly/)
})

test('discard and dispose revoke object URLs and allow another take', async () => {
  const f = fixture()
  f.session.start(f.canvas, f.clone); f.session.stop()
  await flush()
  f.session.markDownloadRequested()
  assert.equal(f.session.getState().result!.downloadRequested, true)
  f.session.discard()
  assert.deepEqual(f.revoked, ['blob:test-1'])
  assert.equal(f.session.getState().status, 'idle')
  f.video.readyState = 'live'
  f.session.start(f.canvas, f.clone); f.session.stop()
  await flush()
  f.session.dispose()
  assert.deepEqual(f.revoked, ['blob:test-1', 'blob:test-2'])
  assert.equal(f.original.stops, 0)
})

test('actual recorder MIME determines the Blob and filename extension', async () => {
  const f = fixture()
  f.session.start(f.canvas, f.clone)
  f.Recorder.instances[0]!.mimeType = 'video/mp4'
  f.session.stop()
  await flush()
  assert.match(f.session.getState().result!.filename, /\.mp4$/)
  assert.equal(f.session.getState().result!.blob.type, 'video/mp4')
})

test('missing microphone track, stalled finalization, and unmount dispose release resources', async () => {
  const f = fixture()
  f.session.start(f.canvas, () => null)
  assert.equal(f.session.getState().status, 'error')
  assert.match(f.session.getState().message, /Start microphone/)
  f.configuration.hangStop = true
  f.session.start(f.canvas, f.clone)
  f.session.stop()
  f.advance(5100)
  assert.equal(f.session.getState().status, 'error')
  assert.equal(f.intervals.size + f.timeouts.size, 0)
  f.video.readyState = 'live'
  f.session.start(f.canvas, f.clone)
  f.session.dispose()
  await flush()
  assert.equal(f.session.getState().status, 'idle')
  assert.ok(f.clones.every(track => track.readyState === 'ended'))
  assert.equal(f.original.readyState, 'live')
})
