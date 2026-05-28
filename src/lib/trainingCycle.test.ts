import { describe, it, expect } from 'vitest'
import {
  nextDayNum,
  isDeepDay,
  pickFromPool,
} from './trainingCycle'

describe('nextDayNum', () => {
  it('returns 1 when no logs', () => {
    expect(nextDayNum([])).toBe(1)
  })

  it('returns next day after last completed', () => {
    expect(nextDayNum([{ stage_num: 2, log_date: '2026-05-26' }])).toBe(3)
  })

  it('wraps from 5 to 1', () => {
    expect(nextDayNum([{ stage_num: 5, log_date: '2026-05-26' }])).toBe(1)
  })

  it('uses the most recent log by date', () => {
    const logs = [
      { stage_num: 5, log_date: '2026-05-20' },
      { stage_num: 2, log_date: '2026-05-26' },
    ]
    expect(nextDayNum(logs)).toBe(3)
  })

  it('caps invalid stage_num to range and returns Day 1', () => {
    expect(nextDayNum([{ stage_num: 99, log_date: '2026-05-26' }])).toBe(1)
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
