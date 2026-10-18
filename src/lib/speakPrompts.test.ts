import { describe, it, expect } from 'vitest'
import { SPEAK_CATEGORIES, pickPromptIndex } from './speakPrompts'

describe('SPEAK_CATEGORIES', () => {
  it('has four speaking modes, each tied to a different training scene', () => {
    expect(SPEAK_CATEGORIES.map((c) => c.id)).toEqual(['intro', 'explain', 'story', 'opinion'])
    expect(new Set(SPEAK_CATEGORIES.map((c) => c.scene)).size).toBe(4)
  })
  it('every category has four prompts with two or three hints', () => {
    for (const c of SPEAK_CATEGORIES) {
      expect(c.prompts).toHaveLength(4)
      for (const p of c.prompts) {
        expect(p.hints.length).toBeGreaterThanOrEqual(2)
        expect(p.hints.length).toBeLessThanOrEqual(3)
      }
    }
  })
  it('copy avoids middle dots and mood-setting prompts', () => {
    const all = SPEAK_CATEGORIES.flatMap((c) => [c.label, c.sub, ...c.prompts.flatMap((p) => [p.q, ...p.hints])]).join(' ')
    expect(all).not.toMatch(/\u00B7/)
    expect(all).not.toMatch(/웃겼던|짜증|슬펐던|화났던/)
  })
})

describe('pickPromptIndex', () => {
  it('never repeats the current prompt', () => {
    for (let k = 0; k < 4; k++) {
      expect(pickPromptIndex('story', k, () => k / 4 + 0.01)).not.toBe(k)
    }
  })
})
