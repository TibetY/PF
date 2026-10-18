# Heel Routine

A mobile-first guide for a plantar fasciitis exercise routine: animated 3D demonstrations,
a phase timer (holds, reps, sets, 3-2-3 heel-raise tempo), audio/voice cues, a daily plan,
and progress tracking. No backend; everything is saved in your browser (localStorage).

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

## Build

```bash
npm run build     # type-check + production build into dist/
npm run preview   # serve the build on your network
```

## Disclaimer

Not medical advice. Stop any exercise that causes sharp pain.
