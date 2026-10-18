import type { Exercise } from '../data/exercises'
import type { Phase } from '../lib/phases'
import type { LiveState } from '../lib/session'
import { blendKeys, mirrorAnimation, sampleClip, type Keyframe, type StretchAnimation } from './pose'

/**
 * Maps the session timer to a pose, so the body is always in step with the phase on screen.
 *  - enter plays in the last seconds BEFORE a hold, so the stretch is reached exactly as the
 *    hold countdown starts; the hold lasts exactly as long as the countdown (with breathing and
 *    a slight deepening); exit plays at the start of the following rest.
 *  - heel raises: up = enter (3 s), top = hold (2 s), down = exit (3 s), exactly.
 *  - self-paced reps and the ice massage loop the exercise's cycle while the set runs.
 *  - paused: elapsed time is frozen, so the pose is too.
 */
export interface Frame {
  key: Keyframe
  side: 'left' | 'right'
  holding: boolean
  breath: number
}

const mirrored = new WeakMap<StretchAnimation, StretchAnimation>()
export function forSide(anim: StretchAnimation, side: 'left' | 'right') {
  if (side === 'right') return anim
  let m = mirrored.get(anim)
  if (!m) {
    m = mirrorAnimation(anim)
    mirrored.set(anim, m)
  }
  return m
}

const ENTER = (a: StretchAnimation) => a.enter.duration ?? 1.5
const EXIT = (a: StretchAnimation) => a.exit.duration ?? 1.5
const restKey = (a: StretchAnimation) => a.keys[a.rest ?? a.enter.keys[0][0]]
const startKey = (a: StretchAnimation) => a.keys[a.enter.keys[0][0]]
const endKey = (a: StretchAnimation) => a.keys[a.exit.keys[a.exit.keys.length - 1][0]]

function breathing(a: StretchAnimation, t: number, holdT: number, dur: number) {
  // fade in/out over the first/last second of the hold
  const env = Math.min(1, holdT, Math.max(0, dur - holdT))
  return (a.breathe ?? 0) * env * Math.sin((2 * Math.PI * t) / 4.5)
}

function cycleFrame(a: StretchAnimation, t: number, side: 'left' | 'right'): Frame {
  const c = a.cycle!
  const rep = Math.floor(t / c.seconds)
  const s = c.alternate && rep % 2 === 1 ? (side === 'right' ? 'left' : 'right') : side
  const anim = forSide(a, s)
  return { key: sampleClip(anim, c.keys, (t % c.seconds) / c.seconds), side: s, holding: true, breath: 0 }
}

/** Demo loop before the session starts. */
function idleFrame(base: StretchAnimation, side: 'left' | 'right', clock: number): Frame {
  if (base.cycle) return cycleFrame(base, clock, side)
  const a = forSide(base, side)
  const e = ENTER(a)
  const h = 3
  const x = EXIT(a)
  const t = clock % (e + h + x + 1.2)
  if (t < e) return { key: sampleClip(a, a.enter.keys, t / e), side, holding: false, breath: 0 }
  if (t < e + h) return { key: sampleClip(a, a.hold.keys, (t - e) / h), side, holding: true, breath: breathing(a, t, t - e, h) }
  if (t < e + h + x) return { key: sampleClip(a, a.exit.keys, (t - e - h) / x), side, holding: false, breath: 0 }
  return { key: endKey(a), side, holding: false, breath: 0 }
}

export function frameAt(ex: Exercise, base: StretchAnimation, live: LiveState, phases: Phase[], defaultSide: 'left' | 'right', clock: number): Frame {
  if (live.status === 'idle' || !phases.length) return idleFrame(base, defaultSide, clock)
  const p = phases[live.index]
  const side = p.side
  const a = forSide(base, side)
  if (live.status === 'done') return { key: endKey(a), side, holding: false, breath: 0 }
  const e = live.elapsed
  const rem = Math.max(0, p.duration - e)

  if (ex.kind === 'heel-raise') {
    if (p.kind === 'up') return { key: sampleClip(a, a.enter.keys, e / p.duration), side, holding: false, breath: 0 }
    if (p.kind === 'top') return { key: sampleClip(a, a.hold.keys, e / p.duration), side, holding: true, breath: 0 }
    if (p.kind === 'down') return { key: sampleClip(a, a.exit.keys, e / p.duration), side, holding: false, breath: 0 }
    // between sets: free foot down on the step, back to the start position just before the next set
    const prev = phases[live.index - 1]
    const next = phases[live.index + 1]
    let key = restKey(a)
    if (prev?.kind === 'down' && e < 1) key = blendKeys(endKey(a), restKey(a), ease(e / 1))
    else if (next?.kind === 'up' && rem < 1) key = blendKeys(restKey(a), startKey(forSide(base, next.side)), ease(1 - rem / 1))
    return { key, side, holding: false, breath: 0 }
  }

  if (ex.kind === 'reps' || ex.kind === 'continuous') {
    if ((p.kind === 'reps' || p.kind === 'massage') && base.cycle) return cycleFrame(base, e, side)
    return { key: restKey(a), side, holding: false, breath: 0 }
  }

  // stretches and timed holds
  if (p.kind === 'hold') {
    const u = p.duration ? e / p.duration : 1
    return { key: sampleClip(a, a.hold.keys, u), side, holding: true, breath: breathing(a, e, e, p.duration) }
  }
  const prev = phases[live.index - 1]
  const next = phases[live.index + 1]
  let enterD = next?.kind === 'hold' ? ENTER(a) : 0
  let exitD = prev?.kind === 'hold' ? EXIT(a) : 0
  if (enterD + exitD > p.duration) {
    // short rest: squeeze both into the time available
    const k = p.duration / (enterD + exitD)
    enterD *= k
    exitD *= k
  }
  if (exitD && e < exitD) {
    const pa = forSide(base, prev!.side)
    return { key: sampleClip(pa, pa.exit.keys, e / exitD), side: prev!.side, holding: false, breath: 0 }
  }
  if (enterD && rem < enterD) {
    const na = forSide(base, next!.side)
    return { key: sampleClip(na, na.enter.keys, 1 - rem / enterD), side: next!.side, holding: false, breath: 0 }
  }
  const s = next?.kind === 'hold' && !exitD ? next.side : prev?.side ?? side
  return { key: restKey(forSide(base, s)), side: s, holding: false, breath: 0 }
}

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)))
