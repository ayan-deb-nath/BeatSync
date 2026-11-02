import { Icon } from './Icon'

export function Brand() {
  return (
    <a href="#top" className="brand" aria-label="BeatSync home">
      <span className="brand-mark"><Icon name="wave" /></span>
      <span>Beat<span className="text-accent">Sync</span><span className="brand-dot">.</span></span>
    </a>
  )
}
