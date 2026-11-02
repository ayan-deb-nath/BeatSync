import type { MicrophoneState } from './types'

export function MicrophoneStatus({ state }: { state: MicrophoneState }) {
  const labels = {
    inactive: 'Microphone inactive',
    requesting: 'Requesting microphone permission…',
    listening: 'Microphone listening',
    error: 'Microphone error',
  }

  return (
    <div className={`microphone-status microphone-status-${state.status}`}>
      <div className="stage-caption" role="status" aria-live="polite" aria-atomic="true">
        <span className="status-dot" />
        {labels[state.status]}
        <span className="caption-divider" aria-hidden="true">/</span>
        <span>{state.status === 'listening' ? 'Live audio-reactive visuals' : 'Calm idle stage'}</span>
      </div>
      {state.error && <p className="microphone-error" role="alert">{state.error}</p>}
      {state.permissionPending && (
        <p className="microphone-hint">{state.status === 'requesting'
          ? 'Choose Allow in your browser prompt, or press Stop to cancel this session.'
          : 'Session canceled. Dismiss or answer the browser prompt before starting again. Any late stream will be stopped immediately.'}</p>
      )}
    </div>
  )
}
