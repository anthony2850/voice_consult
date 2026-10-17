import { describe, it, expect } from 'vitest'
import { LADDER, SONORANT_SCRIPTS, SCENE_SCRIPTS, TRACKS, LEARNING_PRINCIPLES } from './curriculum'

const HANGUL_BASE = 0xac00
const ONSETS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const CODAS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const SONORANT = new Set(['ㄴ', 'ㄹ', 'ㅁ', 'ㅇ'])

function jamo(ch: string): { onset: string; coda: string } | null {
  const code = ch.charCodeAt(0) - HANGUL_BASE
  if (code < 0 || code > 11171) return null
  return { onset: ONSETS[Math.floor(code / 588)], coda: CODAS[code % 28] }
}

describe('ladder', () => {
  it('has six rungs in carrier-modulation order, each ending on a result line', () => {
    expect(LADDER.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6])
    for (const r of LADDER) {
      expect(r.instructions.at(-1)).toMatch(/성공/)
      expect(r.maxSec).toBeGreaterThan(0)
    }
  })

  it('uses the same base sentence on rung 2, rung 4 (retention/performance condition)', () => {
    for (const scene of Object.keys(SCENE_SCRIPTS) as (keyof typeof SCENE_SCRIPTS)[]) {
      expect(LADDER[1].script(scene, 0)).toBe(SCENE_SCRIPTS[scene].short)
      expect(LADDER[3].script(scene, 0)).toBe(SCENE_SCRIPTS[scene].short)
    }
  })
})

describe('sonorant scripts (rung 3)', () => {
  it('contain only ㄴ·ㄹ·ㅁ·ㅇ onsets and codas — nothing that breaks the carrier', () => {
    for (const s of SONORANT_SCRIPTS) {
      for (const ch of s) {
        const j = jamo(ch)
        if (!j) continue
        expect(SONORANT.has(j.onset), `${s} → onset ${j.onset} in "${ch}"`).toBe(true)
        if (j.coda) expect(SONORANT.has(j.coda), `${s} → coda ${j.coda} in "${ch}"`).toBe(true)
      }
    }
  })
})

describe('wording (8교시 4부 · 5교시 48쪽)', () => {
  const texts = [
    ...LADDER.flatMap((r) => r.instructions),
    ...Object.values(TRACKS).flatMap((t) => [t.keyInfo, t.goal, t.lastWord, ...t.variations.flatMap((v) => [v.change, v.hold, v.observe])]),
    ...LEARNING_PRINCIPLES.flatMap((p) => [p.title, p.body]),
  ]
  it('has no prohibitions', () => {
    for (const t of texts) expect(t, t).not.toMatch(/마세요|말고|하지 않|않도록|금지/)
  })
  it('has no internal-focus anatomy cues', () => {
    for (const t of texts) expect(t, t).not.toMatch(/후두|성대|횡격막|복식|배에 힘/)
  })
})
