import type { Exercise, ExerciseId } from '../data/exercises'
import type { Phase } from '../lib/phases'
import type { LiveState } from '../lib/session'
import type { AnimFrame } from './Scene'
import { ICE_PERIOD } from './poses'

const easeInOut = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, p)))
const approach = (cur: number, target: number, dt: number, rate: number) =>
  cur + (target - cur) * (1 - Math.exp(-dt * rate))

/** Demo pace for self-paced exercises: seconds for in, hold, out, pause. (Shows the movement, not a prescription.) */
const REP_CYCLES: Partial<Record<ExerciseId, [number, number, number, number]>> = {
  'posterior-lunge': [1.6, 0.4, 1.6, 0.6],
  'inversion-band': [1.1, 0.6, 1.1, 0.4],
  'intrinsic-foot': [1.3, 1.2, 1.1, 0.6],
}

function cycleValue(c: number, [a, h, b, r]: [number, number, number, number]) {
  const t = c % (a + h + b + r)
  if (t < a) return easeInOut(t / a)
  if (t < a + h) return 1
  if (t < a + h + b) return 1 - easeInOut((t - a - h) / b)
  return 0
}

/**
 * Turns the timer state into pose parameters, so the figure is always in sync with the
 * phase on screen. When the timer is idle it plays a short demo loop of the movement.
 */
export function createAnimator(ex: Exercise) {
  let s = 0
  let down = 1
  let iceT = 0
  let clock = 0
  let repClock = 0

  return function frame(dt: number, live: LiveState, phases: Phase[]): AnimFrame {
    // dev-only hook used for screenshot checks of exact poses
    const override = import.meta.env.DEV ? (window as unknown as { __pose?: AnimFrame }).__pose : undefined
    if (override) return override
    const paused = live.status === 'paused'
    if (paused) dt = 0
    clock += dt

    if (ex.kind === 'continuous') {
      const p = phases[live.index]
      if (live.status === 'idle') iceT += dt
      else if (live.status === 'running' && p.kind === 'massage') iceT = live.elapsed
      // outside the massage phase the foot comes to rest in the middle of the roll
      const rolling = live.status === 'idle' || (p.kind === 'massage' && live.status !== 'done')
      if (!rolling) iceT = approach(iceT, Math.round(iceT / ICE_PERIOD) * ICE_PERIOD, dt, 3)
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

    if (ex.kind === 'reps') {
      const cyc = REP_CYCLES[ex.id] ?? [1.2, 0.6, 1.2, 0.5]
      const len = cyc.reduce((a, b) => a + b, 0)
      const moving = live.status === 'idle' || (live.status !== 'done' && phases[live.index]?.kind === 'reps')
      if (moving) {
        repClock += dt
        s = cycleValue(repClock, cyc)
      } else {
        // finish the current rep smoothly, then stay relaxed
        repClock = Math.ceil(repClock / len) * len
        s = approach(s, 0, dt, 4)
      }
      const alt = Math.floor(repClock / len) % 2
      return { s, t: clock, down: 0, alt, glow: 0.25 + 0.75 * s }
    }

    // stretches and timed holds: ease in at the start of each hold, ease out at each rest
    let target = 0
    if (live.status === 'idle') {
      const c = clock % 7
      target = c > 0.5 && c < 4.5 ? 1 : 0
    } else if (live.status !== 'done') {
      target = phases[live.index].kind === 'hold' ? 1 : 0
    }
    s = approach(s, target, dt, ex.kind === 'hold' ? 2.5 : 3.5)
    const pulse = target === 1 ? 0.08 * Math.sin(clock * 4) : 0
    return { s, t: clock, down: 0, glow: Math.min(1, 0.2 + 0.8 * s + pulse) }
  }
}
