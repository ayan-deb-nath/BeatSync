export const VISUALIZER_CONFIG = {
  maxDpr: 2,
  maxFps: 60,
  mobileBreakpoint: 600,
  particles: { desktop: 108, mobile: 56, burst: 16, sparks: 7, lifetime: 1.15, sparkLifetime: 0.38 },
  waves: { maximum: 6, lifetime: 1.1 },
  onset: {
    warmup: 0.35,
    baselineSeconds: 0.8,
    low: { minimum: 0.13, margin: 0.065, slope: 0.18, cooldown: 0.32 },
    mid: { minimum: 0.10, margin: 0.055, slope: 0.18, cooldown: 0.24 },
    high: { minimum: 0.08, margin: 0.045, slope: 0.18, cooldown: 0.14 },
  },
  core: { gain: 5, expansion: 0.16, attack: 0.09, release: 0.24 },
} as const
