export type MicrophoneStatus = 'inactive' | 'requesting' | 'listening' | 'error'

/** All values are relative, normalized to [0, 1]; not calibrated sound levels. */
export interface AudioMeasurements {
  volume: number
  low: number
  mid: number
  high: number
}

export interface MicrophoneState {
  status: MicrophoneStatus
  error: string | null
  permissionPending: boolean
  releasing: boolean
}

export const zeroMeasurements = (): AudioMeasurements => ({ volume: 0, low: 0, mid: 0, high: 0 })

export interface MicrophoneControls {
  state: MicrophoneState
  start: () => Promise<void>
  stop: () => void
}
