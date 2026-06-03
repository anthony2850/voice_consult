import { describe, it, expect } from 'vitest'
import {
  nextDayNum,
  currentCycle,
  isDeepDay,
  pickFromPool,
} from './trainingCycle'

describe('nextDayNum', () => {
  it('returns 1 when no logs', () => {
    expect(nextDayNum([])).toBe(1)
  })

  it('returns 2 after 1 log', () => {
    expect(nextDayNum([{ stage_num: 1, log_date: '2026-06-01' }])).toBe(2)
  })

  it('returns 5 after 4 logs', () => {
    const logs = [1, 2, 3, 4].map((n) => ({ stage_num: n, log_date: `2026-06-0${n}` }))
    expect(nextDayNum(logs)).toBe(5)
  })

  it('wraps from 5 to 1 after 5 logs (cycle complete)', () => {
    const logs = [1, 2, 3, 4, 5].map((n) => ({ stage_num: n, log_date: `2026-06-0${n}` }))
    expect(nextDayNum(logs)).toBe(1)
  })

  it('ignores stage_num values — only counts rows', () => {
    // Even if past logs are inconsistent (legacy old-system rows), count drives slot.
    const logs = [
      { stage_num: 99, log_date: '2026-05-01' },
      { stage_num: 99, log_date: '2026-05-02' },
    ]
    expect(nextDayNum(logs)).toBe(3)
  })
})

describe('currentCycle', () => {
  it('returns 1 when no logs', () => {
    expect(currentCycle([])).toBe(1)
  })

  it('returns 1 during first 5 sessions', () => {
    const logs = [1, 2, 3, 4].map((n) => ({ stage_num: n, log_date: `2026-06-0${n}` }))
    expect(currentCycle(logs)).toBe(1)
  })

  it('returns 2 on the 6th session (after completing cycle 1)', () => {
    const logs = [1, 2, 3, 4, 5].map((n) => ({ stage_num: n, log_date: `2026-06-0${n}` }))
    expect(currentCycle(logs)).toBe(2)
  })

  it('returns 3 after 10 sessions', () => {
    const logs = Array.from({ length: 10 }, (_, i) => ({
      stage_num: (i % 5) + 1,
      log_date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    }))
    expect(currentCycle(logs)).toBe(3)
  })
})

describe('isDeepDay', () => {
  it('false when concerns empty', () => {
    expect(isDeepDay(['trembling'], [])).toBe(false)
    expect(isDeepDay([], ['trembling'])).toBe(false)
  })

  it('true when any concern in user list matches day', () => {
    expect(isDeepDay(['trembling'], ['trembling'])).toBe(true)
    expect(isDeepDay(['small_voice'], ['small_voice', 'fast'])).toBe(true)
  })

  it('false when no overlap', () => {
    expect(isDeepDay(['diction'], ['fast'])).toBe(false)
  })
})

describe('pickFromPool', () => {
  it('returns undefined when pool empty', () => {
    expect(pickFromPool(undefined)).toBeUndefined()
    expect(pickFromPool([])).toBeUndefined()
  })

  it('returns an element from the pool', () => {
    const pool = ['a', 'b', 'c']
    const result = pickFromPool(pool)
    expect(pool).toContain(result)
  })
})
