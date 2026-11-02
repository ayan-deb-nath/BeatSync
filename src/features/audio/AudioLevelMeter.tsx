import { useSyncExternalStore } from 'react'
import type { MicrophoneAudio } from './hooks/useMicrophoneAudio'

const meters = [
  { key: 'volume', label: 'Overall volume', band: 'RMS amplitude' },
  { key: 'low', label: 'Low-frequency energy', band: '20–250 Hz' },
  { key: 'mid', label: 'Mid-frequency energy', band: '250 Hz–2 kHz' },
  { key: 'high', label: 'High-frequency energy', band: '2–16 kHz' },
] as const

/** Only this subtree subscribes to the throttled (10 Hz) measurement snapshots. */
export function AudioLevelMeter({ audio }: { audio: Pick<MicrophoneAudio, 'subscribeLevels' | 'getLevels'> }) {
  const levels = useSyncExternalStore(audio.subscribeLevels, audio.getLevels, audio.getLevels)

  return (
    <section className="audio-levels" aria-labelledby="audio-levels-heading">
      <div className="audio-levels-heading">
        <h3 id="audio-levels-heading">Live audio levels</h3>
        <p>Relative levels · Not sound classification</p>
      </div>
      <div className="audio-meter-grid">
        {meters.map(({ key, label, band }) => (
          <div className={`audio-meter audio-meter-${key}`} key={key}>
            <div className="audio-meter-label"><span id={`level-${key}`}>{label}</span><span aria-hidden="true">{Math.round(levels[key] * 100)}%</span></div>
            <meter min={0} max={1} value={levels[key]} aria-labelledby={`level-${key}`} aria-valuetext={`${Math.round(levels[key] * 100)} percent`}>{Math.round(levels[key] * 100)}%</meter>
            <span className="audio-meter-band">{band}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
