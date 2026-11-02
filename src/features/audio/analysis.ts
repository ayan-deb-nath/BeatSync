import type { AudioMeasurements } from './types.ts'

export const FFT_SIZE = 2048
export const UI_INTERVAL_MS = 100

/** Half-open bands in Hz, capped at the context's Nyquist frequency. */
export const FREQUENCY_BANDS = {
  low: [20, 250],
  mid: [250, 2000],
  high: [2000, 16000],
} as const

const BAND_NAMES = ['low', 'mid', 'high'] as const

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return clampUnit(Math.sqrt(sum / samples.length))
}

/** Mean byte magnitude / 255. Bytes map the analyser's [-100, -30] dB range. */
export function calculateBandEnergy(
  bins: Uint8Array,
  sampleRate: number,
  fftSize: number,
  lowerHz: number,
  upperHz: number,
): number {
  const binHz = sampleRate / fftSize
  const first = Math.max(0, Math.ceil(lowerHz / binHz))
  const end = Math.min(bins.length, Math.ceil(upperHz / binHz))
  if (end <= first) return 0
  let sum = 0
  for (let index = first; index < end; index++) sum += bins[index] ?? 0
  return clampUnit(sum / ((end - first) * 255))
}

/** Time-based attack/release smoothing, independent of display refresh rate. */
function smooth(previous: number, next: number, elapsedMs: number): number {
  const timeConstant = next > previous ? 60 : 180
  return previous + (next - previous) * (1 - Math.exp(-elapsedMs / timeConstant))
}

export function updateMeasurements(
  target: AudioMeasurements,
  waveform: Float32Array,
  spectrum: Uint8Array,
  sampleRate: number,
  elapsedMs: number,
): void {
  target.volume = smooth(target.volume, calculateRms(waveform), elapsedMs)
  for (const band of BAND_NAMES) {
    const [lower, upper] = FREQUENCY_BANDS[band]
    target[band] = smooth(target[band], calculateBandEnergy(spectrum, sampleRate, FFT_SIZE, lower, upper), elapsedMs)
  }
}
