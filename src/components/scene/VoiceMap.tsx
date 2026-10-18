import { getPersona, sceneInk, type PersonaId } from '@/lib/personas'

/**
 * 에너지(세로) × 기분(가로) 지도에 내 점을 찍는다.
 * 위 = 들뜸, 아래 = 차분, 오른쪽 = 맑음, 왼쪽 = 흐림.
 */
export default function VoiceMap({ energy, mood, id, second }: {
  energy: number
  mood: number
  id: PersonaId
  second: PersonaId
}) {
  const p = getPersona(id)
  const s = getPersona(second)
  // 끝에 붙으면 점과 '나' 표시가 잘리므로 안쪽 여백 안에 둔다
  const inside = (x: number) => Math.min(88, Math.max(12, x))
  const left = `${inside(((mood + 1) / 2) * 100)}%`
  const top = `${inside(((1 - energy) / 2) * 100) - 4}%`
  return (
    <figure className="m-0">
      <div className="relative aspect-[4/3] w-full rounded-2xl bg-secondary/50 overflow-hidden" role="img"
        aria-label={`목소리 지도: 에너지 ${energy > 0 ? '들뜸' : '차분'}, 기분 ${mood > 0 ? '맑음' : '흐림'} 쪽. ${p.name}`}>
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" aria-hidden="true" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border" aria-hidden="true" />
        <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-muted-foreground">들뜸</span>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-muted-foreground">차분</span>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">흐림</span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">맑음</span>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
          style={{ left, top }}
        >
          <span className="block w-5 h-5 rounded-full border-[3px] border-white shadow" style={{ background: p.color }} />
          <span className="text-[11px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md bg-white/90" style={{ color: sceneInk(p.color) }}>나</span>
        </div>
      </div>
      <figcaption className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
        두 번째로 가까운 페르소나는 <span className="font-semibold text-foreground">{s.name}</span>이에요.
      </figcaption>
    </figure>
  )
}
