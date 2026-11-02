import { Icon } from '../../components/Icon'
import type { MicrophoneControls } from '../audio/types'

export function VisualizerControls({ audio }: { audio: MicrophoneControls }) {
  const canStop = audio.state.status === 'listening' || audio.state.status === 'requesting'
  const startDisabled = canStop || audio.state.permissionPending || audio.state.releasing

  return (
    <div className="control-panel">
      <div className="control-panel-heading"><h3>Make it your own</h3><p id="controls-coming-soon">Sensitivity, themes, display & capture coming soon</p></div>
      <fieldset className="controls" aria-describedby="controls-coming-soon audio-privacy">
        <legend className="sr-only">Microphone and planned visualizer controls</legend>
        <div className="control-item microphone-control">
          <span className="control-label"><Icon name="mic" /> Microphone</span>
          <div className="mic-buttons">
            <button type="button" disabled={startDisabled} onClick={() => void audio.start()}>Start</button>
            <button type="button" disabled={!canStop} onClick={audio.stop}>Stop</button>
          </div>
        </div>
        <div className="control-item sensitivity-control"><label className="control-label" htmlFor="sensitivity"><Icon name="sliders" /> Sensitivity</label><div className="range-wrap"><span aria-hidden="true">−</span><input id="sensitivity" type="range" min="0" max="100" defaultValue="50" disabled /><span aria-hidden="true">+</span></div></div>
        <div className="control-item theme-control"><label className="control-label" htmlFor="visual-theme"><Icon name="layers" /> Visual theme</label><select id="visual-theme" defaultValue="neon-festival" disabled><option value="neon-festival">Neon Festival</option><option value="cyberpunk">Cyberpunk</option><option value="galaxy">Galaxy</option></select><span className="theme-options">Next: Cyberpunk · Galaxy</span></div>
        <div className="control-item"><span className="control-label"><Icon name="expand" /> Display</span><button type="button" className="utility-button" disabled><Icon name="expand" /> Fullscreen</button></div>
        <div className="control-item"><span className="control-label"><Icon name="record" /> Capture</span><button type="button" className="utility-button" disabled><span className="record-dot" /> Record</button></div>
      </fieldset>
      <p id="audio-privacy" className="audio-privacy">Your microphone audio is processed locally in your browser. Nothing is uploaded or recorded.</p>
    </div>
  )
}
