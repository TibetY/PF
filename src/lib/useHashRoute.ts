import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'exercise'; id: string }
  | { name: 'history' }
  | { name: 'info' }
  | { name: 'settings' }
  | { name: 'account' }
  | { name: 'report' }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'exercise' && parts[1]) return { name: 'exercise', id: parts[1] }
  if (parts[0] === 'history') return { name: 'history' }
  if (parts[0] === 'info') return { name: 'info' }
  if (parts[0] === 'settings') return { name: 'settings' }
  if (parts[0] === 'account') return { name: 'account' }
  if (parts[0] === 'report') return { name: 'report' }
  return { name: 'home' }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (path: string) => {
  window.location.hash = path
}
