# Stretcher

A mobile-first guide for a plantar fasciitis exercise routine plus a physio strengthening
program: a realistic animated male/female 3D body that performs each stretch in step with
the timer and highlights the muscles it targets, a phase timer (holds,
reps, sets, 3-2-3 heel-raise tempo, self-paced rep counting), audio/voice cues, a daily
plan, progress charts and a printable report. Works offline (localStorage), with optional
Supabase sign-in and sync.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 on the computer.

### On your phone (same Wi-Fi)

`npm run dev` listens on your local network and prints a `Network:` address, for example
`http://192.168.1.23:5173`. Type that address into your phone's browser.

If it doesn't load: make sure the phone and computer are on the same network, and allow
Node/port 5173 through the computer's firewall.

**Keep the screen awake:** phones only allow the Screen Wake Lock API over HTTPS. Run

```bash
npm run dev:https
```

and open the `https://…:5173` Network address instead. The certificate is self-signed, so
the browser shows a warning the first time; choose "Advanced → Proceed" (Android/Chrome)
or "Show details → visit this website" (iOS/Safari). Plain HTTP works for everything else.

Tip: use "Add to Home Screen" for a full-screen, app-like experience.

## 3D bodies

The bodies in `public/models/` are built from MakeHuman/MPFB in headless Blender, with a
per-vertex muscle map projected from Z-Anatomy. Rebuild them with one command:

```bash
bash tools/model/build.sh
```

See `tools/model/README.md` for details and `tools/model/CREDITS.md` for licences
(the models are CC BY-SA 4.0 because of the Z-Anatomy muscle data). Poses live in
`src/stretches/poses/`. Rendered previews of every stretch are in `docs/stretch-previews/`.

## Cloud sync, sign-in and profiles (Supabase, optional)

Without Supabase the app runs fully offline and keeps everything on the device.
With it you get email + password sign-in, a profile, and your sessions and pain ratings
backed up and synced between devices (anything logged before signing in is uploaded).

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste all of `supabase/migrations/20261018000000_init.sql` and run it.
   (Or with the Supabase CLI: `supabase link` then `supabase db push`.)
   It creates `profiles`, `exercise_sessions` and `pain_ratings`, each locked to its owner
   with row-level security, plus a trigger that creates your profile when you sign up.
3. **Project Settings → API**: copy the Project URL and the `anon` public key.
4. `cp .env.example .env.local` and paste them in. Restart `npm run dev`.
5. **Authentication → URL Configuration**: add your dev address(es) to *Redirect URLs*,
   for example `http://localhost:5173` and `https://192.168.1.23:5173`, so the
   confirmation and password-reset emails link back to the app.

Then open **Settings → Account & sync** in the app and create your account.

## Progress, correlations and the report

The **Progress** tab charts your morning first-step pain (daily ratings and a 7-day
average), how much of each day's routine you completed, and which exercises you did on
which days. **What's linked with next-morning pain** compares each day's exercises with
your pain rating the following morning: it shows the correlation (r) and the average
next-morning pain after days you did vs skipped each exercise. It needs at least 8 such
days, and it shows patterns, not causes.

**Report** builds a printable summary for any period (2 weeks to all time): pain change,
adherence per exercise against its prescription, the strongest links, and your profile
notes. Use **Print / PDF** to save or share it, or **CSV** for the raw data.

## Tests

```bash
npm test   # Vitest: session engine (settings never reset a session, live cues, save/resume, 30-min expiry)
```

## Build

```bash
npm run build     # type-check + production build into dist/
npm run preview   # serve the build on your network
```

## Disclaimer

Not medical advice. Stop any exercise that causes sharp pain.
