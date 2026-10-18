import type { AudioFeatures } from '@/lib/extractAudioFeatures'
import type { ConcernSlug } from '@/lib/curriculum'

// ── Score calculations ─────────────────────────────────────
function remapTo60(raw: number): number {
  return Math.round(60 + (Math.max(0, Math.min(100, raw)) / 100) * 40)
}

export function calcStabilityScore(vq: AudioFeatures['voice_quality']): number {
  // Praat = cycle-to-cycle (clinical: jitter ≤ 3%, shimmer ≤ 6% ≈ steady voice).
  // Frame = browser fallback, frame-to-frame (46 ms hop) — captures prosody
  // on top of tremor, so values run ~10× higher than clinical (calm announcer
  // sample measures ~21% / ~30%). Thresholds scale accordingly.
  const [jMax, sMax] = vq.source === 'praat' ? [3.0, 6.0] : [50.0, 70.0]
  const j = Math.max(0, 1 - vq.jitter_rel_pct / jMax) * 100
  const s = Math.max(0, 1 - vq.shimmer_rel_pct / sMax) * 100
  return remapTo60(j * 0.5 + s * 0.5)
}

export function calcPaceScore(opsec: number): number {
  const optimal = 4.5
  const sigma = 1.8
  const raw = 100 * Math.exp(-0.5 * Math.pow((opsec - optimal) / sigma, 2))
  return remapTo60(raw)
}

export function calcExpressivenessScore(stdHz: number, dbMean: number): number {
  // 실제 발화 pitch std 분포: 10~60Hz, dbMean: -40~-10dB
  const pitchVar = Math.min(100, (stdHz / 50) * 100)
  const dbScore = Math.min(100, Math.max(0, ((dbMean + 40) / 30) * 100))
  return remapTo60(pitchVar * 0.6 + dbScore * 0.4)
}

export interface VoiceScores {
  stability: number
  pace: number
  expressiveness: number
}

export function calcVoiceScores(f: AudioFeatures): VoiceScores {
  return {
    stability: calcStabilityScore(f.voice_quality),
    pace: calcPaceScore(f.rhythm.onsets_per_second),
    expressiveness: calcExpressivenessScore(f.pitch.std_hz, f.energy.db_mean),
  }
}

/** Scores under this are flagged as a concern worth training. */
export const CONCERN_THRESHOLD = 75

export function suggestConcerns(s: VoiceScores): ConcernSlug[] {
  const out: ConcernSlug[] = []
  if (s.stability < CONCERN_THRESHOLD) out.push('trembling')
  if (s.pace < CONCERN_THRESHOLD) out.push('fast')
  if (s.expressiveness < CONCERN_THRESHOLD) out.push('small_voice')
  return out
}

// ── Labels ─────────────────────────────────────────────────
export function getStabilityDesc(score: number): string {
  if (score >= 80) return '떨림이 거의 없고 균일한 목소리예요'
  if (score >= 60) return '대체로 안정적인 목소리예요'
  if (score >= 40) return '목소리에 약간의 흔들림이 있어요'
  return '목소리 떨림이 다소 두드러져요'
}

export function getPaceDesc(score: number, opsec: number): string {
  if (opsec < 2.5) return '말하는 속도가 다소 느린 편이에요'
  if (opsec > 6.5) return '말하는 속도가 다소 빠른 편이에요'
  if (score >= 80) return '듣기 좋은 여유 있는 속도예요'
  if (score >= 60) return '전반적으로 괜찮은 전달 속도예요'
  return '속도 조절에 약간 여유가 필요해요'
}

export function getExpressivenessDesc(score: number): string {
  if (score >= 80) return '에너지 넘치고 표현력이 풍부해요'
  if (score >= 60) return '적절한 생동감이 느껴져요'
  if (score >= 40) return '약간의 음성 변화가 있어요'
  return '다소 단조로운 목소리 톤이에요'
}

export function getPitchToneLabel(hz: number): string {
  if (hz <= 220) return '낮은 편'
  if (hz <= 349) return '중간인 편'
  return '높은 편'
}

