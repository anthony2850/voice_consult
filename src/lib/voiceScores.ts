import type { AudioFeatures } from '@/lib/extractAudioFeatures'
import type { ConcernSlug } from '@/lib/curriculum'
import { SCENE_REF } from '@/lib/voiceScene'

// ── Score calculations ─────────────────────────────────────
function remapTo60(raw: number): number {
  return Math.round(60 + (Math.max(0, Math.min(100, raw)) / 100) * 40)
}

export function calcStabilityScore(vq: AudioFeatures['voice_quality']): number {
  // Praat = cycle-to-cycle. 3%, 6%는 임상 기준이 아니라 앱 자체 추정치다.
  // 참고로 Praat 문서의 병적 경계는 jitter 1.04%, shimmer 3.81%("아~" 지속 모음 기준).
  // 경계값을 0점에 두는 지금 공식에 그 값을 그대로 넣으면 경계 안쪽인 사람도 낮게 나온다.
  // 실제 분포를 본 뒤 공식째 다시 정한다.
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

/** 표준편차 ÷ 평균. 값이 없으면 null */
function cv(std: number | undefined, mean: number | undefined): number | null {
  return mean && mean > 0 && Number.isFinite(std) ? std! / mean : null
}

/** 억양 출렁임과 세기 출렁임 (둘 다 평균 대비 비율) */
export function expressivenessCues(f: AudioFeatures): { pitchCV: number | null; rmsCV: number | null } {
  return { pitchCV: cv(f.pitch?.std_hz, f.pitch?.mean_hz), rmsCV: cv(f.energy?.rms_std, f.energy?.rms_mean) }
}

export function calcExpressivenessScore(f: AudioFeatures): number {
  // 페르소나 판정(voiceScene.ts)과 같은 상대값을 쓴다. 성별(음높이)과 폰 거리(음량)에 휘둘리지 않게.
  // 기준값은 SCENE_REF의 추정치. 기준과 같으면 raw 50, ±2 표준편차에서 100과 0.
  const { pitchCV, rmsCV } = expressivenessCues(f)
  const zs = [
    pitchCV == null ? null : (pitchCV - SCENE_REF.pitchCV.mean) / SCENE_REF.pitchCV.sd,
    rmsCV == null ? null : (rmsCV - SCENE_REF.rmsCV.mean) / SCENE_REF.rmsCV.sd,
  ].filter((x): x is number => x != null)
  const z = zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : 0
  return remapTo60(50 + z * 25)
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
    expressiveness: calcExpressivenessScore(f),
  }
}

/** Scores under this are flagged as a concern worth training. */
export const CONCERN_THRESHOLD = 75

export function suggestConcerns(s: VoiceScores): ConcernSlug[] {
  const out: ConcernSlug[] = []
  if (s.stability < CONCERN_THRESHOLD) out.push('trembling')
  if (s.pace < CONCERN_THRESHOLD) out.push('fast')
  // 표현력은 억양과 세기의 출렁임이라 목소리 크기와 상관없다. 작은 목소리는 훈련 진단에서 판단한다.
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
  // 점수 90 = 기준보다 1 표준편차 위, 70 = 1 표준편차 아래
  if (score >= 90) return '억양과 세기가 크게 출렁이는 편이에요'
  if (score >= 70) return '억양과 세기 변화가 적당해요'
  return '억양과 세기 변화가 적은 편이에요'
}

export function getPitchToneLabel(hz: number): string {
  if (hz <= 220) return '낮은 편'
  if (hz <= 349) return '중간인 편'
  return '높은 편'
}

