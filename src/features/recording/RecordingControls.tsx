import { useEffect, useState } from 'react'
import type { PerformanceRecording } from './usePerformanceRecording'
import { formatDuration } from './formats'
import './recording.css'

export function RecordingAction({ recording, compact = false }: { recording: PerformanceRecording; compact?: boolean }) {
  const { state } = recording
  const active = state.status === 'recording' || state.status === 'starting'
  const stopping = state.status === 'stopping'
  return (
    <button type="button" className={`utility-button record-action${active ? ' is-recording' : ''}`}
      title={!state.supported ? state.supportReason : !active && !recording.canStart && !state.result ? 'Start microphone listening before recording.' : undefined}
      disabled={stopping || (!active && !recording.canStart)}
      onClick={() => { if (active) recording.stop(); else recording.start() }}>
      <span className="record-dot" aria-hidden="true" />
      {stopping ? 'Finalizing…' : active ? 'Stop Recording' : 'Start Recording'}
      {(active || stopping) && <span className="recording-time" aria-label="Elapsed recording time">{formatDuration(state.elapsedMs)}</span>}
      {compact && state.result && <span className="sr-only">Download available after exiting fullscreen</span>}
    </button>
  )
}

export function RecordingPanel({ recording, listening }: { recording: PerformanceRecording; listening: boolean }) {
  const { state } = recording
  const [previewFailed, setPreviewFailed] = useState(false)
  useEffect(() => setPreviewFailed(false), [state.result?.url])
  const label = state.status === 'recording' ? 'Recording video + microphone audio'
    : state.status === 'starting' ? 'Starting recording'
    : state.status === 'stopping' ? 'Finalizing recording'
    : state.result ? 'Recording ready'
    : state.status === 'error' ? 'Recording error'
    : 'Record your performance'

  return (
    <section className="recording-panel" aria-labelledby="recording-heading">
      <div className="recording-heading">
        <h3 id="recording-heading" role="status" aria-live="polite"><span className={`record-dot${recording.busy ? ' recording-active' : ''}`} />{label}</h3>
        <span className="recording-time">{formatDuration(state.elapsedMs)} <span className="recording-limit">/ 02:00 max</span></span>
      </div>
      {!state.supported && <p className="recording-message">{state.supportReason}</p>}
      {state.supported && !recording.busy && !state.result && <p className="recording-message">{listening
        ? 'Press Start Recording in Capture to save this Canvas and your microphone audio.'
        : 'Start microphone listening first, then choose Start Recording. Recording never starts automatically.'}</p>}
      {state.message && <p className="recording-message" role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
      {state.result && (
        <div className="completed-recording">
          <div className="recording-details"><span>{formatDuration(state.result.durationMs)}</span><span>{(state.result.blob.size / (1024 * 1024)).toFixed(2)} MiB</span><span>{state.result.mime.split(';')[0]}</span></div>
          <video controls playsInline preload="metadata" src={state.result.url} aria-label="Completed recording preview with recorded microphone audio"
            onError={() => setPreviewFailed(true)} />
          {previewFailed && <p className="recording-message" role="status">This browser could not preview the video. You can still download it and try a compatible video player.</p>}
          <p className="recording-message">Preview playback is user-controlled. Use headphones or stop listening before playing it.</p>
          <div className="recording-download-actions">
            <a className="download-recording" href={state.result.url} download={state.result.filename} onClick={recording.markDownloadRequested}>Download Video</a>
            <button type="button" onClick={recording.discard}>Discard Recording</button>
          </div>
          <p className="recording-message">Kept only in temporary browser memory. Download this take if you want to keep it, then discard it to record another.</p>
        </div>
      )}
      <p className="recording-privacy">Your performance is recorded locally in your browser. Nothing is uploaded. You choose whether to download it.</p>
    </section>
  )
}
