import { describe, it, expect } from 'vitest'
import type { AudioFeatures } from './voiceDB'
import { PERSONAS } from './personas'
import {
  SCENE_EMOTIONS, acousticZ, decodeScene, encodeScene, energyScore, moodScore, parseSceneResult,
  pickScene, whySentence,
} from './voiceScene'

/** gpt-audio처럼 대부분 0으로 두고 일부만 올린다 */
function emo(over: Record<string, number>): Record<string, number> {
  return { ...Object.fromEntries(SCENE_EMOTIONS.map((k) => [k, 0])), ...over }
}

/** pitchCV, 말 속도, 세기 변동만 정한 음향 특징 */
function feat(o: { cv?: number; rate?: number; rms?: number; jitter?: number }): AudioFeatures {
  // rate = onsets_per_second (음절/초)
  return {
    duration_sec: 10, sample_rate: 16000,
    pitch: { mean_hz: 200, min_hz: 100, max_hz: 300, std_hz: 200 * (o.cv ?? 0.18), voiced_ratio: 0.6 },
    energy: { rms_mean: 0.1, rms_std: 0.1 * (o.rms ?? 1.0), db_mean: -25, db_max: -10, db_min: -50, db_range: 40 },
    spectral: { centroid_mean_hz: 0, centroid_std_hz: 0, bandwidth_mean_hz: 0, rolloff_mean_hz: 0, flatness_mean: 0, contrast_mean_db: 0 },
    mfccs: {}, zero_crossing: { mean: 0, std: 0 },
    rhythm: { tempo_bpm: 0, onset_count: 0, onsets_per_second: o.rate ?? 4.5 },
    voice_quality: { jitter_abs_ms: 0, jitter_rel_pct: o.jitter ?? 2.1, shimmer_abs: 0, shimmer_rel_pct: 3, source: 'praat' },
    hnr_db: 15,
  }
}

const ENERGETIC = feat({ cv: 0.28, rate: 6.0, rms: 1.3 })
const CALM = feat({ cv: 0.12, rate: 3.3, rms: 0.85 })

describe('SCENE_EMOTIONS', () => {
  it('asks the model for 22 emotions, covering every scene signature', () => {
    expect(SCENE_EMOTIONS).toHaveLength(22)
    for (const p of PERSONAS) for (const e of p.signature) expect(SCENE_EMOTIONS).toContain(e)
  })
})

describe('axes', () => {
  it('energy rises with fast, wide, dynamic speech and falls with calm speech', () => {
    const e = emo({})
    expect(energyScore(e, acousticZ(ENERGETIC))).toBeGreaterThan(0.3)
    expect(energyScore(e, acousticZ(CALM))).toBeLessThan(-0.2)
  })
  it('falls back to the model when acoustics are missing', () => {
    expect(energyScore(emo({ Excitement: 0.8, Ecstasy: 0.6 }), null)).toBeGreaterThan(0)
    expect(energyScore(emo({ Tiredness: 0.8, Calmness: 0.7 }), null)).toBeLessThan(0)
  })
  it('mood is clear for joy and cloudy for tiredness or sadness', () => {
    expect(moodScore(emo({ Joy: 0.8, Contentment: 0.7, Love: 0.6 }))).toBeGreaterThan(0)
    expect(moodScore(emo({ Tiredness: 0.8, Sadness: 0.7, Boredom: 0.6, Joy: 0 }))).toBeLessThan(0)
  })
})

describe('pickScene', () => {
  it('concert: excited and energetic', () => {
    expect(pickScene(emo({ Excitement: 0.8, Ecstasy: 0.7, Triumph: 0.6, Joy: 0.7 }), ENERGETIC).id).toBe('concert')
  })
  it('puppy: adoring and energetic', () => {
    expect(pickScene(emo({ Adoration: 0.9, Love: 0.8, Joy: 0.7, Amusement: 0.6, Excitement: 0.4 }), ENERGETIC).id).toBe('puppy')
  })
  it('cafe-book: calm and contemplative', () => {
    expect(pickScene(emo({ Calmness: 0.8, Contemplation: 0.7, 'Aesthetic Appreciation': 0.6, Contentment: 0.4 }), CALM).id).toBe('cafe-book')
  })
  it('sunday: content and relieved', () => {
    expect(pickScene(emo({ Contentment: 0.8, Relief: 0.8, Calmness: 0.5, Contemplation: 0.1 }), CALM).id).toBe('sunday')
  })
  it('clock-out: tired and bored', () => {
    expect(pickScene(emo({ Tiredness: 0.8, Boredom: 0.7, Disappointment: 0.5, Joy: 0 }), CALM).id).toBe('clock-out')
  })
  it('3am: nostalgic and sad', () => {
    expect(pickScene(emo({ Nostalgia: 0.8, Sadness: 0.7, Contemplation: 0.6, Joy: 0 }), CALM).id).toBe('3am')
  })
  it('holiday: awkward and embarrassed, energetic', () => {
    expect(pickScene(emo({ Awkwardness: 0.8, Embarrassment: 0.7, Doubt: 0.6, Anxiety: 0.6, Joy: 0 }), ENERGETIC).id).toBe('holiday')
  })
  it('crush: romance with nerves, energetic', () => {
    expect(pickScene(emo({ Romance: 0.9, Excitement: 0.6, Anxiety: 0.7, Awkwardness: 0.6, Joy: 0, Calmness: 0 }), ENERGETIC).id).toBe('crush')
  })
  it('is deterministic and always names a different second scene', () => {
    const e = emo({ Excitement: 0.8, Joy: 0.7 })
    const a = pickScene(e, ENERGETIC), b = pickScene(e, ENERGETIC)
    expect(a).toEqual(b)
    expect(a.second).not.toBe(a.id)
  })
  it('explains with measured cues that match the scene', () => {
    const r = pickScene(emo({ Excitement: 0.8, Ecstasy: 0.7, Triumph: 0.6, Joy: 0.7 }), ENERGETIC)
    expect(r.cues.length).toBeGreaterThan(0)
    expect(r.cues.every((c) => ['fast', 'wide', 'strong', 'shaky', 'emotion'].includes(c.key))).toBe(true)
  })
})

describe('whySentence', () => {
  it('joins cues with -고 and ends with -서', () => {
    expect(whySentence({ id: 'concert', cues: [{ key: 'fast' }, { key: 'wide' }] }))
      .toBe('말이 빠르고 억양이 크게 출렁여서 콘서트 직관 중인 팬처럼 들려요.')
  })
  it('uses the right particle for emotion words', () => {
    expect(whySentence({ id: 'crush', cues: [{ key: 'emotion', emotion: 'Romance' }] }))
      .toBe('목소리에 설렘이 묻어나서 썸 타는 중인 사람처럼 들려요.')
    expect(whySentence({ id: 'clock-out', cues: [{ key: 'slow' }, { key: 'emotion', emotion: 'Tiredness' }] }))
      .toBe('말이 느긋하고 피곤함이 묻어나서 퇴근만 기다리는 신입사원처럼 들려요.')
  })
  it('has a plain fallback with no cues', () => {
    expect(whySentence({ id: 'sunday', cues: [] })).toBe('오늘 목소리는 일요일 아침 늦잠 자고 일어난 사람처럼 들려요.')
  })
})

describe('real model output', () => {
  it('a calm, content sample (gpt-audio, 2026-10-18) lands in calm, clear, not on the border', () => {
    const r = pickScene(emo({ Calmness: 0.5, Contemplation: 0.3, Excitement: 0.2, Contentment: 0.2, Joy: 0.1, 'Aesthetic Appreciation': 0.1 }), null)
    expect(r.energy).toBeLessThan(-0.1)
    expect(r.mood).toBeGreaterThan(0.1)
    expect(r.id).toBe('cafe-book')
  })
})

describe('share encoding', () => {
  it('round-trips a scene result', () => {
    const r = pickScene(emo({ Romance: 0.9, Anxiety: 0.7 }), ENERGETIC)
    expect(decodeScene(encodeScene(r))).toEqual(r)
  })
  it('rejects unknown scenes and junk', () => {
    expect(parseSceneResult({ id: 'nope', second: 'concert', energy: 0, mood: 0 })).toBeNull()
    expect(parseSceneResult(null)).toBeNull()
    expect(decodeScene('%%%')).toBeNull()
  })
  it('drops cue keys it does not know', () => {
    const r = parseSceneResult({ id: 'concert', second: 'puppy', energy: 2, mood: 0.2, cues: [{ key: 'fast' }, { key: 'x' }] })
    expect(r?.cues).toEqual([{ key: 'fast' }])
    expect(r?.energy).toBe(1)
  })
})
