import { AudioReactiveCanvas } from './AudioReactiveCanvas'
import './visualizer.css'
import { VisualizerControls } from './VisualizerControls'
import { AudioLevelMeter } from '../audio/AudioLevelMeter'
import { MicrophoneStatus } from '../audio/MicrophoneStatus'
import type { MicrophoneAudio } from '../audio/hooks/useMicrophoneAudio'

export function VisualizerPreview({ audio }: { audio: MicrophoneAudio }) {
  return (
    <section id="visualizer" className="visualizer" aria-labelledby="preview-heading">
      <div className="preview-toolbar">
        <div className="preview-title"><span className="preview-mark" aria-hidden="true" /><div><h2 id="preview-heading">Audio Visualizer</h2><p>Live reactions when listening · Calm when inactive</p></div></div>
        <span className="preview-mode"><span className="status-dot" /> NEON FESTIVAL</span>
      </div>
      <div className="visualizer-stage">
        <div className="stage-heading"><span className="stage-kicker">THE STAGE IS YOURS</span><p>Find your frequency.</p></div>
        <AudioReactiveCanvas measurementsRef={audio.measurementsRef} listening={audio.state.status === 'listening'} />
        <MicrophoneStatus state={audio.state} />
      </div>
      <VisualizerControls audio={audio} />
      <AudioLevelMeter audio={audio} />
      <div className="preview-footnote"><span className="status-dot" /><p>Powered by your sound. Frequency-driven effects, not sound classification.</p></div>
    </section>
  )
}
