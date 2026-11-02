import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Brand } from '../../components/Brand'
import { Icon } from '../../components/Icon'
import { AudioReactiveCanvas } from './AudioReactiveCanvas'
import './visualizer.css'
import { VisualizerControls } from './VisualizerControls'
import { AudioLevelMeter } from '../audio/AudioLevelMeter'
import { MicrophoneStatus } from '../audio/MicrophoneStatus'
import type { MicrophoneAudio } from '../audio/hooks/useMicrophoneAudio'
import { useFullscreen } from './fullscreen/useFullscreen'
import { useVisualizerSettings } from './settings/useVisualizerSettings'
import { THEMES } from './settings/themes'

export function VisualizerPreview({ audio }: { audio: MicrophoneAudio }) {
  const stageRef = useRef<HTMLElement>(null)
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null)
  const exitButtonRef = useRef<HTMLButtonElement>(null)
  const wasFullscreen = useRef(false)
  const fullscreen = useFullscreen(stageRef)
  const { settings, updateSettings, storageUnavailable } = useVisualizerSettings()
  const theme = THEMES[settings.theme]
  const canStop = audio.state.status === 'listening' || audio.state.status === 'requesting'

  useEffect(() => {
    if (fullscreen.active) exitButtonRef.current?.focus({ preventScroll: true })
    else if (wasFullscreen.current) fullscreenButtonRef.current?.focus({ preventScroll: true })
    wasFullscreen.current = fullscreen.active
  }, [fullscreen.active])

  const style = {
    '--color-accent': theme.primary,
    '--color-violet': theme.secondary,
    '--color-pink': theme.accent,
    '--stage-accent': theme.primary,
    '--stage-secondary': theme.secondary,
    '--stage-soft': `${theme.primary}16`,
    '--stage-line': `${theme.secondary}40`,
    '--stage-background': theme.background[2],
  } as CSSProperties

  return (
    <section ref={stageRef} id="visualizer" className="visualizer" data-theme={settings.theme} style={style} aria-labelledby="preview-heading">
      <div className="performance-overlay">
        <div className="performance-brand"><Brand /><span>{theme.name} · {settings.sensitivity.toFixed(2)}x</span></div>
        <span className="performance-status"><span className="status-dot" />{audio.state.status === 'requesting' ? 'Requesting permission' : audio.state.status === 'listening' ? 'Listening' : audio.state.status === 'error' ? 'Microphone error' : 'Microphone inactive'}</span>
        <div className="performance-actions">
          <button type="button" disabled={!canStop && (audio.state.permissionPending || audio.state.releasing)}
            onClick={() => { if (canStop) audio.stop(); else void audio.start() }}>
            <Icon name="mic" />{canStop ? 'Stop Beatboxing' : 'Start Beatboxing'}
          </button>
          <button ref={exitButtonRef} type="button" className="exit-fullscreen" disabled={fullscreen.pending} onClick={() => void fullscreen.toggle()}>
            <Icon name="expand" />Exit Fullscreen
          </button>
        </div>
      </div>
      {fullscreen.active && fullscreen.error && <p className="performance-error" role="alert">{fullscreen.error}</p>}
      <div className="preview-toolbar">
        <div className="preview-title"><span className="preview-mark" aria-hidden="true" /><div><h2 id="preview-heading">Audio Visualizer</h2><p>Live reactions when listening · Calm when inactive</p></div></div>
        <span className="preview-mode"><span className="status-dot" /> {theme.name.toUpperCase()}</span>
      </div>
      <div className="visualizer-stage">
        <div className="stage-heading"><span className="stage-kicker">THE STAGE IS YOURS</span><p>Find your frequency.</p></div>
        <AudioReactiveCanvas measurementsRef={audio.measurementsRef} listening={audio.state.status === 'listening'} settings={settings} />
        <MicrophoneStatus state={audio.state} />
      </div>
      <VisualizerControls audio={audio} settings={settings} updateSettings={updateSettings} fullscreen={fullscreen}
        fullscreenButtonRef={fullscreenButtonRef} storageUnavailable={storageUnavailable} />
      <AudioLevelMeter audio={audio} />
      <div className="preview-footnote"><span className="status-dot" /><p>Powered by your sound. Frequency-driven effects, not sound classification.</p></div>
    </section>
  )
}
