import Model from 'react-body-highlighter'
import { POSTERIOR, SVG_MUSCLE, type MuscleId } from './muscles'

type SvgMuscle = Parameters<typeof Model>[0] extends { data?: (infer D)[] } ? D extends { muscles: (infer M)[] } ? M : never : never

/** 2D fallback (no WebGL): the same muscle data on front and back body maps. */
export default function SvgBody({ primary, secondary, dark }: { primary: MuscleId[]; secondary: MuscleId[]; dark: boolean }) {
  const toSvg = (ms: MuscleId[]) => Array.from(new Set(ms.flatMap((m) => SVG_MUSCLE[m] ?? []))) as SvgMuscle[]
  const data = [
    { name: 'Also works', muscles: toSvg(secondary), frequency: 1 },
    { name: 'Main target', muscles: toSvg(primary), frequency: 2 },
  ]
  const views: ('anterior' | 'posterior')[] = primary.some((m) => POSTERIOR[m]) ? ['posterior', 'anterior'] : ['anterior', 'posterior']
  return (
    <div className="flex h-full items-center justify-center gap-4 p-4 pb-16">
      {views.map((v) => (
        <Model
          key={v}
          type={v}
          data={data}
          bodyColor={dark ? '#3b4652' : '#c9d1d9'}
          highlightedColors={['#ffa261', '#ee2a14']}
          style={{ height: '100%', maxHeight: 320, width: 'auto' }}
        />
      ))}
    </div>
  )
}
