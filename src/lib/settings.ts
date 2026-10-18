export type Foot = 'left' | 'right' | 'both'
export type Side = 'left' | 'right'
export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  foot: Foot
  /** Rest between stretch reps, seconds. */
  stretchRestSec: number
  /** Rest between heel-raise sets, seconds. */
  setRestSec: number
  /** "Get in position" countdown before starting, seconds. */
  prepSec: number
  /** Time to switch feet when doing both sides, seconds. */
  switchSec: number
  beeps: boolean
  voice: boolean
  theme: Theme
}

export const DEFAULT_SETTINGS: Settings = {
  foot: 'right',
  stretchRestSec: 5,
  setRestSec: 120,
  prepSec: 10,
  switchSec: 10,
  beeps: true,
  voice: false,
  theme: 'system',
}

export function sidesFor(foot: Foot): Side[] {
  return foot === 'both' ? ['right', 'left'] : [foot]
}
