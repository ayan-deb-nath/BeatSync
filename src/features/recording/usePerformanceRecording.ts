import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'
import type { MicrophoneAudio } from '../audio/hooks/useMicrophoneAudio'
import { RecordingSession } from './RecordingSession'

export function usePerformanceRecording(canvasRef: RefObject<HTMLCanvasElement | null>, audio: MicrophoneAudio,
  redrawRef: RefObject<(() => void) | null>) {
  const [session] = useState(() => new RecordingSession())
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)
  const { subscribeCaptureEnd } = audio
  useEffect(() => {
    const canvas = canvasRef.current
    session.checkSupport(canvas)
    const contextLost = () => {
      session.stop('Canvas rendering was interrupted. Review the available recording before downloading.')
      session.checkSupport(null)
    }
    canvas?.addEventListener('contextlost', contextLost)
    const unsubscribe = subscribeCaptureEnd(() => session.stop('Microphone listening ended. The available recording has been finalized.'))
    const hidden = () => { if (document.hidden) session.stop('The tab became hidden. Recording finalized to avoid missing Canvas frames.') }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', session.dispose)
    return () => {
      canvas?.removeEventListener('contextlost', contextLost)
      unsubscribe()
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', session.dispose)
      session.dispose()
    }
  }, [session, canvasRef, subscribeCaptureEnd])

  const busy = state.status === 'starting' || state.status === 'recording' || state.status === 'stopping'
  const needsUnloadWarning = busy || !!(state.result && !state.result.downloadRequested)
  useEffect(() => {
    if (!needsUnloadWarning) return
    const warn = (event: BeforeUnloadEvent) => {
      const current = session.getState()
      if (current.status === 'starting' || current.status === 'recording' || current.status === 'stopping'
        || (current.result && !current.result.downloadRequested)) {
        event.preventDefault(); event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [needsUnloadWarning, session])
  const canStart = state.supported && audio.state.status === 'listening' && !busy && !state.result
  const start = () => { if (canStart) session.start(canvasRef.current, audio.cloneRecordingTrack, () => redrawRef.current?.()) }
  const discard = () => {
    if (state.result && !window.confirm('Discard this recording from browser memory? Make sure you have downloaded it if you want to keep it. This cannot be undone.')) return
    session.discard()
  }
  return { state, busy, canStart, start, stop: session.stop, discard, markDownloadRequested: session.markDownloadRequested }
}

export type PerformanceRecording = ReturnType<typeof usePerformanceRecording>
