/**
 * 트랙 진행 규칙 — 순수 함수. UI와 DB를 모른다.
 *
 * - 성공 기준은 결과로만 판단한다 (8교시 34쪽). 방식은 기준에서 뺀다.
 * - 수행과 학습을 구분한다 (9교시 1부): 오늘 끝의 상승은 수행, 오늘 시작이
 *   지난 끝에 가까운 것이 학습(파지).
 * - 계단 진급은 "성공하면 다음" (9교시 7쪽) + 비용, 통증 (4교시 행동경계).
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
  jitter: { name: '목소리 떨림', unit: '', lowerIsBetter: true },
  pace: { name: '말 빠르기 (1초에 말한 글자 수)', unit: '글자/초', lowerIsBetter: false },
  loudness: { name: '목소리 크기', unit: 'dB', lowerIsBetter: false },
  self: { name: '발음 또렷함 (직접 판단)', unit: '', lowerIsBetter: false },
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
 * 진단 측정값으로 고민을 제안한다. 측정 가능한 지표(떨림, 속도)가 기준을 벗어난
 * 순서로 앞에 두고, 발음은 측정이 없으므로 항상 마지막에 둔다.
 * 음량은 절대값이 마이크 거리에 좌우되므로 진단에서는 1단과 4단의 차이로만 본다.
 */
export function suggestConcernsFromDiagnosis(measures: Measure[]): DiagnosisSuggestion[] {
  const out: DiagnosisSuggestion[] = []
  const byLevel = new Map(measures.filter((m) => m.level != null).map((m) => [m.level!, m]))

  const jitterBoundary = findBoundary('jitter', measures)
  if (jitterBoundary !== null) {
    out.push({ concern: 'trembling', boundary: jitterBoundary, reason: `${jitterBoundary}단계부터 목소리가 떨리기 시작했어요.` })
  }

  const paceBoundary = findBoundary('pace', measures.filter((m) => (m.level ?? 0) >= 3))
  if (paceBoundary !== null) {
    out.push({ concern: 'fast', boundary: paceBoundary, reason: `${paceBoundary}단계부터 말이 적당한 빠르기를 벗어났어요.` })
  }

  const first = byLevel.get(1)
  const base = byLevel.get(4)
  if (first && base && base.db_mean < first.db_mean - 4) {
    out.push({ concern: 'small_voice', boundary: 4, reason: '허밍보다 실제 문장을 말할 때 목소리가 많이 작아졌어요.' })
  }

  for (const c of CONCERN_ORDER) {
    if (!out.some((s) => s.concern === c)) {
      out.push({
        concern: c,
        boundary: null,
        reason: c === 'diction' ? '발음은 측정 대신 직접 들어 보고 판단해요.' : '녹음에서는 괜찮은 범위였어요.',
      })
    }
  }
  return out
}

export interface PastSession {
  kind: 'diagnosis' | 'session'
  created_at: string
  concern: ConcernSlug | null
  scene: string | null
  next_rung: RungLevel | null
  rung_measures: Measure[] | null
}

/** 진단을 다시 권하는 기준(일). 2주 트랙 길이에 맞춘다. */
export const DIAGNOSIS_FRESH_DAYS = 14

export type SwitchPlan =
  /** 하던 트랙으로 돌아옴 — 하던 단계부터 */
  | { kind: 'resume'; rung: RungLevel; baseline: Measure | null }
  /** 같은 상황의 최근 진단이 있음 — 그 결과로 시작 */
  | { kind: 'reuse'; rung: RungLevel; baseline: Measure | null }
  /** 같은 상황의 진단이 오래됨 — 다시 재 보길 권하되 건너뛸 수 있음 */
  | { kind: 'suggest-rediagnose'; rung: RungLevel; baseline: Measure | null; ageDays: number }
  /** 이 상황으로는 진단한 적 없음 — 문장이 달라 진단이 필요 */
  | { kind: 'diagnose' }

/**
 * 트랙(상황 × 고민)을 바꿀 때 무엇을 할지 정한다. sessions는 최신순.
 * 진단 한 번은 같은 녹음으로 네 고민을 모두 재므로 고민만 바꿀 때는 다시 하지 않는다.
 * 진단 2, 4단계는 상황의 문장을 쓰므로, 상황이 바뀌면 그 상황의 진단이 있어야 한다.
 */
export function planTrackSwitch(
  concern: ConcernSlug,
  scene: string,
  sessions: PastSession[],
  now: Date = new Date(),
): SwitchPlan {
  const diagnosis = sessions.find((s) => s.kind === 'diagnosis' && s.scene === scene && s.rung_measures && s.rung_measures.length > 0)
  const baseline = diagnosis?.rung_measures?.find((m) => m.level === 4) ?? null

  const sameTrack = sessions.find((s) => s.kind === 'session' && s.concern === concern && s.scene === scene && s.next_rung)
  if (sameTrack?.next_rung) return { kind: 'resume', rung: sameTrack.next_rung, baseline }

  if (concern === 'diction') return { kind: 'reuse', rung: 4, baseline }

  if (!diagnosis?.rung_measures) return { kind: 'diagnose' }

  const s = suggestConcernsFromDiagnosis(diagnosis.rung_measures).find((x) => x.concern === concern)
  const rung = startRungFromBoundary(s?.boundary ?? null)
  const ageDays = Math.floor((now.getTime() - new Date(diagnosis.created_at).getTime()) / 86_400_000)
  if (ageDays > DIAGNOSIS_FRESH_DAYS) return { kind: 'suggest-rediagnose', rung, baseline, ageDays }
  return { kind: 'reuse', rung, baseline }
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
      return '첫 기록이에요. 다음 세션의 시작 녹음을 오늘 마무리 녹음과 비교해요.'
    case 'kept':
      return '지난번 마무리 때의 목소리가 오늘 시작에도 그대로 나왔어요. 연습한 게 몸에 남은 거예요.'
    case 'partly':
      return '절반쯤 남아 있어요. 쉬고 난 뒤 첫 녹음은 원래 조금 낮게 나와요. 정상이에요. 오늘 마무리 녹음에서 다시 올라오는지 봐요.'
    case 'reset':
      return voiceUse === 'high'
        ? '지난번 마무리와 차이가 있어요. 오늘 목을 많이 썼다고 했죠. 그 영향일 가능성이 커요. 실력이 줄어든 게 아니에요.'
        : '지난번 마무리와 차이가 있어요. 컨디션이나 주변 환경이 달랐을 수 있어요. 실력이 줄어든 게 아니에요.'
    case 'na':
      return '발음은 직접 들어 보고 판단해요. 녹음에서 모든 글자를 알아들을 수 있는지 확인해 보세요.'
  }
}

/** 세션 끝 문구: 오늘 끝의 상승을 "학습"이라 부르지 않는다 (9교시 6쪽). */
export function performanceCopy(met: boolean | null, next: RungLevel, current: RungLevel): string {
  const move = next > current ? '다음 세션은 한 단계 올라가요.'
    : next < current ? '다음 세션은 한 단계 낮춰서 해요. 목을 쉬게 하면서 다시 다지는 거예요.'
    : '다음 세션도 같은 단계를 해요.'
  if (met === true) return `오늘 마무리 녹음이 목표 안에 들어왔어요. 다만 방금 연습해서 몸이 풀린 효과일 수 있어서, 실력으로 남았는지는 다음 세션 시작에서 확인해요. ${move}`
  if (met === false) return `오늘은 목표에 조금 못 미쳤어요. 말하는 방식을 조금 바꿔 같은 단계를 다시 해 보면 돼요. ${move}`
  return `녹음을 직접 듣고 판단했어요. ${move}`
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
