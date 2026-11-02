import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { SiteHeader } from '../components/SiteHeader'
import { useMicrophoneAudio } from '../features/audio/hooks/useMicrophoneAudio'
import { VisualizerPreview } from '../features/visualizer/VisualizerPreview'

const steps = [
  { number: '01', icon: 'mic', title: 'Allow microphone access', description: 'Press Start and choose Allow in your browser. You control when listening starts and stops.' },
  { number: '02', icon: 'wave', title: 'Start beatboxing', description: 'Drop a kick. Add a snare. Find your flow. Watch the live meters respond to the levels in your sound.' },
  { number: '03', icon: 'spark', title: 'Watch your sound come alive', description: 'Shape neon rings, shockwaves, and particles with the energy in your sound. Your voice sets the stage in motion.' },
] as const

export function App() {
  const audio = useMicrophoneAudio()
  const canStop = audio.state.status === 'listening' || audio.state.status === 'requesting'
  const startBlocked = audio.state.permissionPending || audio.state.releasing

  return (
    <div id="top" className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <section className="hero page-width" aria-labelledby="hero-heading">
          <p className="eyebrow"><span /> SOUND MEETS SPECTRUM</p>
          <h1 id="hero-heading">Your Beat. Your Energy.<br /><span className="gradient-text">Your Visuals.</span></h1>
          <p className="hero-description">Transform your beatboxing into a mesmerizing visual<br className="desktop-break" /> experience with real-time audio-reactive effects.</p>
          <div className="hero-action">
            <button
              type="button"
              className="start-button"
              disabled={!canStop && startBlocked}
              onClick={() => { if (canStop) audio.stop(); else void audio.start() }}
              aria-describedby="hero-audio-note"
            >
              <Icon name="mic" /> {canStop ? 'Stop Beatboxing' : 'Start Beatboxing'} <Icon name="arrow" />
            </button>
            <span id="hero-audio-note" className="coming-soon">{audio.state.status === 'listening' ? 'Your sound is lighting up the stage below' : 'Live audio · Neon rings · Your rhythm'}</span>
          </div>
          <p className="privacy-note"><Icon name="shield" /> Allow your microphone to animate the stage. Audio stays in your browser.</p>
        </section>
        <div className="page-width"><VisualizerPreview audio={audio} /></div>
        <section id="how-it-works" className="experience page-width" aria-labelledby="experience-heading">
          <div className="section-intro"><div><p className="eyebrow">FROM A BEAT TO A FEELING</p><h2 id="experience-heading">A little sound.<br /><span>Infinite possibility.</span></h2></div><p>Your voice. A world of light.<br />Connect your microphone and find your flow.</p></div>
          <ol className="step-grid">
            {steps.map((step) => (
              <li className="step" key={step.number}>
                <div className="step-top"><span className="step-icon"><Icon name={step.icon} /></span><span className="step-number">{step.number}<span aria-hidden="true"> /</span></span></div>
                <h3>{step.title}</h3><p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>
        <section id="about" className="about page-width" aria-labelledby="about-heading">
          <div className="about-symbol" aria-hidden="true"><Icon name="wave" /></div>
          <div><p className="eyebrow">THIS IS BEATSYNC</p><h2 id="about-heading">An outlet for your energy.</h2><p>A playground for beatboxers, music lovers, and curious minds. We’re building a new way to see sound, inspired by the lights of a festival and the freedom of a freestyle.</p></div>
          <span className="about-label">IN DEVELOPMENT <span className="status-dot" /></span>
        </section>
      </main>
      <footer className="site-footer page-width">
        <div className="footer-top"><Brand /><p>Built with React and TypeScript</p><span className="github-placeholder">GitHub <span>Link coming soon ↗</span></span></div>
        <div className="footer-bottom"><p>© 2026 BeatSync. All rights reserved.</p><span>MADE FOR YOUR RHYTHM.</span></div>
      </footer>
    </div>
  )
}
