import { Brand } from './Brand'

export function SiteHeader() {
  return (
    <header className="site-header page-width">
      <Brand />
      <nav aria-label="Main navigation">
        <a href="#visualizer">Visualizer</a>
        <a href="#how-it-works">How It Works</a>
        <a href="#about">About</a>
      </nav>
      <span className="release-badge"><span className="status-dot" /> PUBLIC RELEASE</span>
    </header>
  )
}
