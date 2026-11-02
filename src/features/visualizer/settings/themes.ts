export type ThemeId = 'neon-festival' | 'cyberpunk' | 'galaxy'

export interface VisualTheme {
  name: string
  primary: string
  secondary: string
  accent: string
  wave: string
  burst: string
  spark: string
  sparkAccent: string
  glow: string
  guide: string
  core: string
  symbol: string
  background: readonly [string, string, string]
  motif: 'rings' | 'angular' | 'stars'
  bloom: number
  ambience: number
}

export const THEMES: Record<ThemeId, VisualTheme> = {
  'neon-festival': {
    name: 'Neon Festival', primary: '#00e5ff', secondary: '#a17bff', accent: '#ff70cb',
    wave: '#3deaff', burst: '#ac7cff', spark: '#91f5ff', sparkAccent: '#ff8fda',
    glow: '#8168ff', guide: '#a895e5', core: '#17172a', symbol: '#a7ecff',
    background: ['#201438', '#101024', '#0a0a14'], motif: 'rings', bloom: 1, ambience: 1,
  },
  cyberpunk: {
    name: 'Cyberpunk', primary: '#ff3cac', secondary: '#ff3855', accent: '#ff9b43',
    wave: '#ff4779', burst: '#ff9b43', spark: '#ff555f', sparkAccent: '#ffb65e',
    glow: '#ff3868', guide: '#f48b9b', core: '#24131e', symbol: '#ffd6e7',
    background: ['#331323', '#1b1018', '#0e0c10'], motif: 'angular', bloom: 1.15, ambience: 0.8,
  },
  galaxy: {
    name: 'Galaxy', primary: '#80b9ff', secondary: '#a293ed', accent: '#d5c5ff',
    wave: '#a1caff', burst: '#d0c0ff', spark: '#c0e8ff', sparkAccent: '#b7a3ff',
    glow: '#7864cd', guide: '#a6a1de', core: '#17152c', symbol: '#dceaff',
    background: ['#211b3c', '#101225', '#090b16'], motif: 'stars', bloom: 1.3, ambience: 0.6,
  },
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && Object.hasOwn(THEMES, value)
}
