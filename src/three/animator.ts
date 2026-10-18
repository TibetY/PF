import type { Exercise } from '../data/exercises'
import type { Phase } from '../lib/phases'
import type { LiveState } from '../lib/useRunner'
import type { AnimFrame } from './Scene'
import { ICE_PERIOD } from './poses'

const easeInOut = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, p)))
const approach = (cur: number, target: number, dt: number, rate: number) =>
  cur + (target - cur) * (1 - Math.exp(-dt * rate))

/**
 * Turns the timer state into pose parameters, so the figure is always in sync with the
 * phase on screen. When the timer is idle it plays a short demo loop of the movement.
 */
export function createAnimator(ex: Exercise) {
  let s = 0
  let down = 1
  let iceT = 0
  let clock = 0

  return function frame(dt: number, live: LiveState, phases: Phase[]): AnimFrame {
    clock += dt
    // dev-only hook used for screenshot checks of exact poses
    const override = import.meta.env.DEV ? (window as unknown as { __pose?: AnimFrame }).__pose : undefined
    if (override) return override
    const paused = live.status === 'paused'
    if (paused) dt = 0

    if (ex.kind === 'continuous') {
      const p = phases[live.index]
      if (live.status === 'idle') iceT += dt
      else if (live.status === 'running' && p.kind === 'massage') iceT = live.elapsed
      // outside the massage phase the foot comes to rest in the middle of the roll
      const rolling = live.status === 'idle' || (p.kind === 'massage' && live.status !== 'done')
      if (!rolling) iceT = approachPhase(iceT, dt)
      const glow = rolling ? 0.65 + 0.25 * Math.sin(clock * 3) : 0.35
      return { s: 0, t: iceT, down: 0, glow }
    }

    if (ex.kind === 'heel-raise') {
      const t = ex.tempo!
      let target: number | null = null
      let downTarget = 1
      if (live.status === 'idle') {
        // demo: 3 s up, 2 s hold, 3 s down, 1.5 s pause
        const c = clock % (t.up + t.top + t.down + 1.5)
        downTarget = 0
        if (c < t.up) s = easeInOut(c / t.up)
        else if (c < t.up + t.top) s = 1
        else if (c < t.up + t.top + t.down) s = 1 - easeInOut((c - t.up - t.top) / t.down)
        else target = 0
      } else {
        const p = phases[live.index]
        const prog = live.elapsed / p.duration
        if (live.status === 'done') target = 0
        else if (p.kind === 'up') { s = easeInOut(prog); downTarget = 0 }
        else if (p.kind === 'top') { s = 1; downTarget = 0 }
        else if (p.kind === 'down') { s = 1 - easeInOut(prog); downTarget = 0 }
        else target = 0
      }
      if (target !== null) s = approach(s, target, dt, 4)
      down = approach(down, downTarget, dt, 3)
      return { s, t: 0, down, glow: 0.25 + 0.75 * s }
    }

    // stretches: ease into the stretch at the start of each hold, ease out at each rest
    let target = 0
    if (live.status === 'idle') {
      const c = clock % 7
      target = c > 0.5 && c < 4.5 ? 1 : 0
    } else if (live.status !== 'done') {
      target = phases[live.index].kind === 'hold' ? 1 : 0
    }
    s = approach(s, target, dt, 3.5)
    const pulse = target === 1 ? 0.08 * Math.sin(clock * 4) : 0
    return { s, t: 0, down: 0, glow: Math.min(1, 0.2 + 0.8 * s + pulse) }
  }
}

/** Glide the ice-roll phase back to the centre position. */
function approachPhase(t: number, dt: number) {
  // the roll is sinusoidal, so t = 0 (mod period) is the centre; ease towards the nearest one
  const period = ICE_PERIOD
  const k = Math.round(t / period) * period
  return approach(t, k, dt, 3)
}
