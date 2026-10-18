/**
 * 훈련 탭 첫 화면의 "내 트랙" 목록 — 순수 함수.
 * 트랙 = 상황 × 고민. 진단이나 세션 기록이 하나라도 있으면 해 본 트랙이다.
 */
import type { ConcernSlug, RungLevel, Scene } from './curriculum'

export interface TrackRow {
  kind: 'diagnosis' | 'session'
  created_at: string
  concern: ConcernSlug | null
  scene: Scene | null
  rung: RungLevel | null
  next_rung: RungLevel | null
}

export interface TrackSummary {
  scene: Scene
  concern: ConcernSlug
  rung: RungLevel
  /** 진단을 뺀 세션 수 */
  sessions: number
  lastAt: string | null
  current: boolean
}

export interface CurrentTrack {
  scene: Scene | null
  concern: ConcernSlug | null
  rung: RungLevel | null
}

/** 지금 트랙이 맨 앞, 나머지는 최근에 한 순서. rows는 최신순. */
export function listTracks(rows: TrackRow[], current: CurrentTrack): TrackSummary[] {
  const byKey = new Map<string, TrackSummary>()
  for (const r of rows) {
    if (!r.scene || !r.concern) continue
    const key = `${r.scene}:${r.concern}`
    const t = byKey.get(key)
    if (!t) {
      byKey.set(key, {
        scene: r.scene, concern: r.concern,
        rung: r.next_rung ?? r.rung ?? 1,
        sessions: r.kind === 'session' ? 1 : 0,
        lastAt: r.created_at,
        current: false,
      })
    } else if (r.kind === 'session') {
      t.sessions++
    }
  }

  if (current.scene && current.concern) {
    const key = `${current.scene}:${current.concern}`
    const t = byKey.get(key) ?? { scene: current.scene, concern: current.concern, rung: 1 as RungLevel, sessions: 0, lastAt: null, current: true }
    t.current = true
    if (current.rung) t.rung = current.rung
    byKey.set(key, t)
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1
    return (b.lastAt ?? '').localeCompare(a.lastAt ?? '')
  })
}

/** "오늘", "어제", "3일 전" */
export function relativeDay(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '아직 안 함'
  const d = new Date(iso)
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff <= 0) return '오늘'
  if (diff === 1) return '어제'
  return `${diff}일 전`
}
