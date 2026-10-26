import { describe, it, expect } from 'vitest'
import { weekOf, weeklyTrend, distanceToTarget, trendVerdict, type TrendSession } from './trainingTrend'
import type { Measure } from './trainingCycle'

function m(over: Partial<Measure>): Measure {
  return { jitter_rel_pct: 1.5, shimmer_rel_pct: 3, jitter_source: 'praat', onsets_per_second: 4, db_mean: -24, duration_sec: 5, ...over }
}
function s(date: string, start: Partial<Measure> | null, end: Partial<Measure> | null = null, extra: Partial<TrendSession> = {}): TrendSession {
  return { created_at: `${date}T12:00:00`, retention: start ? m(start) : null, performance: end ? m(end) : null, voice_use: 'normal', met_criterion: null, ...extra }
}

describe('weekOf', () => {
  it('maps any day to that week’s Monday (Sunday belongs to the previous week)', () => {
    expect(weekOf('2026-10-14T12:00:00')).toBe('2026-10-12') // Wed
    expect(weekOf('2026-10-12T12:00:00')).toBe('2026-10-12') // Mon
    expect(weekOf('2026-10-18T12:00:00')).toBe('2026-10-12') // Sun
  })
})

describe('weeklyTrend', () => {
  it('uses the weekly median of start recordings, separately from end recordings', () => {
    const pts = weeklyTrend('jitter', [
      s('2026-10-12', { jitter_rel_pct: 6 }, { jitter_rel_pct: 3 }),
      s('2026-10-13', { jitter_rel_pct: 3 }, { jitter_rel_pct: 3 }),
      s('2026-10-14', { jitter_rel_pct: 4.5 }, { jitter_rel_pct: 2.4 }),
      s('2026-10-20', { jitter_rel_pct: 3 }, null),
    ])
    expect(pts.map((p) => p.week)).toEqual(['2026-10-12', '2026-10-19'])
    expect(pts[0].start).toBeCloseTo(1.5) // median 4.5% / 3%
    expect(pts[0].end).toBeCloseTo(1.0)
    expect(pts[0].sessions).toBe(3)
    expect(pts[1].end).toBeNull()
  })

  it('clarity: weekly median of heard-syllable rates, skipping records without one', () => {
    const pts = weeklyTrend('clarity', [
      s('2026-10-12', { clarity_pct: 90 }, null),
      s('2026-10-13', { clarity_pct: 96 }, null),
      s('2026-10-14', { clarity_pct: 94 }, null),
      s('2026-10-15', {}, null),
    ])
    expect(pts[0].start).toBeCloseTo(94)
  })
})

describe('distanceToTarget', () => {
  it('is zero inside the band and grows outside it', () => {
    expect(distanceToTarget('jitter', 0.8, null)).toBe(0)
    expect(distanceToTarget('jitter', 1.4, null)).toBeCloseTo(0.4)
    expect(distanceToTarget('pace', 6.0, null)).toBeCloseTo(0.5)
    expect(distanceToTarget('pace', 2.0, null)).toBeCloseTo(0.5)
    expect(distanceToTarget('loudness', -25, m({ db_mean: -20 }))).toBeCloseTo(3)
  })
})

describe('trendVerdict', () => {
  const two = (a: number, b: number) => [
    { week: 'w1', start: a, end: null, sessions: 2 },
    { week: 'w2', start: b, end: null, sessions: 2 },
  ]
  it('needs at least 3 sessions and 2 weeks', () => {
    expect(trendVerdict('jitter', two(2, 1), 2, null)).toBe('too-few')
    expect(trendVerdict('jitter', two(2, 1).slice(0, 1), 4, null)).toBe('one-week')
  })
  it('closer when the latest week is meaningfully nearer the target', () => {
    expect(trendVerdict('jitter', two(1.8, 1.2), 4, null)).toBe('closer')
  })
  it('flat when the change is within noise, or further away', () => {
    expect(trendVerdict('jitter', two(1.5, 1.48), 4, null)).toBe('flat')
    expect(trendVerdict('jitter', two(1.2, 1.6), 4, null)).toBe('flat')
  })
  it('both-in when every week is inside the target', () => {
    expect(trendVerdict('pace', two(4, 4.5), 4, null)).toBe('both-in')
  })
})
