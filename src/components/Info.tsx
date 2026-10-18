export default function Info() {
  return (
    <div className="space-y-5">
      <h1 className="pt-2 text-2xl font-bold tracking-tight">Tips & info</h1>

      <section className="card p-4">
        <h2 className="text-lg font-semibold">Everyday tips</h2>
        <ul className="mt-3 space-y-3 text-[15px] leading-snug">
          <Tip title="Supportive shoes">Wear supportive shoes and avoid going barefoot, including at home.</Tip>
          <Tip title="Heel cups or arch inserts">These can take load off the plantar fascia.</Tip>
          <Tip title="Ease the load for now">Temporarily cut back on running and long periods of standing.</Tip>
          <Tip title="Night splint">If morning pain is significant, a night splint can help.</Tip>
        </ul>
      </section>

      <section className="card p-4 ring-amber-300/60 dark:ring-amber-500/30">
        <h2 className="text-lg font-semibold">When to see a doctor</h2>
        <p className="mt-2 text-[15px]">See a doctor if there is no improvement after 6–8 weeks.</p>
        <p className="mt-3 text-[15px] font-semibold">Go sooner if you have:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px]">
          <li>Numbness or tingling</li>
          <li>Noticeable swelling</li>
          <li>Pain at rest or at night</li>
          <li>A sudden “pop” followed by bruising</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-slate-100 p-4 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Disclaimer</h2>
        <p className="mt-1">
          This app is not medical advice. It is a guide for a routine you have been given. Stop any exercise that causes sharp pain, and talk to a
          healthcare professional if you are unsure.
        </p>
      </section>

      <a href="#/credits" className="card block p-4 font-semibold">
        Credits & licences <span className="float-right muted">›</span>
        <span className="mt-1 block text-sm font-normal muted">3D bodies (MakeHuman, CC0), muscle map (Z-Anatomy, CC BY-SA 4.0), lighting (Poly Haven)</span>
      </a>
    </div>
  )
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="muted">{children}</p>
      </div>
    </li>
  )
}
