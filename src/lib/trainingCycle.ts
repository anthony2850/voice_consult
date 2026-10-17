/**
 * 트랙 진행 규칙 — 순수 함수. UI와 DB를 모른다.
 *
 * - 성공 기준은 결과로만 판단한다 (8교시 34쪽). 방식은 기준에서 뺀다.
 * - 수행과 학습을 구분한다 (9교시 1부): 오늘 끝의 상승은 수행, 오늘 시작이
 *   지난 끝에 가까운 것이 학습(파지).
 * - 계단 진급은 "성공하면 다음" (9교시 7쪽) + 비용·통증 (4교시 행동경계).
 */
import type { AudioFeatures } from './extractAudioFeatures'
import type { ConcernSlug, Metric, RungLevel, Track, Variation } from './curriculum'
import { CONCERN_ORDER, MAX_RUNG } from './curriculum'

// ─── 측정값 ──────────────────────────────────────────────────────────────────

export interface Measure {
  level?: RungLevel
  jitter_rel_pct: number
  shimmer_rel_pct: number
  jitter_source: 'praat' | 'frame'
  onsets_per_second: number
  db_mean: number
  duration_sec: number
}

export function toMeasure(f: AudioFeatures, level?: RungLevel): Measure {
  return {
    level,
    jitter_rel_pct: f.voice_quality.jitter_rel_pct,
    shimmer_rel_pct: f.voice_quality.shimmer_rel_pct,
    jitter_source: f.voice_quality.source === 'praat' ? 'praat' : 'frame',
    onsets_per_second: f.rhythm.onsets_per_second,
    db_mean: f.energy.db_mean,
    duration_sec: f.duration_sec,
  }
}

// ─── 기준 ────────────────────────────────────────────────────────────────────

/** Praat = 주기별 jitter (임상 기준 3%). 브라우저 fallback은 프레임 단위라 ~10배 크다. */
export const JITTER_LIMIT = { praat: 3.0, frame: 50.0 } as const
export const PACE_RANGE = { min: 2.5, max: 5.5 } as const
/** 진단 때 기준 음량에서 이만큼 떨어지면 유지 실패로 본다. */
export const LOUDNESS_TOLERANCE_DB = 2
/** 기준 음량이 없을 때의 바닥값 */
export const DEFAULT_DB_FLOOR = -30

/** 지표를 세션 간 비교 가능한 값으로 바꾼다. jitter는 기준 대비 비율(1.0 = 기준선). */
export function metricValue(metric: Metric, m: Measure): number {
  switch (metric) {
    case 'jitter':
      return m.jitter_rel_pct / JITTER_LIMIT[m.jitter_source]
    case 'pace':
      return m.onsets_per_second
    case 'loudness':
      return m.db_mean
    case 'self':
      return 0
  }
}

export const METRIC_INFO: Record<Metric, { name: string; unit: string; lowerIsBetter: boolean }> = {
  jitter: { name: '떨림 (기준 대비)', unit: '×', lowerIsBetter: true },
  pace: { name: '초당 음절', unit: '/초', lowerIsBetter: false },
  loudness: { name: '평균 음량', unit: 'dB', lowerIsBetter: false },
  self: { name: '또렷함 (자가 판단)', unit: '', lowerIsBetter: false },
}

/**
 * 결과 기준 충족 여부. self 지표는 사용자의 답(selfOk)이 없으면 null.
 * @param baseline 진단 4단 측정 (loudness 기준)
 */
export function meetsCriterion(
  metric: Metric,
  m: Measure,
  baseline?: Measure | null,
  selfOk?: boolean | null,
): boolean | null {
  switch (metric) {
    case 'jitter':
      return m.jitter_rel_pct <= JITTER_LIMIT[m.jitter_source]
    case 'pace':
      return m.onsets_per_second >= PACE_RANGE.min && m.onsets_per_second <= PACE_RANGE.max
    case 'loudness': {
      const floor = baseline ? baseline.db_mean - LOUDNESS_TOLERANCE_DB : DEFAULT_DB_FLOOR
      return m.db_mean >= floor
    }
    case 'self':
      return selfOk == null ? null : selfOk
  }
}

// ─── 진단 ────────────────────────────────────────────────────────────────────

/**
 * 사다리를 오른 측정값 중 처음 기준을 벗어나는 계단 = 행동경계.
 * 모두 통과하면 null.
 */
export function findBoundary(metric: Metric, measures: Measure[], baseline?: Measure | null): RungLevel | null {
  const sorted = [...measures].filter((m) => m.level != null).sort((a, b) => a.level! - b.level!)
  for (const m of sorted) {
    if (meetsCriterion(metric, m, baseline) === false) return m.level!
  }
  return null
}

/** 경계에서 트랙의 시작 계단을 정한다. 경계가 없으면 5단(전체 답변)부터. */
export function startRungFromBoundary(boundary: RungLevel | null): RungLevel {
  return boundary ?? 5
}

export interface DiagnosisSuggestion {
  concern: ConcernSlug
  boundary: RungLevel | null
  reason: string
}

/**
 * 진단 측정값으로 고민을 제안한다. 측정 가능한 지표(떨림·속도)가 기준을 벗어난
 * 순서로 앞에 두고, 발음은 측정이 없으므로 항상 마지막에 둔다.
 * 음량은 절대값이 마이크 거리에 좌우되므로 진단에서는 1단과 4단의 차이로만 본다.
 */
export function suggestConcernsFromDiagnosis(measures: Measure[]): DiagnosisSuggestion[] {
  const out: DiagnosisSuggestion[] = []
  const byLevel = new Map(measures.filter((m) => m.level != null).map((m) => [m.level!, m]))

  const jitterBoundary = findBoundary('jitter', measures)
  if (jitterBoundary !== null) {
    out.push({ concern: 'trembling', boundary: jitterBoundary, reason: `${jitterBoundary}단에서 소리가 흔들리기 시작했어요.` })
  }

  const paceBoundary = findBoundary('pace', measures.filter((m) => (m.level ?? 0) >= 3))
  if (paceBoundary !== null) {
    out.push({ concern: 'fast', boundary: paceBoundary, reason: `${paceBoundary}단에서 속도가 범위를 벗어났어요.` })
  }

  const first = byLevel.get(1)
  const base = byLevel.get(4)
  if (first && base && base.db_mean < first.db_mean - 4) {
    out.push({ concern: 'small_voice', boundary: 4, reason: '허밍보다 실제 문장에서 소리가 작아졌어요.' })
  }

  for (const c of CONCERN_ORDER) {
    if (!out.some((s) => s.concern === c)) {
      out.push({
        concern: c,
        boundary: null,
        reason: c === 'diction' ? '발음은 귀로 판단해요. 녹음을 듣고 고를 수 있어요.' : '측정에서는 기준 안이었어요.',
      })
    }
  }
  return out
}

/** 진단 4단에서 흔들림이 크면 약한 변형만 쓴다 (8교시 30쪽). */
export function allowStrongVariations(baseline: Measure | null | undefined): boolean {
  if (!baseline) return false
  return metricValue('jitter', baseline) <= 0.6
}

// ─── 세션 ────────────────────────────────────────────────────────────────────

export interface SessionOutcome {
  met: boolean | null
  effort: 1 | 2 | 3 | 4 | 5
  pain: boolean
}

/**
 * 다음 계단. 통증이나 힘든 정도 5면 한 계단 내려가고(중단 범위),
 * 기준 충족 + 힘든 정도 3 이하면 올라간다(탐색 범위). 그 외는 유지(버티는 범위).
 */
export function nextRung(current: RungLevel, o: SessionOutcome): RungLevel {
  if (o.pain || o.effort >= 5) return Math.max(1, current - 1) as RungLevel
  if (o.met === true && o.effort <= 3) return Math.min(MAX_RUNG, current + 1) as RungLevel
  return current
}

/** 세션에서 연습할 두 계단: A = 성공 경험(한 계단 아래), B = 도전(현재 계단). */
export function sessionRungs(current: RungLevel): { a: RungLevel; b: RungLevel } {
  const a = Math.max(1, current - 1) as RungLevel
  return { a, b: current }
}

/** 변형은 목록에서 순서대로 고른다 — "그냥 매번 다르게"가 아니다 (6교시). */
export function pickVariation(track: Track, sessionIndex: number, allowStrong: boolean): Variation {
  const pool = allowStrong ? track.variations : track.variations.filter((v) => v.strength === 1)
  const list = pool.length > 0 ? pool : track.variations
  return list[((sessionIndex % list.length) + list.length) % list.length]
}

// ─── 파지 ────────────────────────────────────────────────────────────────────

export type RetentionVerdict = 'first' | 'kept' | 'partly' | 'reset' | 'na'

/**
 * 지난 세션 끝(prevEnd)과 오늘 시작(todayStart)을 비교해 무엇이 남았는지 판정한다.
 * 다음 날 첫 시도는 낮게 나오기 쉬우므로(9교시 13쪽) 여유를 둔다.
 */
export function retentionVerdict(
  metric: Metric,
  prevEnd: Measure | null | undefined,
  todayStart: Measure | null | undefined,
): RetentionVerdict {
  if (metric === 'self') return 'na'
  if (!prevEnd || !todayStart) return 'first'
  const prev = metricValue(metric, prevEnd)
  const now = metricValue(metric, todayStart)
  switch (metric) {
    case 'jitter': {
      if (now <= prev * 1.15 || now <= 1) return 'kept'
      if (now <= prev * 1.5) return 'partly'
      return 'reset'
    }
    case 'pace': {
      const center = (PACE_RANGE.min + PACE_RANGE.max) / 2
      const dPrev = Math.abs(prev - center)
      const dNow = Math.abs(now - center)
      if (dNow <= dPrev + 0.3) return 'kept'
      if (dNow <= dPrev + 0.8) return 'partly'
      return 'reset'
    }
    case 'loudness': {
      if (now >= prev - 2) return 'kept'
      if (now >= prev - 4) return 'partly'
      return 'reset'
    }
    default:
      return 'na'
  }
}

export type VoiceUse = 'low' | 'normal' | 'high'

/** 낙인 없는 문구 (4교시 24쪽). 학생 탓이 아니라 조건을 본다 (9교시 52쪽). */
export function retentionCopy(verdict: RetentionVerdict, voiceUse: VoiceUse): string {
  switch (verdict) {
    case 'first':
      return '첫 기준점이에요. 다음 세션 시작에서 오늘 끝과 비교해요.'
    case 'kept':
      return '지난 세션 끝의 상태가 남아 있어요. 이게 학습으로 남은 거예요.'
    case 'partly':
      return '일부가 남았어요. 다음 날 첫 시도는 낮게 나오기 쉬워요. 정상이에요. 세션 끝에 다시 올라오는지 봐요.'
    case 'reset':
      return voiceUse === 'high'
        ? '지난 세션 끝과 거리가 있어요. 오늘 목을 많이 썼다고 했죠. 그 영향일 가능성이 커요. 당신 탓이 아니라 조건의 문제예요.'
        : '지난 세션 끝과 거리가 있어요. 조건이 달랐을 수 있어요. 지금 상태이지 한계가 아니에요.'
    case 'na':
      return '발음은 귀로 판단해요. 녹음을 들어보고 글자가 구분되는지 보세요.'
  }
}

/** 세션 끝 문구: 오늘 끝의 상승을 "학습"이라 부르지 않는다 (9교시 6쪽). */
export function performanceCopy(met: boolean | null, next: RungLevel, current: RungLevel): string {
  const move = next > current ? '다음 세션은 한 계단 위에서 시작해요.'
    : next < current ? '다음 세션은 한 계단 아래에서 시작해요. 조건을 바꾸는 거예요.'
    : '다음 세션도 같은 계단에서 해요.'
  if (met === true) return `오늘 기준 안에 들어왔어요. 지금 올라간 건 워밍업일 수 있어요. 남았는지는 다음 세션 시작에서 봐요. ${move}`
  if (met === false) return `오늘은 기준 밖이었어요. 조건을 조금 바꿔서 다시 시도하는 게 다음 순서예요. ${move}`
  return `녹음을 들어보고 판단했어요. ${move}`
}

// ─── 공용 ────────────────────────────────────────────────────────────────────

/**
 * Random pick from a script/material pool. v1 = simple random.
 * Returns undefined for missing or empty pool.
 */
export function pickFromPool<T>(pool: readonly T[] | undefined): T | undefined {
  if (!pool || pool.length === 0) return undefined
  return pool[Math.floor(Math.random() * pool.length)]
}
