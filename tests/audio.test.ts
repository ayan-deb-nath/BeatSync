import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { calculateBandEnergy, calculateRms, updateMeasurements } from '../src/features/audio/analysis.ts'
import { MicrophoneSession } from '../src/features/audio/MicrophoneSession.ts'
import { zeroMeasurements } from '../src/features/audio/types.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

class TestTrack extends EventTarget {
  readyState = 'live'
  muted = false
  stops = 0
  stop() { this.readyState = 'ended'; this.stops++ }
}

function stream() {
  const track = new TestTrack()
  return { track, value: { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream }
}

class TestAnalyser {
  fftSize = 2048
  frequencyBinCount = 1024
  minDecibels = -100
  maxDecibels = -30
  smoothingTimeConstant = 0
  disconnected = false
  throws = false
  getFloatTimeDomainData(samples: Float32Array) {
    if (this.throws) throw new Error('Device lost')
    samples.fill(.5)
  }
  getByteFrequencyData(samples: Uint8Array) { samples.fill(128) }
  disconnect() { this.disconnected = true }
}

class TestContext extends EventTarget {
  static instances: TestContext[] = []
  static resumeFailure = false
  static constructionFailure = false
  static holdClose = false
  state = 'suspended'
  sampleRate = 48000
  analyser = new TestAnalyser()
  connectedTo: unknown = null
  sourceDisconnected = false
  closed = false
  closing = deferred<void>()
  constructor() {
    super()
    if (TestContext.constructionFailure) throw new Error('Context unavailable')
    TestContext.instances.push(this)
  }
  resume() {
    if (TestContext.resumeFailure) return Promise.reject(new Error('Resume failed'))
    this.state = 'running'
    return Promise.resolve()
  }
  close() {
    this.closed = true
    this.state = 'closed'
    this.dispatchEvent(new Event('statechange'))
    return TestContext.holdClose ? this.closing.promise : Promise.resolve()
  }
  createAnalyser() { return this.analyser }
  createMediaStreamSource() {
    return { connect: (node: unknown) => { this.connectedTo = node }, disconnect: () => { this.sourceDisconnected = true } }
  }
}

const originals = new Map<string, PropertyDescriptor | undefined>()
let request: ReturnType<typeof deferred<MediaStream>>
let requests: MediaStreamConstraints[]
let frames: Map<number, FrameRequestCallback>
let nextFrame: number

function setGlobal(name: string, value: unknown) {
  if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}

const flush = () => new Promise<void>(resolve => setImmediate(resolve))

beforeEach(() => {
  request = deferred<MediaStream>()
  requests = []
  frames = new Map()
  nextFrame = 0
  TestContext.instances = []
  TestContext.resumeFailure = false
  TestContext.constructionFailure = false
  TestContext.holdClose = false
  setGlobal('window', { isSecureContext: true, AudioContext: TestContext })
  setGlobal('navigator', { mediaDevices: { getUserMedia: (constraints: MediaStreamConstraints) => { requests.push(constraints); return request.promise } } })
  setGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame })
  setGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
})

afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
  originals.clear()
})

test('RMS: silence, amplitude, sine wave, and clamp', () => {
  assert.equal(calculateRms(new Float32Array()), 0)
  assert.equal(calculateRms(new Float32Array(2048)), 0)
  assert.equal(calculateRms(new Float32Array([.5, -.5])), .5)
  const sine = Float32Array.from({ length: 2048 }, (_, i) => Math.sin(2 * Math.PI * 32 * i / 2048))
  assert.ok(Math.abs(calculateRms(sine) - Math.SQRT1_2) < .00001)
  assert.equal(calculateRms(new Float32Array([2, -2])), 1)
})

test('bands use half-open boundaries, byte normalization, and Nyquist cap', () => {
  const bins = new Uint8Array(1024)
  // At 40960 Hz / 2048, each bin is 20 Hz. 20–250 Hz includes bins 1–12.
  bins.fill(255, 1, 13)
  assert.equal(calculateBandEnergy(bins, 40960, 2048, 20, 250), 1)
  assert.equal(calculateBandEnergy(bins, 40960, 2048, 250, 2000), 0)
  bins.fill(255)
  assert.equal(calculateBandEnergy(bins, 8000, 2048, 2000, 16000), 1)
  assert.equal(calculateBandEnergy(bins, 1000, 2048, 2000, 16000), 0)
})

test('smoothing stays normalized and decays toward true silence', () => {
  const target = zeroMeasurements()
  updateMeasurements(target, new Float32Array([1]), new Uint8Array(1024).fill(255), 48000, 60)
  assert.ok(target.volume > .6 && target.volume < .7)
  const previous = target.volume
  updateMeasurements(target, new Float32Array([0]), new Uint8Array(1024), 48000, 180)
  assert.ok(target.volume > 0 && target.volume < previous)
  assert.ok(Object.values(target).every(value => value >= 0 && value <= 1))
})

test('construction is inert; rapid starts share one request and one context', async () => {
  const audio = new MicrophoneSession()
  assert.equal(requests.length, 0)
  assert.equal(TestContext.instances.length, 0)
  const capture = stream()
  const starting = audio.start()
  await audio.start()
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0], { audio: true, video: false })
  assert.equal(TestContext.instances.length, 1)
  assert.equal(audio.getState().status, 'requesting')
  request.resolve(capture.value)
  await starting
  assert.equal(audio.getState().status, 'listening')
  const context = TestContext.instances[0]!
  assert.equal(context.connectedTo, context.analyser)
  audio.stop()
  await flush()
  assert.equal(capture.track.stops, 1)
  assert.ok(context.closed && context.sourceDisconnected && context.analyser.disconnected)
  assert.equal(frames.size, 0)
  assert.equal(audio.getState().status, 'inactive')
})

test('sampling updates ref each frame, throttles snapshots, and resets immediately on stop', async () => {
  const audio = new MicrophoneSession()
  let notifications = 0
  const unsubscribe = audio.subscribeLevels(() => { notifications++ })
  const starting = audio.start()
  request.resolve(stream().value)
  await starting
  const stableRef = audio.measurementsRef.current
  let now = performance.now()
  for (let i = 0; i < 12; i++) {
    const [id, callback] = [...frames][0]!
    frames.delete(id)
    now += 17
    callback(now)
  }
  assert.equal(audio.measurementsRef.current, stableRef)
  assert.ok(stableRef.volume > .4 && stableRef.volume <= .5)
  assert.ok(notifications > 0 && notifications <= 3)
  assert.ok(audio.getLevels().volume > 0)
  audio.stop()
  assert.deepEqual(audio.getLevels(), zeroMeasurements())
  assert.deepEqual(stableRef, zeroMeasurements())
  assert.equal(frames.size, 0)
  unsubscribe()
  await flush()
})

test('Stop during permission keeps request lock and stops any late stream', async () => {
  const audio = new MicrophoneSession()
  const starting = audio.start()
  audio.stop()
  await flush()
  await audio.start()
  assert.equal(requests.length, 1)
  assert.equal(audio.getState().status, 'inactive')
  assert.equal(audio.getState().permissionPending, true)
  const late = stream()
  request.resolve(late.value)
  await starting
  assert.equal(late.track.stops, 1)
  assert.equal(frames.size, 0)
  assert.equal(audio.getState().permissionPending, false)
  assert.equal(audio.getState().status, 'inactive')
})

test('late permission rejection after cancellation leaves state inactive', async () => {
  const audio = new MicrophoneSession()
  const starting = audio.start()
  audio.stop()
  request.reject(new DOMException('Denied', 'NotAllowedError'))
  await starting
  assert.equal(audio.getState().status, 'inactive')
  assert.equal(audio.getState().error, null)
  await flush()
})

for (const [name, expected] of [['NotAllowedError', /denied/], ['NotFoundError', /No microphone/], ['NotReadableError', /could not be opened/], ['AbortError', /interrupted/]] as const) {
  test(`${name} releases context, shows a friendly error, and allows explicit retry`, async () => {
    const audio = new MicrophoneSession()
    const starting = audio.start()
    request.reject(new DOMException('Test failure', name))
    await starting
    await flush()
    assert.equal(audio.getState().status, 'error')
    assert.match(audio.getState().error!, expected)
    assert.ok(TestContext.instances[0]!.closed)
    assert.equal(requests.length, 1)
    request = deferred<MediaStream>()
    const retry = audio.start()
    request.resolve(stream().value)
    await retry
    assert.equal(audio.getState().status, 'listening')
    audio.stop()
    await flush()
  })
}

test('insecure and unsupported browsers fail without requesting capture', async () => {
  const audio = new MicrophoneSession()
  setGlobal('window', { isSecureContext: false, AudioContext: TestContext })
  await audio.start()
  assert.match(audio.getState().error!, /HTTPS or localhost/)
  setGlobal('window', { isSecureContext: true })
  await audio.start()
  assert.match(audio.getState().error!, /does not support/)
  assert.equal(requests.length, 0)
})

test('context construction failure never captures audio', async () => {
  TestContext.constructionFailure = true
  const audio = new MicrophoneSession()
  await audio.start()
  assert.equal(audio.getState().status, 'error')
  assert.equal(requests.length, 0)
})

test('resume failure cleans up immediately and discards late capture', async () => {
  TestContext.resumeFailure = true
  const audio = new MicrophoneSession()
  const starting = audio.start()
  await starting
  assert.equal(audio.getState().status, 'error')
  assert.ok(TestContext.instances[0]!.closed)
  const late = stream()
  request.resolve(late.value)
  await flush()
  assert.equal(late.track.stops, 1)
  assert.equal(audio.getState().permissionPending, false)
})

for (const event of ['ended', 'mute', 'suspended', 'analysis-error']) {
  test(`${event} ends capture and clears all measurements`, async () => {
    const audio = new MicrophoneSession()
    const capture = stream()
    const starting = audio.start()
    request.resolve(capture.value)
    await starting
    const context = TestContext.instances[0]!
    if (event === 'suspended') {
      context.state = 'suspended'
      context.dispatchEvent(new Event('statechange'))
    } else if (event === 'analysis-error') {
      context.analyser.throws = true
      const [id, callback] = [...frames][0]!
      frames.delete(id)
      callback(performance.now() + 120)
    } else capture.track.dispatchEvent(new Event(event))
    assert.equal(audio.getState().status, 'error')
    assert.equal(capture.track.stops, 1)
    assert.equal(frames.size, 0)
    assert.deepEqual(audio.getLevels(), zeroMeasurements())
    await flush()
  })
}

test('repeated start/stop cycles wait for context close and remove old listeners', async () => {
  const audio = new MicrophoneSession()
  TestContext.holdClose = true
  const first = stream()
  let starting = audio.start()
  request.resolve(first.value)
  await starting
  audio.stop()
  await audio.start()
  assert.equal(TestContext.instances.length, 1)
  assert.equal(audio.getState().releasing, true)
  TestContext.instances[0]!.closing.resolve()
  await flush()
  TestContext.holdClose = false
  request = deferred<MediaStream>()
  starting = audio.start()
  request.resolve(stream().value)
  await starting
  first.track.dispatchEvent(new Event('ended'))
  assert.equal(audio.getState().status, 'listening')
  assert.equal(TestContext.instances.length, 2)
  audio.stop()
  audio.stop() // Effect cleanup is safe even if already stopped.
  await flush()
  assert.equal(frames.size, 0)
})
