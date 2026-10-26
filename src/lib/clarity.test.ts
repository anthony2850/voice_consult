import { describe, it, expect, vi } from 'vitest'
vi.mock('./supabase', () => ({ getSupabase: () => ({}) }))
import { clarityPct, normalizeForClarity } from './clarity'

describe('clarity', () => {
  const script = '안녕하세요. 오늘 발표를 맡게 되었습니다.'
  it('ignores spacing and punctuation', () => {
    expect(normalizeForClarity('안녕하세요. / 오늘 발표를')).toBe('안녕하세요오늘발표를')
    expect(clarityPct(script, '안녕하세요 오늘 발표를 맡게 되었습니다')).toBe(100)
  })
  it('counts missing or wrong syllables', () => {
    // "발표를" → "발표" (한 글자 빠짐), "되었습니다" → "되었습니닫" (한 글자 틀림), 기준 17글자
    expect(clarityPct(script, '안녕하세요 오늘 발표 맡게 되었습니닫')).toBeCloseTo(88.2, 1)
  })
  it('nothing heard is zero, and a script without letters cannot be scored', () => {
    expect(clarityPct(script, '')).toBe(0)
    expect(clarityPct('~ ~', '아')).toBeNull()
  })
})
