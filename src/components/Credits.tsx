import { go } from '../lib/useHashRoute'
import { IconBack } from './Icons'

const ROWS: { what: string; who: string; licence: string; url: string }[] = [
  { what: 'Muscle map on the 3D bodies', who: 'Z-Anatomy, derived from BodyParts3D (The Database Center for Life Science)', licence: 'CC BY-SA 4.0 (BodyParts3D: CC BY-SA 2.1 JP)', url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy' },
  { what: '3D bodies, rig, skin, eyes, hair', who: 'MakeHuman community, generated with MPFB 2', licence: 'CC0 1.0', url: 'https://static.makehumancommunity.org/mpfb.html' },
  { what: 'Sports top', who: 'wolgade (MakeHuman community assets)', licence: 'CC0 1.0', url: 'https://static.makehumancommunity.org/assets/assetpacks/underwear01.html' },
  { what: 'Studio lighting (HDRI)', who: 'Sergej Majboroda, Poly Haven', licence: 'CC0 1.0', url: 'https://polyhaven.com/a/studio_small_09' },
  { what: '2D muscle map fallback', who: 'react-body-highlighter', licence: 'MIT', url: 'https://github.com/giavinh79/react-body-highlighter' },
  { what: '3D rendering', who: 'three.js, React Three Fiber, drei, camera-controls, meshoptimizer', licence: 'MIT', url: 'https://threejs.org' },
]

export default function Credits() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pt-2">
        <button className="btn-soft h-11 w-11 min-h-0 p-0" onClick={() => history.back()} aria-label="Back">
          <IconBack />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
      </div>
      <section className="card divide-y divide-slate-100 dark:divide-slate-800">
        {ROWS.map((r) => (
          <div key={r.what} className="p-4">
            <p className="font-semibold">{r.what}</p>
            <p className="text-sm">{r.who}</p>
            <p className="text-sm muted">
              {r.licence} ·{' '}
              <a className="text-brand-700 underline dark:text-brand-300" href={r.url} target="_blank" rel="noreferrer">
                source
              </a>
            </p>
          </div>
        ))}
      </section>
      <p className="text-sm muted">
        The 3D body models include a muscle map derived from Z-Anatomy, so the model files are shared under CC BY-SA 4.0.
      </p>
      <button className="btn-soft w-full" onClick={() => go('/info')}>
        Back to tips
      </button>
    </div>
  )
}
