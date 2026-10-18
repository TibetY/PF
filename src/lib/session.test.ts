import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// cues are spied on so we can check they read the settings live
vi.mock('./audio', () => ({
  beeps: { work: vi.fn(), rest: vi.fn(), tick: vi.fn(), done: vi.fn() },
  speak: vi.fn(),
}))

import { beeps, speak } from './audio'
import { EXERCISE_BY_ID } from '../data/exercises'
import { buildPhases } from './phases'
import { getSettings, updateSettings } from './settingsStore'
import * as session from './session'

const ex = EXERCISE_BY_ID['calf-straight'] // prep, 3 × 30 s holds, 5 s rests

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date', 'performance'] })
  localStorage.clear()
  updateSettings({ beeps: true, voice: false, prepSec: 3, stretchRestSec: 5, foot: 'right', theme: 'system', footCam: true })
  vi.clearAllMocks()
})
afterEach(() => {
  session.end()
  vi.useRealTimers()
})

describe('session engine', () => {
  it('keeps running, untouched, when any setting changes mid-stretch', () => {
    session.start(ex.id, buildPhases(ex, getSettings()))
    vi.advanceTimersByTime(13_000) // 3 s prep + 10 s into the first hold
    const before = session.live()
    expect(before.status).toBe('running')
    expect(session.getEngine().phases[before.index].kind).toBe('hold')
    expect(before.elapsed).toBeCloseTo(10, 0)

    for (const patch of [
      { beeps: false }, { voice: true }, { footCam: false }, { theme: 'dark' as const },
      { foot: 'both' as const }, { stretchRestSec: 9 }, { setRestSec: 90 }, { prepSec: 20 },
    ]) {
      updateSettings(patch)
      const now = session.live()
      expect(now.status).toBe('running')
      expect(now.index).toBe(before.index)
    }
    // phases were snapshotted at start, so the new rest/foot settings don't reshape this session
    expect(session.getEngine().phases).toHaveLength(buildPhases(ex, { ...getSettings(), stretchRestSec: 5, foot: 'right', prepSec: 3 }).length)

    vi.advanceTimersByTime(5_000)
    const after = session.live()
    expect(after.index).toBe(before.index)
    expect(after.elapsed).toBeCloseTo(15, 0) // the timer kept going
  })

  it('reads beep and voice settings at the moment a cue fires', () => {
    session.start(ex.id, buildPhases(ex, getSettings()))
    expect(beeps.rest).toHaveBeenCalledTimes(1) // prep cue, beeps on
    expect(speak).not.toHaveBeenCalled()

    updateSettings({ beeps: false, voice: true })
    vi.advanceTimersByTime(3_100) // prep ends -> hold starts
    expect(beeps.work).not.toHaveBeenCalled()
    expect(speak).toHaveBeenCalledWith('Rep 1. Hold.')

    updateSettings({ beeps: true, voice: false })
    vi.advanceTimersByTime(30_000) // hold ends -> rest starts
    expect(beeps.rest).toHaveBeenCalledTimes(2)
    expect(speak).toHaveBeenCalledTimes(1)
  })

  it('pauses and resumes without losing time', () => {
    session.start(ex.id, buildPhases(ex, getSettings()))
    vi.advanceTimersByTime(8_000)
    session.pause()
    const paused = session.live()
    vi.advanceTimersByTime(60_000)
    expect(session.live().elapsed).toBe(paused.elapsed)
    session.resume()
    vi.advanceTimersByTime(2_000)
    expect(session.live().elapsed).toBeCloseTo(paused.elapsed + 2, 1)
  })

  it('saves progress and restores it after a reload, paused at the same spot', () => {
    session.start(ex.id, buildPhases(ex, getSettings()))
    vi.advanceTimersByTime(13_000)
    const saved = session.loadSaved()
    expect(saved).not.toBeNull()
    expect(saved!.exerciseId).toBe(ex.id)
    expect(saved!.side).toBe('right')
    expect(saved!.paused).toBe(false)
    expect(saved!.remaining).toBeGreaterThan(18)
    expect(saved!.remaining).toBeLessThan(21)

    // simulate the reload: engine state gone, storage kept
    const raw = localStorage.getItem(session.SAVE_KEY)!
    session.end()
    localStorage.setItem(session.SAVE_KEY, raw)

    session.restore(session.loadSaved()!)
    const l = session.live()
    expect(l.status).toBe('paused')
    expect(l.index).toBe(saved!.index)
    expect(30 - l.elapsed).toBeCloseTo(saved!.remaining, 1)
  })

  it('expires saved sessions after 30 minutes', () => {
    session.start(ex.id, buildPhases(ex, getSettings()))
    vi.advanceTimersByTime(5_000)
    session.pause()
    expect(session.loadSaved()).not.toBeNull()
    vi.setSystemTime(Date.now() + 31 * 60 * 1000)
    expect(session.loadSaved()).toBeNull()
    expect(localStorage.getItem(session.SAVE_KEY)).toBeNull()
  })

  it('logs the session and clears the save when it finishes', () => {
    session.start(ex.id, buildPhases(ex, getSettings()))
    vi.advanceTimersByTime(3_000 + 3 * 30_000 + 2 * 5_000 + 500)
    expect(session.live().status).toBe('done')
    expect(session.getEngine().logged).toBe(true)
    expect(localStorage.getItem(session.SAVE_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem('pf.log.v1')!)).toHaveLength(1)
  })
})
