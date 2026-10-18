import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../data/exercises'
import { beeps, speak, speechSupported, unlockAudio } from '../lib/audio'
import { buildPhases, isWorkPhase, type Phase } from '../lib/phases'
import { exerciseSides, holdFor, repsFor, setRestFor } from '../lib/settings'
import { todayKey, useLog, useSettings } from '../lib/storage'
import { statusFor } from '../lib/plan'
import { go } from '../lib/useHashRoute'
import { useRunner } from '../lib/useRunner'
import { useWakeLock } from '../lib/useWakeLock'
import { createAnimator } from '../three/animator'
import { ExerciseScene, FOOT_CAM_RECT, type SceneHandle } from '../three/Scene'
import { FOOT_CAMS } from '../three/poses'
import { IconBack, IconCheck, IconMute, IconPause, IconPlay, IconRestart, IconSkip, IconSound, IconView, IconVoice } from './Icons'
import TempoIndicator from './TempoIndicator'
import Stepper from './Stepper'

const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec))
  if (s < 60) return String(s)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const fmtUp = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
export const fmtDuration = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)} min${sec % 60 ? ` ${sec % 60} s` : ''}` : `${sec} s`)

/** Rough seconds per self-paced rep, only used for the progress bar and time estimate. */
const SELF_PACED_REP_SEC = 4
const phaseWeight = (p: Phase) => (p.untimed ? p.reps * SELF_PACED_REP_SEC : p.duration)

export default function ExerciseSession({ exercise: ex, dark }: { exercise: Exercise; dark: boolean }) {
  const [settings, updateSettings] = useSettings()
  const { log, add } = useLog()
  const sides = exerciseSides(ex, settings.foot)
  const phases = useMemo(() => buildPhases(ex, settings), [ex, settings])
  const [logged, setLogged] = useState(false)
  const [count, setCount] = useState(0)
  const sceneRef = useRef<SceneHandle>(null)

  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const runner = useRunner(phases, {
    onPhaseStart: (p) => {
      setCount(0)
      const s = settingsRef.current
      if (s.beeps) (isWorkPhase(p.kind) ? beeps.work : beeps.rest)()
      if (s.voice) speak(p.cue)
    },
    onCountdown: (_left, p) => {
      if (settingsRef.current.beeps && !(p.kind === 'up' || p.kind === 'top' || p.kind === 'down')) beeps.tick()
    },
    onDone: () => {
      const s = settingsRef.current
      if (s.beeps) beeps.done()
      if (s.voice) speak('Session complete. Nice work.')
      add({ exerciseId: ex.id, sides: ex.eachLeg ? ['right', 'left'] : exerciseSides(ex, s.foot) })
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

  // self-paced reps: tap +1; the set ends automatically at the target
  const tapRep = () => {
    if (!phase?.untimed || live.status !== 'running') return
    const next = count + 1
    setCount(next)
    if (settings.voice) speak(String(next))
    else if (settings.beeps) beeps.tick()
    if (next >= phase.reps) window.setTimeout(() => runner.skip(), 450)
  }

  const remaining = phase && live.status !== 'idle' && !phase.untimed ? phase.duration - live.elapsed : 0
  const sceneSide = live.status === 'idle' ? (ex.eachLeg ? 'right' : sides[0]) : phase?.side ?? sides[0]
  const total = phases.reduce((a, p) => a + phaseWeight(p), 0)
  const done =
    live.status === 'done'
      ? total
      : phases.slice(0, live.index).reduce((a, p) => a + phaseWeight(p), 0) +
        (live.status === 'idle' || !phase ? 0 : phase.untimed ? count * SELF_PACED_REP_SEC : live.elapsed)
  const status = statusFor(log, ex.id, todayKey())
  const showSides = sides.length > 1 || ex.eachLeg
  const editable = live.status === 'idle' || live.status === 'done'
  const hasFootCam = FOOT_CAMS[ex.id] !== null

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      {/* 3D view */}
      <div className="relative h-[46vh] min-h-[280px] w-full shrink-0 bg-slate-100 dark:bg-slate-900 sm:overflow-hidden sm:rounded-b-3xl">
        <ExerciseScene ref={sceneRef} exercise={ex} side={sceneSide} dark={dark} getFrame={getFrame} footCam={settings.footCam} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button onClick={leave} className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/85 shadow backdrop-blur dark:bg-slate-800/85" aria-label="Back">
            <IconBack />
          </button>
          <div className="pointer-events-auto flex gap-2">
            {hasFootCam && <button
              onClick={() => updateSettings({ footCam: !settings.footCam })}
              aria-pressed={settings.footCam}
              className={`flex h-12 items-center rounded-full px-4 text-sm font-semibold shadow backdrop-blur ${
                settings.footCam ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950' : 'bg-white/85 dark:bg-slate-800/85'
              }`}
            >
              Foot cam
            </button>}
            <button
              onClick={() => sceneRef.current?.resetView()}
              className="flex h-12 items-center gap-1.5 rounded-full bg-white/85 px-4 text-sm font-semibold shadow backdrop-blur dark:bg-slate-800/85"
              aria-label="Reset view"
            >
              <IconView width={20} height={20} /> Reset
            </button>
          </div>
        </div>
        {settings.footCam && hasFootCam && (
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-white/90 shadow-lg dark:ring-slate-600"
            style={{
              right: FOOT_CAM_RECT.right,
              bottom: FOOT_CAM_RECT.bottom,
              width: `min(${FOOT_CAM_RECT.widthFrac * 100}%, ${FOOT_CAM_RECT.maxWidth}px)`,
              aspectRatio: String(FOOT_CAM_RECT.aspect),
            }}
          >
            <span className="absolute left-1.5 top-1.5 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">Foot close-up</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 text-xs font-semibold">
          <span className="rounded-full bg-white/85 px-3 py-1.5 shadow backdrop-blur dark:bg-slate-800/85">
            {ex.unsided ? 'Alternate legs' : `${sceneSide === 'left' ? 'Left' : 'Right'} ${ex.id === 'side-plank-abduction' ? 'leg on top' : ex.eachLeg ? 'leg' : 'foot'}`}
            {showSides && !ex.eachLeg && <span className="muted"> · {sides.indexOf(sceneSide) + 1} of 2</span>}
          </span>
          <span className="flex items-center gap-1.5 truncate rounded-full bg-white/85 px-3 py-1.5 shadow backdrop-blur dark:bg-slate-800/85">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff6a3d]" /> <span className="truncate">{ex.targetLabel}</span>
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
              <p className="tabular mt-1 text-5xl font-bold">
                {phases.some((p) => p.untimed) ? '≈ ' : ''}
                {fmtDuration(Math.round(total))}
              </p>
              <p className="mt-2 text-sm muted">{summary(ex, settings)}</p>
            </div>
          ) : (
            phase && (
              <RunningTimer
                ex={ex}
                phase={phase}
                remaining={remaining}
                elapsed={live.elapsed}
                paused={live.status === 'paused'}
                next={phases[live.index + 1]}
                showSide={sides.length > 1}
                count={count}
              />
            )
          )}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-brand-500/70 transition-[width] duration-200" style={{ width: `${Math.min(100, (done / total) * 100)}%` }} />
          </div>
        </section>

        {/* controls */}
        {phase?.untimed && live.status === 'running' && (
          <section className="grid grid-cols-3 gap-2">
            <button className="btn-primary col-span-2 min-h-[72px] text-2xl" onClick={tapRep}>
              +1 rep
            </button>
            <button className="btn-soft min-h-[72px] text-sm" onClick={runner.skip}>
              Set done
            </button>
          </section>
        )}
        <section className="grid grid-cols-4 gap-2">
          {editable ? (
            <button className="btn-primary col-span-4 min-h-[60px] text-lg" onClick={live.status === 'done' ? restart : start}>
              <IconPlay /> {live.status === 'done' ? 'Do another session' : 'Start'}
            </button>
          ) : (
            <>
              <button
                className={`${phase?.untimed ? 'btn-soft' : 'btn-primary'} col-span-2 min-h-[60px] text-lg`}
                onClick={live.status === 'paused' ? runner.resume : runner.pause}
              >
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
          {speechSupported() && (
            <Toggle
              on={settings.voice}
              onClick={() => {
                unlockAudio()
                updateSettings({ voice: !settings.voice })
              }}
              icon={<IconVoice width={18} />}
              label="Voice cues"
            />
          )}
          {active && (
            <span className="pill bg-slate-100 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {wake.locked ? 'Screen stays on' : wake.supported ? 'Screen lock: waiting…' : 'Screen may sleep (needs HTTPS)'}
            </span>
          )}
        </section>

        {editable && <SessionOptions ex={ex} />}

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
              add({ exerciseId: ex.id, sides: ex.eachLeg ? ['right', 'left'] : sides, manual: true })
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

/** Adjustable values: rests, and choices inside a prescribed range. */
function SessionOptions({ ex }: { ex: Exercise }) {
  const [settings, update] = useSettings()
  const rows: React.ReactNode[] = []
  const choose = (patch: { reps?: number; holdSec?: number }) =>
    update({ choices: { ...settings.choices, [ex.id]: { ...settings.choices[ex.id], ...patch } } })

  if (ex.repsRange) {
    rows.push(
      <Stepper key="reps" label={`Reps (physio: ${ex.repsRange[0]}–${ex.repsRange[1]})`} value={repsFor(ex, settings)} min={ex.repsRange[0]} max={ex.repsRange[1]} step={1} format={(v) => String(v)} onChange={(v) => choose({ reps: v })} />,
    )
  }
  if (ex.holdRange) {
    rows.push(
      <Stepper key="hold" label={`Hold (physio: ${ex.holdRange[0]}–${ex.holdRange[1]} s)`} value={holdFor(ex, settings)} min={ex.holdRange[0]} max={ex.holdRange[1]} step={5} format={(v) => `${v} s`} onChange={(v) => choose({ holdSec: v })} />,
    )
  }
  if (ex.kind === 'stretch' || (ex.kind === 'hold' && ((ex.reps ?? 1) > 1 || ex.eachLeg))) {
    rows.push(
      <Stepper key="rr" label={ex.eachLeg ? 'Switch / rest between reps' : 'Rest between reps'} value={settings.stretchRestSec} min={0} max={60} step={1} format={(v) => `${v} s`} onChange={(v) => update({ stretchRestSec: v })} />,
    )
  }
  if ((ex.sets ?? 1) > 1) {
    const label = ex.setRestPrescribed === false ? 'Rest between sets (not on physio sheet)' : 'Rest between sets'
    rows.push(
      <Stepper
        key="sr"
        label={label}
        value={setRestFor(ex, settings)}
        min={ex.id === 'heel-raise' ? 30 : 0}
        max={600}
        step={ex.id === 'heel-raise' ? 15 : 5}
        format={fmtDuration}
        onChange={(v) => (ex.id === 'heel-raise' ? update({ setRestSec: v }) : update({ setRestById: { ...settings.setRestById, [ex.id]: v } }))}
      />,
    )
  }
  if (rows.length === 0) return null
  return <section className="card divide-y divide-slate-100 dark:divide-slate-800">{rows}</section>
}

function summary(ex: Exercise, s: Parameters<typeof repsFor>[1]) {
  const sides = exerciseSides(ex, s.foot)
  const both = ex.eachLeg ? ' Each leg.' : sides.length > 1 ? ' Each foot in turn.' : ''
  const reps = repsFor(ex, s)
  const hold = holdFor(ex, s)
  const setRest = fmtDuration(setRestFor(ex, s))
  if (ex.kind === 'stretch') return `${reps} × ${hold} s holds, ${s.stretchRestSec} s rest between reps.${both}`
  if (ex.kind === 'heel-raise') return `${ex.sets} sets × ${reps} reps, ${ex.tempo!.up}-${ex.tempo!.top}-${ex.tempo!.down} tempo, ${setRest} rest between sets.${both}`
  if (ex.kind === 'hold') {
    const sets = ex.sets ?? 1
    return `${sets > 1 ? `${sets} sets × ` : ''}${reps} × ${hold} s holds${sets > 1 ? `, ${setRest} rest between sets` : ''}.${both}`
  }
  if (ex.kind === 'reps') return `${ex.sets} sets × ${reps} reps at your own pace (tap +1), ${setRest} rest between sets.${both}`
  return `${fmtDuration(ex.durationSec!)} of rolling.${both}`
}

function RunningTimer({
  ex, phase, remaining, elapsed, paused, next, showSide, count,
}: {
  ex: Exercise; phase: Phase; remaining: number; elapsed: number; paused: boolean; next?: Phase; showSide: boolean; count: number
}) {
  const work = isWorkPhase(phase.kind)
  const tone = work
    ? 'text-brand-700 dark:text-brand-300'
    : phase.kind === 'prep' || phase.kind === 'switch'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-slate-500 dark:text-slate-400'
  const tempoPhase = phase.kind === 'up' || phase.kind === 'top' || phase.kind === 'down'
  let counter = ''
  const sets = phase.sets > 1 ? `Set ${phase.set} of ${phase.sets}` : ''
  if (phase.kind === 'prep' || phase.kind === 'switch') counter = ''
  else if (ex.kind === 'stretch') counter = `Rep ${phase.rep} of ${phase.reps}`
  else if (ex.kind === 'heel-raise') counter = `${sets} · Rep ${phase.rep} of ${phase.reps}`
  else if (ex.kind === 'hold') counter = [sets, phase.reps > 1 ? `Rep ${phase.rep} of ${phase.reps}` : ''].filter(Boolean).join(' · ')
  else if (ex.kind === 'reps') counter = sets

  return (
    <div className="text-center">
      <p className={`text-2xl font-bold uppercase tracking-wide ${tone}`}>{paused ? 'Paused' : phase.label}</p>
      {phase.untimed ? (
        <>
          <p className="tabular mt-2 text-8xl font-bold leading-none">
            {count}
            <span className="text-4xl text-slate-400 dark:text-slate-500">/{phase.reps}</span>
          </p>
          <p className="tabular mt-2 text-sm muted">Set time {fmtUp(elapsed)}</p>
        </>
      ) : (
        <p className={`tabular mt-2 font-bold leading-none ${work ? '' : 'text-slate-600 dark:text-slate-300'} ${remaining >= 60 ? 'text-7xl' : 'text-8xl'}`}>
          {fmtClock(remaining)}
        </p>
      )}
      {counter && <p className="tabular mt-3 text-lg font-semibold">{counter}</p>}
      {showSide && <p className="text-sm muted">{phase.side === 'left' ? 'Left' : 'Right'} foot</p>}
      {ex.kind === 'heel-raise' && <TempoIndicator tempo={ex.tempo!} phase={tempoPhase ? phase.kind : null} elapsed={tempoPhase ? elapsed : 0} />}
      {next && (
        <p className="mt-3 text-sm muted">
          Next: {next.label}
          {!next.untimed && (next.kind === 'hold' || next.kind === 'rest' || next.kind === 'set-rest') ? ` · ${fmtDuration(next.duration)}` : ''}
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
