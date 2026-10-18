import { useEffect, useState } from 'react'
import { cloudEnabled } from '../lib/supabase'
import { fullSync, saveProfile, sendPasswordReset, setNewPassword, signIn, signOut, signUp, useAuth, useProfile } from '../lib/cloud'
import { updateSettings, useSyncStatus } from '../lib/storage'
import type { Foot } from '../lib/settings'

const input =
  'mt-1 block min-h-[48px] w-full rounded-xl border-0 bg-slate-100 px-3 text-base ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:ring-slate-700'

export default function Account() {
  const { session, ready, recovering } = useAuth()
  if (!cloudEnabled) return <NotConfigured />
  if (!ready) return <p className="pt-6 muted">Loading…</p>
  return (
    <div className="space-y-5">
      <h1 className="pt-2 text-2xl font-bold tracking-tight">Account</h1>
      {recovering && session ? <NewPassword /> : session ? <SignedIn email={session.user.email ?? ''} /> : <SignInForm />}
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="space-y-5">
      <h1 className="pt-2 text-2xl font-bold tracking-tight">Account</h1>
      <section className="card p-4 text-[15px] leading-relaxed">
        <p className="font-semibold">Cloud sync isn't set up</p>
        <p className="mt-1 muted">
          Everything works offline and is saved on this device. To sign in, sync between devices and keep a backup, add your Supabase project keys to
          <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code>
          (see the README) and restart the dev server.
        </p>
      </section>
    </div>
  )
}

function SignInForm() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') await signIn(email, password)
      else if (mode === 'up') {
        const { needsConfirmation } = await signUp(email, password, name)
        if (needsConfirmation) setMsg({ ok: true, text: 'Check your email to confirm your account, then sign in.' })
      } else {
        await sendPasswordReset(email)
        setMsg({ ok: true, text: 'If that email has an account, a reset link is on its way.' })
      }
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4">
      <p className="text-sm muted">Sign in to back up your log and pain ratings, and to see them on any device. Anything already logged on this device is uploaded.</p>
      {mode !== 'reset' && (
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {(['in', 'up'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-[44px] rounded-lg text-sm font-semibold ${mode === m ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'}`}
            >
              {m === 'in' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="mt-4 space-y-3">
        {mode === 'up' && (
          <label className="block text-sm font-medium">
            Name
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label className="block text-sm font-medium">
          Email
          <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
        </label>
        {mode !== 'reset' && (
          <label className="block text-sm font-medium">
            Password
            <input
              className={input}
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            />
          </label>
        )}
        {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'}`}>{msg.text}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
        </button>
      </form>
      <button className="mt-3 w-full text-sm font-medium text-brand-700 dark:text-brand-300" onClick={() => setMode(mode === 'reset' ? 'in' : 'reset')}>
        {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
      </button>
    </section>
  )
}

function NewPassword() {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <section className="card p-4">
      <p className="font-semibold">Choose a new password</p>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await setNewPassword(pw)
          } catch (err) {
            setMsg(err instanceof Error ? err.message : String(err))
          }
        }}
      >
        <input className={input} type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button className="btn-primary w-full">Save password</button>
      </form>
    </section>
  )
}

function SignedIn({ email }: { email: string }) {
  const { profile, setProfile, error } = useProfile()
  const sync = useSyncStatus()
  const [saved, setSaved] = useState<string | null>(null)
  const [form, setForm] = useState({ display_name: '', affected_foot: 'right' as Foot, condition_start: '', physio_name: '', notes: '' })

  useEffect(() => {
    if (!profile) return
    setForm({
      display_name: profile.display_name ?? '',
      affected_foot: profile.affected_foot,
      condition_start: profile.condition_start ?? '',
      physio_name: profile.physio_name ?? '',
      notes: profile.notes ?? '',
    })
  }, [profile])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(null)
    try {
      const patch = {
        display_name: form.display_name || null,
        affected_foot: form.affected_foot,
        condition_start: form.condition_start || null,
        physio_name: form.physio_name || null,
        notes: form.notes || null,
      }
      await saveProfile(patch)
      updateSettings({ foot: form.affected_foot })
      if (profile) setProfile({ ...profile, ...patch })
      setSaved('Saved')
    } catch (err) {
      setSaved(err instanceof Error ? err.message : String(err))
    }
  }

  const syncText =
    sync.state === 'syncing'
      ? 'Syncing…'
      : sync.state === 'error'
        ? `Sync problem: ${sync.error}`
        : sync.lastSyncedAt
          ? `Synced ${new Date(sync.lastSyncedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
          : 'Not synced yet'

  return (
    <>
      <section className="card flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-semibold">{email}</p>
          <p className={`text-sm ${sync.state === 'error' ? 'text-red-600 dark:text-red-400' : 'muted'}`}>
            {syncText}
            {sync.pending > 0 && ` · ${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting`}
          </p>
        </div>
        <button className="btn-soft shrink-0 text-sm" onClick={() => void fullSync()} disabled={sync.state === 'syncing'}>
          Sync now
        </button>
      </section>

      <form onSubmit={save} className="card space-y-3 p-4">
        <h2 className="font-semibold">Profile</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block text-sm font-medium">
          Name
          <input className={input} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} autoComplete="name" />
        </label>
        <label className="block text-sm font-medium">
          Affected foot
          <select className={input} value={form.affected_foot} onChange={(e) => setForm({ ...form, affected_foot: e.target.value as Foot })}>
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          When did symptoms start?
          <input className={input} type="date" value={form.condition_start} onChange={(e) => setForm({ ...form, condition_start: e.target.value })} />
        </label>
        <label className="block text-sm font-medium">
          Physiotherapist
          <input className={input} value={form.physio_name} onChange={(e) => setForm({ ...form, physio_name: e.target.value })} />
        </label>
        <label className="block text-sm font-medium">
          Notes for your report
          <textarea className={`${input} min-h-[96px] py-2`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <div className="flex items-center gap-3">
          <button className="btn-primary flex-1">Save profile</button>
          {saved && <span className="text-sm muted">{saved}</span>}
        </div>
      </form>

      <button className="btn-soft w-full" onClick={() => void signOut()}>
        Sign out
      </button>
      <p className="text-center text-xs muted">Signing out keeps a copy on this device.</p>
    </>
  )
}
