/**
 * 아카이브 "개선 추이" — 순수 함수.
 *
 * - 추이는 시작 녹음(남아 있는 것)으로 그린다. 마무리 녹음은 연습 직후 효과라 따로 둔다 (9교시 1부).
 * - 회차가 아니라 주 단위 중앙값으로 묶는다. 쉬고 난 첫 시도, 컨디션, 마이크 위치의 흔들림을 줄인다
 *   (9교시 13쪽, 7교시 "같은 조건은 다시 오지 않는다").
 * - 비교는 목표까지의 거리로만 하고 색으로 좋고 나쁨을 칠하지 않는다 (4교시 24쪽).
 */
import type { Metric } from './curriculum'
import { CLARITY_MIN, JITTER_LIMIT, PACE_RANGE, DEFAULT_DB_FLOOR, metricValue, type Measure } from './trainingCycle'

/** 추이를 보여 주기 시작하는 최소 세션 수 */
export const TREND_MIN_SESSIONS = 3

export interface TrendSession {
  created_at: string
  retention: Measure | null
  performance: Measure | null
  voice_use: 'low' | 'normal' | 'high' | null
  met_criterion: boolean | null
}

export interface WeekPoint {
  /** 그 주 월요일 (YYYY-MM-DD) */
  week: string
  /** 시작 녹음 중앙값. self 지표는 "또렷했다" 비율(0~1). */
  start: number | null
  /** 마무리 녹음 중앙값 (self 지표는 null) */
  end: number | null
  sessions: number
}

function pad(n: number) { return String(n).padStart(2, '0') }

/** 로컬 날짜 기준 그 주 월요일 */
export function weekOf(iso: string): string {
  const d = new Date(iso)
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** 주 단위로 묶은 추이 (오래된 주 → 최근 주) */
export function weeklyTrend(metric: Metric, sessions: TrendSession[]): WeekPoint[] {
  const byWeek = new Map<string, TrendSession[]>()
  for (const s of sessions) {
    const k = weekOf(s.created_at)
    byWeek.set(k, [...(byWeek.get(k) ?? []), s])
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, ss]) => {
      // 값이 없는 녹음(발음 트랙의 예전 기록 등)은 빼고 중앙값을 낸다
      const vals = (ms: (Measure | null)[]) => ms.flatMap((m) => (m ? [metricValue(metric, m)] : [])).filter((v) => Number.isFinite(v))
      return {
        week,
        start: median(vals(ss.map((s) => s.retention))),
        end: median(vals(ss.map((s) => s.performance))),
        sessions: ss.length,
      }
    })
}

/**
 * 목표 범위 [low, high]. 차트의 띠와 거리 계산에 쓴다.
 * @param loudFloor 크기 목표의 바닥값 (trainingCycle의 loudnessFloor). 세션 성공 기준과 같은 값이어야 한다.
 */
export function targetBand(metric: Metric, loudFloor: number | null): [number, number] {
  switch (metric) {
    case 'jitter': return [0, 1]
    case 'pace': return [PACE_RANGE.min, PACE_RANGE.max]
    case 'loudness': return [loudFloor ?? DEFAULT_DB_FLOOR, Infinity]
    case 'clarity': return [CLARITY_MIN, 100]
  }
}

/** 목표 범위까지의 거리. 범위 안이면 0. */
export function distanceToTarget(metric: Metric, value: number, loudFloor: number | null): number {
  const [lo, hi] = targetBand(metric, loudFloor)
  if (value < lo) return lo - value
  if (value > hi) return value - hi
  return 0
}

/** 단위 차이를 흡수하는 "의미 있는 차이" */
const EPS: Record<Metric, number> = { jitter: 0.05, pace: 0.2, loudness: 1, clarity: 2 }

export type TrendVerdict = 'too-few' | 'one-week' | 'closer' | 'both-in' | 'flat'

export function trendVerdict(metric: Metric, points: WeekPoint[], totalSessions: number, loudFloor: number | null): TrendVerdict {
  if (totalSessions < TREND_MIN_SESSIONS) return 'too-few'
  const withStart = points.filter((p) => p.start != null)
  if (withStart.length < 2) return 'one-week'
  const first = distanceToTarget(metric, withStart[0].start!, loudFloor)
  const last = distanceToTarget(metric, withStart[withStart.length - 1].start!, loudFloor)
  if (first === 0 && last === 0) return 'both-in'
  if (last < first - EPS[metric]) return 'closer'
  return 'flat'
}

export function trendCopy(v: TrendVerdict, totalSessions: number): string {
  switch (v) {
    case 'too-few': return `연습을 ${TREND_MIN_SESSIONS}번 하면 추이가 보여요. 지금 ${totalSessions}번 했어요.`
    case 'one-week': return '한 주가 더 쌓이면 첫 주와 비교할 수 있어요.'
    case 'closer': return '첫 주보다 시작 녹음이 목표에 가까워졌어요. 연습이 쉬고 난 뒤에도 남아 있다는 뜻이에요.'
    case 'both-in': return '첫 주부터 지금까지 시작 녹음이 목표 안에 있어요. 다음 단계로 올라가며 조건을 늘려 볼 때예요.'
    case 'flat': return '아직 뚜렷한 변화는 없어요. 평평한 구간은 누구에게나 와요. 몇 주 단위로 길게 봐요.'
  }
}

/** 차트 y축 표시용 */
export function formatMetric(metric: Metric, v: number): string {
  if (metric === 'clarity') return `${Math.round(v)}%`
  if (metric === 'jitter') return v.toFixed(2)
  return v.toFixed(1)
}

/** jitter 정규화 기준을 화면에서 설명할 때 */
export const JITTER_NOTE = `떨림은 기준치(Praat ${JITTER_LIMIT.praat}%) 대비로 표시해요. 1.00 이하가 목표예요.`
