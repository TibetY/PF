import { lazy, Suspense } from 'react'
import { EXERCISE_BY_ID, type ExerciseId } from './data/exercises'
import { go, useHashRoute } from './lib/useHashRoute'
import { useSettings } from './lib/storage'
import { useTheme } from './lib/useTheme'
import Home from './components/Home'
import History from './components/History'
import Info from './components/Info'
import SettingsPage from './components/SettingsPage'
import { IconCalendar, IconHome, IconInfo, IconSettings } from './components/Icons'

// the 3D engine is only needed on the exercise screen
const ExerciseSession = lazy(() => import('./components/ExerciseSession'))

export default function App() {
  const route = useHashRoute()
  const [settings] = useSettings()
  const dark = useTheme(settings.theme)

  if (route.name === 'exercise' && route.id in EXERCISE_BY_ID) {
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center muted">Loading…</div>}>
        <ExerciseSession key={route.id} exercise={EXERCISE_BY_ID[route.id as ExerciseId]} dark={dark} />
      </Suspense>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <main className="flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        {route.name === 'history' ? <History /> : route.name === 'info' ? <Info /> : route.name === 'settings' ? <SettingsPage /> : <Home />}
      </main>
      <BottomNav current={route.name} />
    </div>
  )
}

function BottomNav({ current }: { current: string }) {
  const items = [
    { name: 'home', label: 'Today', path: '/', Icon: IconHome },
    { name: 'history', label: 'Progress', path: '/history', Icon: IconCalendar },
    { name: 'info', label: 'Tips', path: '/info', Icon: IconInfo },
    { name: 'settings', label: 'Settings', path: '/settings', Icon: IconSettings },
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto grid max-w-xl grid-cols-4">
        {items.map(({ name, label, path, Icon }) => {
          const active = current === name
          return (
            <button
              key={name}
              onClick={() => go(path)}
              className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon width={22} height={22} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
