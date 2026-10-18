import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../data/exercises'
import { beeps, speak, speechSupported, unlockAudio } from '../lib/audio'
import { buildPhases, isWorkPhase, type Phase } from '../lib/phases'
import { sidesFor } from '../lib/settings'
import { todayKey, useLog, useSettings } from '../lib/storage'
import { statusFor } from '../lib/plan'
import { go } from '../lib/useHashRoute'
import { useRunner } from '../lib/useRunner'
import { useWakeLock } from '../lib/useWakeLock'
import { createAnimator } from '../three/animator'
import { ExerciseScene, type SceneHandle } from '../three/Scene'
import { IconBack, IconCheck, IconMute, IconPause, IconPlay, IconRestart, IconSkip, IconSound, IconView, IconVoice } from './Icons'
import TempoIndicator from './TempoIndicator'
import Stepper from './Stepper'

const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec))
  if (s < 60) return String(s)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const fmtDuration = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)} min${sec % 60 ? ` ${sec % 60} s` : ''}` : `${sec} s`)

export default function ExerciseSession({ exercise: ex, dark }: { exercise: Exercise; dark: boolean }) {
  const [settings, updateSettings] = useSettings()
  const { log, add } = useLog()
  const sides = sidesFor(settings.foot)
  const phases = useMemo(() => buildPhases(ex, settings), [ex, settings])
  const [logged, setLogged] = useState(false)
  const sceneRef = useRef<SceneHandle>(null)

  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const runner = useRunner(phases, {
    onPhaseStart: (p) => {
      const s = settingsRef.current
      if (s.beeps) (isWorkPhase(p.kind) ? beeps.work : beeps.rest)()
      if (s.voice) speak(p.cue)
    },
    onCountdown: (left, p) => {
      if (settingsRef.current.beeps && !(p.kind === 'up' || p.kind === 'top' || p.kind === 'down')) beeps.tick()
      void left
    },
    onDone: () => {
      const s = settingsRef.current
      if (s.beeps) beeps.done()
      if (s.voice) speak('Session complete. Nice work.')
      add({ exerciseId: ex.id, sides: sidesFor(s.foot) })
      setLogged(true)
    },
  })

  const live = runner.live()
  const phase: Phase | undefined = phases[live.index]
  const active = live.status === 'running' || live.status === 'paused'
  const wake = useWakeLock(active)

  // the 3D figure pulls its pose from the timer every frame
  const animator = useMemo(() => createAnimator(ex), [ex])
  const liveRef = useRef(runner.live)
  liveRef.current = runner.live
  const phasesRef = useRef(phases)
  phasesRef.current = phases
  const getFrame = useCallback((dt: number) => animator(dt, liveRef.current(), phasesRef.current), [animator])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const start = () => {
    unlockAudio()
    setLogged(false)
    runner.start()
  }
  const restart = () => {
    unlockAudio()
    setLogged(false)
    runner.reset()
    runner.start()
  }
  const leave = () => {
    if (active && !window.confirm('Leave this exercise? Your progress in this session will be lost.')) return
    runner.reset()
    go('/')
  }

  const remaining = phase && live.status !== 'idle' ? phase.duration - live.elapsed : 0
  const sceneSide = live.status === 'idle' ? sides[0] : phase?.side ?? sides[0]
  const totalSec = phases.reduce((a, p) => a + p.duration, 0)
  const doneSec = live.status === 'done' ? totalSec : phases.slice(0, live.index).reduce((a, p) => a + p.duration, 0) + (live.status === 'idle' ? 0 : live.elapsed)
  const status = statusFor(log, ex.id, todayKey())

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      {/* 3D view */}
      <div className="relative h-[44vh] min-h-[260px] w-full shrink-0 bg-slate-100 dark:bg-slate-900 sm:rounded-b-3xl sm:overflow-hidden">
        <ExerciseScene ref={sceneRef} exercise={ex} side={sceneSide} dark={dark} getFrame={getFrame} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button onClick={leave} className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/85 shadow backdrop-blur dark:bg-slate-800/85" aria-label="Back">
            <IconBack />
          </button>
          <button
            onClick={() => sceneRef.current?.resetView()}
            className="pointer-events-auto flex h-12 items-center gap-1.5 rounded-full bg-white/85 px-4 text-sm font-semibold shadow backdrop-blur dark:bg-slate-800/85"
          >
            <IconView width={20} height={20} /> Reset view
          </button>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 text-xs font-semibold">
          <span className="rounded-full bg-white/85 px-3 py-1.5 shadow backdrop-blur dark:bg-slate-800/85">
            {sceneSide === 'left' ? 'Left' : 'Right'} foot
            {sides.length > 1 && <span className="muted"> · {sides.indexOf(sceneSide) + 1} of 2</span>}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 shadow backdrop-blur dark:bg-slate-800/85">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6a3d]" /> {ex.targetLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <div>
          <h1 className="text-xl font-bold leading-tight">{ex.name}</h1>
          <p className="text-sm muted">
            {ex.dosage} · {ex.frequencyLabel}
            {status.kind === 'daily' && ` · ${Math.min(status.done, status.target)}/${status.target} today`}
          </p>
        </div>

        {/* timer */}
        <section className="card p-5" aria-live="polite">
          {live.status === 'done' ? (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white">
                <IconCheck width={30} height={30} />
              </div>
              <p className="mt-3 text-2xl font-bold">Session complete</p>
              <p className="muted">{logged ? 'Logged for today.' : ''}</p>
            </div>
          ) : live.status === 'idle' ? (
            <div className="py-2 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide muted">Ready</p>
              <p className="tabular mt-1 text-5xl font-bold">{fmtDuration(Math.round(totalSec))}</p>
              <p className="mt-2 text-sm muted">{summary(ex, settings.stretchRestSec, settings.setRestSec, sides.length)}</p>
            </div>
          ) : (
            phase && <RunningTimer ex={ex} phase={phase} remaining={remaining} elapsed={live.elapsed} paused={live.status === 'paused'} next={phases[live.index + 1]} sidesCount={sides.length} />
          )}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-brand-500/70 transition-[width] duration-200" style={{ width: `${(doneSec / totalSec) * 100}%` }} />
          </div>
        </section>

        {/* controls */}
        <section className="grid grid-cols-4 gap-2">
          {live.status === 'idle' || live.status === 'done' ? (
            <button className="btn-primary col-span-4 min-h-[60px] text-lg" onClick={live.status === 'done' ? restart : start}>
              <IconPlay /> {live.status === 'done' ? 'Do another session' : 'Start'}
            </button>
          ) : (
            <>
              <button className="btn-primary col-span-2 min-h-[60px] text-lg" onClick={live.status === 'paused' ? runner.resume : runner.pause}>
                {live.status === 'paused' ? <><IconPlay /> Resume</> : <><IconPause /> Pause</>}
              </button>
              <button className="btn-soft min-h-[60px] flex-col gap-0 text-xs" onClick={runner.skip} aria-label="Skip phase">
                <IconSkip /> Skip
              </button>
              <button className="btn-soft min-h-[60px] flex-col gap-0 text-xs" onClick={restart} aria-label="Restart">
                <IconRestart /> Restart
              </button>
            </>
          )}
        </section>

        <section className="flex flex-wrap gap-2">
          <Toggle on={settings.beeps} onClick={() => updateSettings({ beeps: !settings.beeps })} icon={settings.beeps ? <IconSound width={18} /> : <IconMute width={18} />} label="Beeps" />
          {speechSupported() && <Toggle on={settings.voice} onClick={() => { unlockAudio(); updateSettings({ voice: !settings.voice }) }} icon={<IconVoice width={18} />} label="Voice cues" />}
          {active && (
            <span className="pill bg-slate-100 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {wake.locked ? 'Screen stays on' : wake.supported ? 'Screen lock: waiting…' : 'Screen may sleep (needs HTTPS)'}
            </span>
          )}
        </section>

        {(live.status === 'idle' || live.status === 'done') && ex.kind !== 'continuous' && (
          <section className="card divide-y divide-slate-100 dark:divide-slate-800">
            {ex.kind === 'stretch' && (
              <Stepper label="Rest between reps" value={settings.stretchRestSec} min={0} max={60} step={1} format={(v) => `${v} s`} onChange={(v) => updateSettings({ stretchRestSec: v })} />
            )}
            {ex.kind === 'heel-raise' && (
              <Stepper label="Rest between sets" value={settings.setRestSec} min={30} max={600} step={15} format={fmtDuration} onChange={(v) => updateSettings({ setRestSec: v })} />
            )}
          </section>
        )}

        <section className="card p-4">
          <h2 className="font-semibold">How to do it</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px] leading-snug">
            {ex.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {ex.notes.map((n) => (
            <p key={n} className="mt-3 rounded-xl bg-brand-50 p-3 text-sm font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-100">
              {n}
            </p>
          ))}
          <p className="mt-3 text-xs muted">Stop if any exercise causes sharp pain.</p>
        </section>

        {live.status === 'idle' && (
          <button
            className="btn-soft w-full text-sm"
            onClick={() => {
              add({ exerciseId: ex.id, sides, manual: true })
              go('/')
            }}
          >
            <IconCheck width={18} /> I already did this session — log it
          </button>
        )}
        {live.status === 'done' && (
          <button className="btn-soft w-full" onClick={() => go('/')}>
            Back to today
          </button>
        )}
      </div>
    </div>
  )
}

function summary(ex: Exercise, restSec: number, setRestSec: number, sides: number) {
  const both = sides > 1 ? ' Each foot in turn.' : ''
  if (ex.kind === 'stretch') return `${ex.reps} × ${ex.holdSec} s holds, ${restSec} s rest between reps.${both}`
  if (ex.kind === 'heel-raise') return `${ex.sets} sets × ${ex.reps} reps, ${ex.tempo!.up}-${ex.tempo!.top}-${ex.tempo!.down} tempo, ${fmtDuration(setRestSec)} rest between sets.${both}`
  return `${fmtDuration(ex.durationSec!)} of rolling.${both}`
}

function RunningTimer({
  ex, phase, remaining, elapsed, paused, next, sidesCount,
}: {
  ex: Exercise; phase: Phase; remaining: number; elapsed: number; paused: boolean; next?: Phase; sidesCount: number
}) {
  const work = isWorkPhase(phase.kind)
  const tone = work
    ? 'text-brand-700 dark:text-brand-300'
    : phase.kind === 'prep' || phase.kind === 'switch'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-slate-500 dark:text-slate-400'
  const tempoPhase = phase.kind === 'up' || phase.kind === 'top' || phase.kind === 'down'
  let counter = ''
  if (phase.kind === 'prep' || phase.kind === 'switch') counter = ''
  else if (ex.kind === 'stretch') counter = `Rep ${phase.rep} of ${phase.reps}`
  else if (ex.kind === 'heel-raise') counter = `Set ${phase.set} of ${phase.sets} · Rep ${phase.rep} of ${phase.reps}`
  const sideNote = sidesCount > 1 ? `${phase.side === 'left' ? 'Left' : 'Right'} foot` : ''

  return (
    <div className="text-center">
      <p className={`text-2xl font-bold uppercase tracking-wide ${tone}`}>{paused ? 'Paused' : phase.label}</p>
      <p className={`tabular font-bold leading-none ${work ? '' : 'text-slate-600 dark:text-slate-300'} ${remaining >= 60 ? 'text-7xl' : 'text-8xl'} mt-2`}>
        {fmtClock(remaining)}
      </p>
      {counter && <p className="tabular mt-3 text-lg font-semibold">{counter}</p>}
      {sideNote && <p className="text-sm muted">{sideNote}</p>}
      {ex.kind === 'heel-raise' && (tempoPhase ? <TempoIndicator tempo={ex.tempo!} phase={phase.kind} elapsed={elapsed} /> : <TempoIndicator tempo={ex.tempo!} phase={null} elapsed={0} />)}
      {next && (
        <p className="mt-3 text-sm muted">
          Next: {next.label}
          {next.kind === 'hold' || next.kind === 'rest' || next.kind === 'set-rest' ? ` · ${fmtDuration(next.duration)}` : ''}
        </p>
      )}
    </div>
  )
}

function Toggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
        on ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {icon}
      {label}: {on ? 'On' : 'Off'}
    </button>
  )
}
