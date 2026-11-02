import { useEffect, useState, useSyncExternalStore } from 'react'
import { MicrophoneSession } from '../MicrophoneSession'

export function useMicrophoneAudio() {
  const [session] = useState(() => new MicrophoneSession())
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)

  useEffect(() => {
    window.addEventListener('pagehide', session.stop)
    return () => {
      window.removeEventListener('pagehide', session.stop)
      session.stop()
    }
  }, [session])

  return {
    state,
    start: session.start,
    stop: session.stop,
    measurementsRef: session.measurementsRef,
    subscribeLevels: session.subscribeLevels,
    getLevels: session.getLevels,
    cloneRecordingTrack: session.cloneRecordingTrack,
    subscribeCaptureEnd: session.subscribeCaptureEnd,
  }
}

export type MicrophoneAudio = ReturnType<typeof useMicrophoneAudio>
