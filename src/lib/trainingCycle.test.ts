import { describe, it, expect } from 'vitest'
import {
  meetsCriterion,
  findBoundary,
  startRungFromBoundary,
  suggestConcernsFromDiagnosis,
  allowStrongVariations,
  nextRung,
  sessionRungs,
  pickVariation,
  retentionVerdict,
  planTrackSwitch,
  pickFromPool,
  diagnosisSteps,
  rungReason,
  judgeStep,
  performanceCopy,
  dictionStartRung,
  type Measure,
} from './trainingCycle'
import { TRACKS, type RungLevel } from './curriculum'

function m(over: Partial<Measure> & { level?: RungLevel }): Measure {
  return {
    jitter_rel_pct: 1.0,
    shimmer_rel_pct: 3.0,
    jitter_source: 'praat',
    onsets_per_second: 4.0,
    db_mean: -24,
    duration_sec: 5,
    ...over,
  }
}

describe('meetsCriterion', () => {
  it('jitter: praat limit 3%, frame limit 50%', () => {
    expect(meetsCriterion('jitter', m({ jitter_rel_pct: 2.9 }))).toBe(true)
    expect(meetsCriterion('jitter', m({ jitter_rel_pct: 3.1 }))).toBe(false)
    expect(meetsCriterion('jitter', m({ jitter_rel_pct: 40, jitter_source: 'frame' }))).toBe(true)
    expect(meetsCriterion('jitter', m({ jitter_rel_pct: 60, jitter_source: 'frame' }))).toBe(false)
  })

  it('pace: 2.5–5.5 syllables/sec', () => {
    expect(meetsCriterion('pace', m({ onsets_per_second: 2.4 }))).toBe(false)
    expect(meetsCriterion('pace', m({ onsets_per_second: 4 }))).toBe(true)
    expect(meetsCriterion('pace', m({ onsets_per_second: 5.6 }))).toBe(false)
  })

  it('loudness: within 2 dB of baseline, default floor without baseline', () => {
    const base = m({ db_mean: -20 })
    expect(meetsCriterion('loudness', m({ db_mean: -21.5 }), base)).toBe(true)
    expect(meetsCriterion('loudness', m({ db_mean: -23 }), base)).toBe(false)
    expect(meetsCriterion('loudness', m({ db_mean: -29 }))).toBe(true)
    expect(meetsCriterion('loudness', m({ db_mean: -31 }))).toBe(false)
  })

  it('clarity: 95% of syllables heard, else the self judgement when nothing was measured', () => {
    expect(meetsCriterion('clarity', m({ clarity_pct: 96 }))).toBe(true)
    expect(meetsCriterion('clarity', m({ clarity_pct: 90 }), null, true)).toBe(false)
    expect(meetsCriterion('clarity', m({}))).toBeNull()
    expect(meetsCriterion('clarity', m({}), null, true)).toBe(true)
  })
})

describe('findBoundary / startRungFromBoundary', () => {
  it('returns the first rung that fails, in level order', () => {
    const ms = [
      m({ level: 4, jitter_rel_pct: 5 }),
      m({ level: 1, jitter_rel_pct: 1 }),
      m({ level: 3, jitter_rel_pct: 4 }),
      m({ level: 2, jitter_rel_pct: 1 }),
    ]
    expect(findBoundary('jitter', ms)).toBe(3)
    expect(startRungFromBoundary(3)).toBe(3)
  })

  it('returns null when every rung passes → start at 5', () => {
    const ms = [1, 2, 3, 4].map((l) => m({ level: l as RungLevel }))
    expect(findBoundary('jitter', ms)).toBeNull()
    expect(startRungFromBoundary(null)).toBe(5)
  })
})

describe('suggestConcernsFromDiagnosis', () => {
  it('puts measured problems first and diction last', () => {
    const ms = [
      m({ level: 1 }),
      m({ level: 2 }),
      m({ level: 3, jitter_rel_pct: 4 }),
      m({ level: 4, jitter_rel_pct: 4, onsets_per_second: 6.5 }),
    ]
    const s = suggestConcernsFromDiagnosis(ms)
    expect(s[0].concern).toBe('trembling')
    expect(s[0].boundary).toBe(3)
    expect(s[1].concern).toBe('fast')
    expect(s[1].boundary).toBe(4)
    expect(s[s.length - 1].concern).toBe('diction')
    expect(s).toHaveLength(4)
  })

  it('flags small_voice when the real sentence is much quieter than the hum', () => {
    const ms = [m({ level: 1, db_mean: -18 }), m({ level: 4, db_mean: -24 })]
    const s = suggestConcernsFromDiagnosis(ms)
    expect(s[0].concern).toBe('small_voice')
  })

  it('does not flag slow speech as the fast concern', () => {
    const ms = [m({ level: 1 }), m({ level: 2 }), m({ level: 3, onsets_per_second: 1.8 }), m({ level: 4, onsets_per_second: 2.0 })]
    expect(suggestConcernsFromDiagnosis(ms).find((x) => x.concern === 'fast')?.boundary).toBeNull()
    expect(diagnosisSteps('fast', ms)!.map((x) => x.state)).toEqual(['skip', 'skip', 'ok', 'ok'])
    expect(diagnosisSteps('fast', ms)![2].note).toBe('1초에 1.8글자 (기준 5.5글자 이하)')
  })

  it('ignores pace on rungs 1–2 (no syllables there)', () => {
    const ms = [m({ level: 1, onsets_per_second: 0.5 }), m({ level: 2, onsets_per_second: 0.8 }), m({ level: 3 }), m({ level: 4 })]
    const s = suggestConcernsFromDiagnosis(ms)
    expect(s.find((x) => x.concern === 'fast')?.boundary).toBeNull()
  })
})

describe('allowStrongVariations', () => {
  it('only when the baseline is clearly stable', () => {
    expect(allowStrongVariations(null)).toBe(false)
    expect(allowStrongVariations(m({ jitter_rel_pct: 1.5 }))).toBe(true)
    expect(allowStrongVariations(m({ jitter_rel_pct: 2.5 }))).toBe(false)
  })
})

describe('nextRung', () => {
  it('goes up on success with low effort', () => {
    expect(nextRung(3, { met: true, effort: 3, pain: false })).toBe(4)
  })
  it('stays on success with high effort (버티는 범위)', () => {
    expect(nextRung(3, { met: true, effort: 4, pain: false })).toBe(3)
  })
  it('stays on failure', () => {
    expect(nextRung(3, { met: false, effort: 2, pain: false })).toBe(3)
  })
  it('goes down on pain or effort 5 regardless of result', () => {
    expect(nextRung(3, { met: true, effort: 2, pain: true })).toBe(2)
    expect(nextRung(3, { met: true, effort: 5, pain: false })).toBe(2)
  })
  it('clamps to 1..6', () => {
    expect(nextRung(1, { met: false, effort: 5, pain: false })).toBe(1)
    expect(nextRung(6, { met: true, effort: 1, pain: false })).toBe(6)
  })
})

describe('sessionRungs', () => {
  it('A is one below, B is current, clamped at 1', () => {
    expect(sessionRungs(4)).toEqual({ a: 3, b: 4 })
    expect(sessionRungs(1)).toEqual({ a: 1, b: 1 })
  })
})

describe('pickVariation', () => {
  it('rotates through the list by session index', () => {
    const t = TRACKS.trembling
    expect(pickVariation(t, 0, true).id).toBe(t.variations[0].id)
    expect(pickVariation(t, 1, true).id).toBe(t.variations[1].id)
    expect(pickVariation(t, t.variations.length, true).id).toBe(t.variations[0].id)
  })
  it('uses only weak variations when strong ones are not allowed', () => {
    const t = TRACKS.trembling
    for (let i = 0; i < 8; i++) expect(pickVariation(t, i, false).strength).toBe(1)
  })
})

describe('retentionVerdict', () => {
  it('first when there is no previous session', () => {
    expect(retentionVerdict('jitter', null, m({}))).toBe('first')
  })
  it('clarity: compares heard-syllable rates, restarts after old self-judged records', () => {
    expect(retentionVerdict('clarity', m({ clarity_pct: 97 }), m({ clarity_pct: 96 }))).toBe('kept')
    expect(retentionVerdict('clarity', m({ clarity_pct: 97 }), m({ clarity_pct: 88 }))).toBe('reset')
    expect(retentionVerdict('clarity', m({}), m({ clarity_pct: 96 }))).toBe('rebase')
    expect(retentionVerdict('clarity', m({ clarity_pct: 97 }), m({}))).toBe('na')
  })
  it('jitter: kept within 15%, partly within 50%, else reset', () => {
    const prev = m({ jitter_rel_pct: 4 })
    expect(retentionVerdict('jitter', prev, m({ jitter_rel_pct: 4.5 }))).toBe('kept')
    expect(retentionVerdict('jitter', prev, m({ jitter_rel_pct: 5.5 }))).toBe('partly')
    expect(retentionVerdict('jitter', prev, m({ jitter_rel_pct: 7 }))).toBe('reset')
  })
  it('jitter: getting worse is not called kept just because it is under the limit', () => {
    expect(retentionVerdict('jitter', m({ jitter_rel_pct: 1 }), m({ jitter_rel_pct: 2.9 }))).toBe('reset')
  })
  it('jitter: differences within measurement noise count as kept', () => {
    expect(retentionVerdict('jitter', m({ jitter_rel_pct: 0.3 }), m({ jitter_rel_pct: 0.45 }))).toBe('kept')
  })
  it('jitter: a change of measurement source restarts the comparison', () => {
    expect(retentionVerdict('jitter', m({ jitter_rel_pct: 9, jitter_source: 'frame' }), m({ jitter_rel_pct: 2.7 }))).toBe('rebase')
  })
  it('loudness: within 2 dB kept, within 4 dB partly', () => {
    const prev = m({ db_mean: -20 })
    expect(retentionVerdict('loudness', prev, m({ db_mean: -21 }))).toBe('kept')
    expect(retentionVerdict('loudness', prev, m({ db_mean: -23 }))).toBe('partly')
    expect(retentionVerdict('loudness', prev, m({ db_mean: -26 }))).toBe('reset')
  })
  it('pace: compares distance from the range centre', () => {
    const prev = m({ onsets_per_second: 4.2 })
    expect(retentionVerdict('pace', prev, m({ onsets_per_second: 4.4 }))).toBe('kept')
    expect(retentionVerdict('pace', prev, m({ onsets_per_second: 4.9 }))).toBe('partly')
    expect(retentionVerdict('pace', prev, m({ onsets_per_second: 5.6 }))).toBe('reset')
  })
})

describe('planTrackSwitch', () => {
  const now = new Date('2026-10-20T00:00:00Z')
  const diag = (scene: string, created_at: string) => ({
    kind: 'diagnosis' as const, created_at, concern: 'fast' as const, scene, next_rung: 3 as const,
    rung_measures: [m({ level: 1 }), m({ level: 2 }), m({ level: 3, jitter_rel_pct: 4 }), m({ level: 4, jitter_rel_pct: 4, db_mean: -19 })],
  })
  const sess = (concern: 'fast' | 'trembling', scene: string, next: RungLevel) =>
    ({ kind: 'session' as const, created_at: '2026-10-19T00:00:00Z', concern, scene, next_rung: next, rung_measures: null })

  it('returning to a track resumes where it left off', () => {
    const p = planTrackSwitch('fast', 'interview', [sess('fast', 'interview', 5), diag('interview', '2026-10-18T00:00:00Z')], now)
    expect(p).toMatchObject({ kind: 'resume', rung: 5 })
  })
  it('switching concern in the same scene reuses a fresh diagnosis', () => {
    const p = planTrackSwitch('trembling', 'interview', [sess('fast', 'interview', 4), diag('interview', '2026-10-18T00:00:00Z')], now)
    expect(p).toMatchObject({ kind: 'reuse', rung: 3 })
    if (p.kind === 'reuse') expect(p.baseline?.db_mean).toBe(-19)
  })
  it('a diagnosis older than 14 days is suggested again but still gives a fallback rung', () => {
    const p = planTrackSwitch('trembling', 'interview', [diag('interview', '2026-10-01T00:00:00Z')], now)
    expect(p).toMatchObject({ kind: 'suggest-rediagnose', rung: 3, ageDays: 19 })
  })
  it('a scene never diagnosed requires a diagnosis, even if another scene has one', () => {
    expect(planTrackSwitch('fast', 'call', [sess('fast', 'interview', 4), diag('interview', '2026-10-18T00:00:00Z')], now))
      .toEqual({ kind: 'diagnose' })
  })
  it('diction is independent of diagnosis and starts at 4', () => {
    expect(planTrackSwitch('diction', 'call', [], now)).toMatchObject({ kind: 'reuse', rung: 4 })
  })
})

describe('pickFromPool', () => {
  it('returns undefined when pool empty', () => {
    expect(pickFromPool(undefined)).toBeUndefined()
    expect(pickFromPool([])).toBeUndefined()
  })
  it('returns an element from the pool', () => {
    const pool = ['a', 'b', 'c']
    expect(pool).toContain(pickFromPool(pool))
  })
})

describe('diagnosisSteps', () => {
  const ms = [
    m({ level: 1, db_mean: -18 }),
    m({ level: 2 }),
    m({ level: 3, jitter_rel_pct: 4 }),
    m({ level: 4, jitter_rel_pct: 4, onsets_per_second: 6.5, db_mean: -24 }),
  ]
  it('trembling marks each step with the same rule as the boundary', () => {
    const st = diagnosisSteps('trembling', ms)!
    expect(st.map((x) => x.state)).toEqual(['ok', 'ok', 'off', 'off'])
    expect(st.findIndex((x) => x.state === 'off') + 1).toBe(suggestConcernsFromDiagnosis(ms).find((s) => s.concern === 'trembling')!.boundary)
  })
  it('fast skips the sound-only steps', () => {
    expect(diagnosisSteps('fast', ms)!.map((x) => x.state)).toEqual(['skip', 'skip', 'ok', 'off'])
  })
  it('small voice compares the real sentence with the hum only', () => {
    expect(diagnosisSteps('small_voice', ms)!.map((x) => x.state)).toEqual(['base', 'skip', 'skip', 'off'])
  })
  it('notes show the measured number with the criterion', () => {
    expect(diagnosisSteps('trembling', ms)![1].note).toBe('떨림 1.0% (기준 3% 이하)')
    expect(diagnosisSteps('trembling', ms)![2].note).toBe('떨림 4.0% (기준 3% 초과)')
    expect(diagnosisSteps('small_voice', ms)![3].note).toBe('허밍보다 6dB 작음 (기준 4dB 초과)')
    expect(suggestConcernsFromDiagnosis(ms).find((x) => x.concern === 'trembling')!.reason).toBe('3단계부터 떨림이 기준(3%)을 넘었어요.')
  })
  it('diction has no measured steps', () => {
    expect(diagnosisSteps('diction', ms)).toBeNull()
  })
})

describe('rungReason', () => {
  const last = (o: Partial<{ rung: RungLevel; next_rung: RungLevel; met_criterion: boolean | null; effort: number; pain: boolean }>) =>
    ({ rung: 3 as RungLevel, next_rung: 3 as RungLevel, met_criterion: null, effort: 2, pain: false, ...o })
  it('first session explains the diagnosis', () => {
    expect(rungReason('trembling', 3, null)).toBe('진단에서 3단계부터 떨림이 기준을 넘었어요. 여기서부터 연습해요.')
    expect(rungReason('fast', 5, null)).toContain('4단계까지 기준 안이었어요')
    expect(rungReason('diction', 4, null)).toContain('4단계부터')
  })
  it('later sessions explain the move from last time', () => {
    expect(rungReason('trembling', 4, last({ rung: 3, next_rung: 4, met_criterion: true }))).toContain('올라왔어요')
    expect(rungReason('trembling', 2, last({ rung: 3, next_rung: 2, pain: true }))).toContain('아팠어요')
    expect(rungReason('trembling', 2, last({ rung: 3, next_rung: 2, effort: 5 }))).toContain('힘들었어요')
    expect(rungReason('trembling', 3, last({ met_criterion: true, effort: 4 }))).toContain('한 번 더')
    expect(rungReason('trembling', 3, last({ met_criterion: false }))).toContain('같은 단계')
  })
  it('falls back to the diagnosis when the last session did not set this step', () => {
    expect(rungReason('trembling', 2, last({ rung: 4, next_rung: 4 }))).toContain('진단에서 2단계부터')
  })
  it('copy avoids middle dots', () => {
    const all = [rungReason('small_voice', 4, null), ...['trembling', 'fast', 'small_voice'].flatMap((c) => diagnosisSteps(c as 'trembling', [m({ level: 1 }), m({ level: 4 })])!.map((x) => x.note))]
    expect(all.join(' ')).not.toMatch(/\u00B7/)
  })
})

describe('judgeStep', () => {
  const base = { diagnosis: null, baseline: null, selfOk: null }
  it('judges on the challenge recording, not the final base sentence', () => {
    const r = judgeStep({ ...base, metric: 'jitter', rung: 5, challenge: m({ level: 5, jitter_rel_pct: 4 }), final: m({ level: 4, jitter_rel_pct: 1 }) })
    expect(r).toMatchObject({ met: false, on: 'challenge' })
  })
  it('pace on hum and vowel steps falls back to the final recording', () => {
    const r = judgeStep({ ...base, metric: 'pace', rung: 1, challenge: m({ level: 1, onsets_per_second: 0.3 }), final: m({ onsets_per_second: 4 }) })
    expect(r).toMatchObject({ met: true, on: 'final' })
    expect(judgeStep({ ...base, metric: 'pace', rung: 4, challenge: m({ onsets_per_second: 6.2 }), final: m({ onsets_per_second: 4 }) }).met).toBe(false)
  })
  it('loudness compares with the same step from the diagnosis', () => {
    const diagnosis = [m({ level: 1, db_mean: -32 }), m({ level: 4, db_mean: -22 })]
    // 허밍 -33dB: 진단 허밍(-32)과 비교하면 통과, 4단계(-22)와 비교했다면 실패였다
    expect(judgeStep({ ...base, metric: 'loudness', rung: 1, diagnosis, challenge: m({ level: 1, db_mean: -33 }), final: null }).met).toBe(true)
    expect(judgeStep({ ...base, metric: 'loudness', rung: 5, diagnosis, challenge: m({ level: 5, db_mean: -26 }), final: null }).met).toBe(false)
  })
  it('diction judges the heard-syllable rate of the challenge, falling back to the self answer', () => {
    expect(judgeStep({ ...base, metric: 'clarity', rung: 4, selfOk: true, challenge: m({ clarity_pct: 80 }), final: m({}) })).toMatchObject({ met: false, on: 'challenge' })
    expect(judgeStep({ ...base, metric: 'clarity', rung: 2, selfOk: true, challenge: m({}), final: m({}) })).toMatchObject({ met: true, on: 'challenge' })
  })
  it('result copy names what was judged', () => {
    expect(performanceCopy(true, 6, 5, '오늘 도전(5단계)')).toBe('오늘 도전(5단계)이 기준 안이에요. 다음 연습은 한 단계 올라가요.')
  })
})

describe('diction in the diagnosis', () => {
  const base = [m({ level: 1 }), m({ level: 2 })]
  it('suggests diction and starts at the first step under 95%', () => {
    const ms = [...base, m({ level: 3, clarity_pct: 97 }), m({ level: 4, clarity_pct: 88 })]
    const s = suggestConcernsFromDiagnosis(ms).find((x) => x.concern === 'diction')!
    expect(s.boundary).toBe(4)
    expect(s.reason).toBe('4단계에서 알아들은 글자가 88%였어요. (기준 95% 이상)')
    expect(dictionStartRung(ms)).toBe(4)
    expect(diagnosisSteps('diction', ms)!.map((x) => x.state)).toEqual(['skip', 'skip', 'ok', 'off'])
  })
  it('all clear starts at step 5; not measured falls back to step 4', () => {
    expect(dictionStartRung([...base, m({ level: 3, clarity_pct: 98 }), m({ level: 4, clarity_pct: 96 })])).toBe(5)
    expect(dictionStartRung([...base, m({ level: 3 }), m({ level: 4 })])).toBe(4)
    expect(diagnosisSteps('diction', [...base, m({ level: 3 }), m({ level: 4 })])).toBeNull()
  })
  it('the reason line only claims a measured result when diction was measured', () => {
    expect(rungReason('diction', 4, null, [m({ level: 4 })])).toBe('발음은 실제 문장인 4단계부터 연습해요.')
    expect(rungReason('diction', 4, null, [m({ level: 4, clarity_pct: 88 })])).toContain('알아들은 글자가 기준보다 적었어요')
  })
})
