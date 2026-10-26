import { describe, it, expect } from 'vitest'
import type { AudioFeatures } from './extractAudioFeatures'
import { calcExpressivenessScore, calcVoiceScores, suggestConcerns, getExpressivenessDesc } from './voiceScores'

function feat(o: { pitchMean?: number; pitchStd?: number; rmsMean?: number; rmsStd?: number; dbMean?: number } = {}): AudioFeatures {
  return {
    duration_sec: 20,
    pitch: { mean_hz: o.pitchMean ?? 150, min_hz: 100, max_hz: 250, std_hz: o.pitchStd ?? 27, voiced_ratio: 0.6 },
    energy: { rms_mean: o.rmsMean ?? 0.05, rms_std: o.rmsStd ?? 0.05, db_mean: o.dbMean ?? -30, db_max: -10, db_min: -60, db_range: 50 },
    rhythm: { onsets_per_second: 4.5, onset_count: 90 },
    voice_quality: { jitter_abs_ms: 0, jitter_rel_pct: 0.5, shimmer_abs: 0, shimmer_rel_pct: 3, source: 'praat' },
  } as unknown as AudioFeatures
}

describe('expressiveness', () => {
  it('does not change with phone distance (louder recording, same variation)', () => {
    const near = feat({ rmsMean: 0.2, rmsStd: 0.2, dbMean: -18 })
    const far = feat({ rmsMean: 0.02, rmsStd: 0.02, dbMean: -38 })
    expect(calcExpressivenessScore(near)).toBe(calcExpressivenessScore(far))
  })
  it('does not favor a higher voice with the same intonation', () => {
    const low = feat({ pitchMean: 120, pitchStd: 21.6 })
    const high = feat({ pitchMean: 220, pitchStd: 39.6 })
    expect(calcExpressivenessScore(low)).toBe(calcExpressivenessScore(high))
  })
  it('scores the reference as 80 and wider variation higher', () => {
    expect(calcExpressivenessScore(feat())).toBe(80)
    expect(calcExpressivenessScore(feat({ pitchStd: 40, rmsStd: 0.07 }))).toBeGreaterThan(80)
    expect(getExpressivenessDesc(80)).toBe('억양과 세기 변화가 적당해요')
  })
  it('never suggests the small voice track, even when flat', () => {
    const flat = calcVoiceScores(feat({ pitchStd: 6, rmsStd: 0.03 }))
    expect(flat.expressiveness).toBeLessThan(75)
    expect(suggestConcerns(flat)).not.toContain('small_voice')
  })
})
