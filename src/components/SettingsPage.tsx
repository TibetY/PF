import { speechSupported, unlockAudio } from '../lib/audio'
import type { Foot, Theme } from '../lib/settings'
import { clearAllData, useSettings } from '../lib/storage'
import Stepper from './Stepper'
import { go } from '../lib/useHashRoute'
import { useAuth } from '../lib/cloud'
import { cloudEnabled } from '../lib/supabase'

const fmtDuration = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)} min${sec % 60 ? ` ${sec % 60} s` : ''}` : `${sec} s`)

export default function SettingsPage() {
  const [s, update] = useSettings()
  return (
    <div className="space-y-5">
      <h1 className="pt-2 text-2xl font-bold tracking-tight">Settings</h1>

      <AccountCard />

      <section className="card p-4">
        <h2 className="font-semibold">Affected foot</h2>
        <p className="text-sm muted">With “Both”, each exercise runs fully on the right foot, then the left.</p>
        <Segmented<Foot>
          value={s.foot}
          onChange={(foot) => update({ foot })}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
            { value: 'both', label: 'Both' },
          ]}
        />
      </section>

      <section className="card divide-y divide-slate-100 dark:divide-slate-800">
        <Stepper label="Rest between stretch reps" value={s.stretchRestSec} min={0} max={60} step={1} format={(v) => `${v} s`} onChange={(v) => update({ stretchRestSec: v })} />
        <Stepper label="Rest between heel-raise sets" value={s.setRestSec} min={30} max={600} step={15} format={fmtDuration} onChange={(v) => update({ setRestSec: v })} />
        <Stepper label="Get-in-position time" value={s.prepSec} min={3} max={30} step={1} format={(v) => `${v} s`} onChange={(v) => update({ prepSec: v })} />
        <Stepper label="Time to switch feet" value={s.switchSec} min={3} max={60} step={1} format={(v) => `${v} s`} onChange={(v) => update({ switchSec: v })} />
      </section>

      <section className="card divide-y divide-slate-100 dark:divide-slate-800">
        <Switch label="Beeps at phase changes" checked={s.beeps} onChange={(beeps) => update({ beeps })} />
        {speechSupported() && (
          <Switch
            label="Voice cues"
            checked={s.voice}
            onChange={(voice) => {
              unlockAudio()
              update({ voice })
            }}
          />
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">3D body</h2>
        <Segmented<'male' | 'female'>
          value={s.bodyModel}
          onChange={(bodyModel) => update({ bodyModel })}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
          ]}
        />
        <div className="mt-2 -mx-4 -mb-4 border-t border-slate-100 dark:border-slate-800">
          <Switch label="Anatomy view (muscle fibres)" checked={s.anatomyView} onChange={(anatomyView) => update({ anatomyView })} />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Appearance</h2>
        <Segmented<Theme>
          value={s.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Data</h2>
        <p className="text-sm muted">Everything is saved on this device. When signed in, it's also backed up to your account.</p>
        <button
          className="btn-soft mt-3 w-full text-red-600 dark:text-red-400"
          onClick={() => window.confirm('Delete all logged sessions, pain ratings and settings from this device? Your cloud account copy is not deleted.') && clearAllData()}
        >
          Clear data on this device
        </button>
      </section>
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="mt-3 grid gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[44px] rounded-lg text-sm font-semibold transition ${
            value === o.value ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 px-4">
      <span className="font-medium">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
      </button>
    </label>
  )
}

function AccountCard() {
  const { session } = useAuth()
  return (
    <button onClick={() => go('/account')} className="card flex w-full items-center justify-between gap-3 p-4 text-left">
      <div className="min-w-0">
        <p className="font-semibold">Account & sync</p>
        <p className="truncate text-sm muted">
          {!cloudEnabled ? 'Offline only · set up Supabase to sync' : session ? `Signed in as ${session.user.email}` : 'Sign in to back up and sync'}
        </p>
      </div>
      <span className="text-2xl muted" aria-hidden>
        ›
      </span>
    </button>
  )
}
