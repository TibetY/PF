import { useEffect, useState } from 'react'
import { EXERCISE_BY_ID, type ExerciseId } from '../data/exercises'
import { BodyPreview, type PreviewSpec } from '../body/BodyModel'

/**
 * Dev-only preview route used to render docs/stretch-previews:
 *   #/preview/<exerciseId>?clip=hold&t=0.5&side=right&sex=female&yaw=30&pitch=8&dist=3&ty=0.85
 */
function parse(): { id: ExerciseId; sex: 'male' | 'female'; spec: PreviewSpec } {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  const q = new URLSearchParams(query)
  const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d)
  return {
    id: (path.split('/')[1] ?? 'pf-stretch') as ExerciseId,
    sex: q.get('sex') === 'male' ? 'male' : 'female',
    spec: {
      clip: (q.get('clip') as PreviewSpec['clip']) ?? 'hold',
      t: num('t', 0.5),
      side: q.get('side') === 'left' ? 'left' : 'right',
      view: { yaw: num('yaw', 30), pitch: num('pitch', 8), distance: num('dist', 3.2), targetY: num('ty', 0.85) },
    },
  }
}

export default function Preview() {
  const [state, setState] = useState(parse)
  useEffect(() => {
    const on = () => setState(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const ex = EXERCISE_BY_ID[state.id]
  return (
    <div className="fixed inset-0">
      <BodyPreview exercise={ex} sex={state.sex} spec={state.spec} />
    </div>
  )
}
