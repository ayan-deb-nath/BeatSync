import type { RefObject } from 'react'
import { Icon } from '../../components/Icon'
import type { MicrophoneControls } from '../audio/types'
import type { FullscreenControls } from './fullscreen/useFullscreen'
import { SENSITIVITY } from './settings/preferences'
import type { VisualizerSettings } from './settings/preferences'
import { isThemeId, THEMES } from './settings/themes'
import type { PerformanceRecording } from '../recording/usePerformanceRecording'
import { RecordingAction } from '../recording/RecordingControls'

interface Props {
  audio: MicrophoneControls
  settings: VisualizerSettings
  updateSettings: (settings: VisualizerSettings) => void
  fullscreen: FullscreenControls
  fullscreenButtonRef: RefObject<HTMLButtonElement | null>
  storageUnavailable: boolean
  recording: PerformanceRecording
}

export function VisualizerControls({ audio, settings, updateSettings, fullscreen, fullscreenButtonRef, storageUnavailable, recording }: Props) {
  const canStop = audio.state.status === 'listening' || audio.state.status === 'requesting'
  const startDisabled = canStop || audio.state.permissionPending || audio.state.releasing

  return (
    <div className="control-panel">
      <div className="control-panel-heading">
        <h3>Make it your own</h3>
        <p>Local performance studio</p>
      </div>
      <fieldset className="controls" aria-describedby="audio-privacy">
        <legend className="sr-only">Microphone and visualizer controls</legend>
        <div className="control-item microphone-control">
          <span className="control-label"><Icon name="mic" /> Microphone</span>
          <div className="mic-buttons">
            <button type="button" disabled={startDisabled} onClick={() => void audio.start()}>Start</button>
            <button type="button" disabled={!canStop} onClick={audio.stop}>Stop</button>
          </div>
          <span className="control-detail">{audio.state.status === 'requesting' ? 'Requesting permission' : audio.state.status === 'listening' ? 'Listening' : audio.state.status === 'error' ? 'Microphone error' : 'Inactive'}</span>
        </div>
        <div className="control-item sensitivity-control">
          <div className="sensitivity-heading">
            <label className="control-label" htmlFor="sensitivity"><Icon name="sliders" /> Sensitivity</label>
            <output htmlFor="sensitivity">{settings.sensitivity.toFixed(2)}x</output>
          </div>
          <div className="range-wrap">
            <span aria-hidden="true">−</span>
            <input id="sensitivity" type="range" min={SENSITIVITY.minimum} max={SENSITIVITY.maximum}
              step={SENSITIVITY.step} value={settings.sensitivity} aria-valuetext={`${settings.sensitivity.toFixed(2)} times`}
              onChange={event => updateSettings({ ...settings, sensitivity: event.currentTarget.valueAsNumber })} />
            <span aria-hidden="true">+</span>
          </div>
          <button className="reset-sensitivity" type="button" onClick={() => updateSettings({ ...settings, sensitivity: 1 })}
            disabled={settings.sensitivity === 1}>Reset to 1.00x</button>
        </div>
        <div className="control-item theme-control">
          <label className="control-label" htmlFor="visual-theme"><Icon name="layers" /> Visual theme</label>
          <select id="visual-theme" value={settings.theme} onChange={event => {
            const theme = event.currentTarget.value
            if (isThemeId(theme)) updateSettings({ ...settings, theme })
          }}>
            {Object.entries(THEMES).map(([id, theme]) => <option value={id} key={id}>{theme.name}</option>)}
          </select>
          <span className="theme-options">{THEMES[settings.theme].name} palette active</span>
        </div>
        <div className="control-item">
          <span className="control-label"><Icon name="expand" /> Display</span>
          <button ref={fullscreenButtonRef} type="button" className="utility-button fullscreen-button"
            disabled={!fullscreen.supported || fullscreen.pending} onClick={() => void fullscreen.toggle()}
            aria-describedby={!fullscreen.supported ? 'fullscreen-feedback' : undefined}>
            <Icon name="expand" /> {fullscreen.pending ? 'Please wait…' : fullscreen.active ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
        <div className="control-item">
          <span className="control-label"><Icon name="record" /> Capture</span>
          <RecordingAction recording={recording} />
          <span className="control-detail">{!recording.state.supported ? 'Unavailable in this browser' : recording.state.result ? 'Video ready below' : 'Canvas + microphone · 2 min max'}</span>
        </div>
      </fieldset>
      {(!fullscreen.supported || fullscreen.error) && <p id="fullscreen-feedback" className="fullscreen-feedback" role={fullscreen.error ? 'alert' : undefined}>
        {fullscreen.error ?? 'Fullscreen is unavailable in this browser or embedded page. You can still use the visualizer here.'}
      </p>}
      {storageUnavailable && <p className="control-detail" role="status">Browser storage is unavailable. Your preferences will last for this session.</p>}
      <p id="audio-privacy" className="audio-privacy">Your microphone audio is processed locally. Recording starts only when you press Start Recording. Nothing is uploaded.</p>
    </div>
  )
}
