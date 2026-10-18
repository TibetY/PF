import { useCallback, useEffect, useRef, useState } from 'react'
import type { Phase } from './phases'

export type RunStatus = 'idle' | 'running' | 'paused' | 'done'

export interface LiveState {
  status: RunStatus
  index: number
  /** Seconds elapsed in the current phase. */
  elapsed: number
}

interface Callbacks {
  onPhaseStart: (p: Phase, index: number) => void
  onCountdown: (secondsLeft: number, p: Phase) => void
  onDone: () => void
}

/** Wall-clock driven phase sequencer. Survives background-tab throttling by catching up. */
export function useRunner(phases: Phase[], cb: Callbacks) {
  const cbRef = useRef(cb)
  cbRef.current = cb
  const st = useRef({ status: 'idle' as RunStatus, index: 0, phaseStart: 0, pausedAt: 0, lastLeft: -1 })
  const [, setTick] = useState(0)

  const now = () => performance.now()

  const live = useCallback((): LiveState => {
    const s = st.current
    const t = s.status === 'running' ? now() : s.pausedAt
    return { status: s.status, index: s.index, elapsed: s.status === 'idle' ? 0 : Math.max(0, (t - s.phaseStart) / 1000) }
  }, [])

  const enter = useCallback((index: number, at: number) => {
    const s = st.current
    s.index = index
    s.phaseStart = at
    s.lastLeft = -1
    if (index >= phases.length) {
      s.status = 'done'
      s.index = phases.length - 1
      s.pausedAt = at
      cbRef.current.onDone()
    } else {
      cbRef.current.onPhaseStart(phases[index], index)
    }
  }, [phases])

  const step = useCallback(() => {
    const s = st.current
    if (s.status !== 'running') return
    const t = now()
    // catch up on any phases that ended (e.g. while the tab was hidden)
    let guard = 0
    while (s.status === 'running' && guard++ < 1000) {
      const p = phases[s.index]
      if (p.untimed) break
      const end = s.phaseStart + p.duration * 1000
      if (t < end) break
      enter(s.index + 1, end)
    }
    if (s.status !== 'running') return
    const p = phases[s.index]
    if (p.untimed) return
    const left = Math.ceil(p.duration - (t - s.phaseStart) / 1000)
    if (left !== s.lastLeft) {
      s.lastLeft = left
      if (left <= 3 && left >= 1 && p.duration >= 5) cbRef.current.onCountdown(left, p)
    }
  }, [phases, enter])

  useEffect(() => {
    const id = window.setInterval(() => {
      step()
      setTick((n) => (n + 1) % 1e6)
    }, 100)
    return () => window.clearInterval(id)
  }, [step])

  // reset when the phase list changes (different exercise or settings)
  useEffect(() => {
    st.current = { status: 'idle', index: 0, phaseStart: 0, pausedAt: 0, lastLeft: -1 }
    setTick((n) => n + 1)
  }, [phases])

  const start = useCallback(() => {
    st.current.status = 'running'
    enter(0, now())
    setTick((n) => n + 1)
  }, [enter])

  const pause = useCallback(() => {
    const s = st.current
    if (s.status !== 'running') return
    s.status = 'paused'
    s.pausedAt = now()
    setTick((n) => n + 1)
  }, [])

  const resume = useCallback(() => {
    const s = st.current
    if (s.status !== 'paused') return
    s.phaseStart += now() - s.pausedAt
    s.status = 'running'
    setTick((n) => n + 1)
  }, [])

  const skip = useCallback(() => {
    const s = st.current
    if (s.status !== 'running' && s.status !== 'paused') return
    const wasPaused = s.status === 'paused'
    const t = now()
    s.status = 'running'
    enter(s.index + 1, t)
    if (wasPaused && st.current.status === 'running') {
      st.current.status = 'paused'
      st.current.pausedAt = t
    }
    setTick((n) => n + 1)
  }, [enter])

  const reset = useCallback(() => {
    st.current = { status: 'idle', index: 0, phaseStart: 0, pausedAt: 0, lastLeft: -1 }
    setTick((n) => n + 1)
  }, [])

  return { live, start, pause, resume, skip, reset }
}
