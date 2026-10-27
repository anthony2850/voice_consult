'use client'

import { audioBlobToWav } from './audioToWav'
import { syllableRate } from './syllableRate'
import { trackEvent } from './analytics'

/**
 * 'praat'  — jitter/shimmer are cycle-to-cycle values from Modal/parselmouth,
 *            comparable to clinical baselines (jitter ≤ 3%, shimmer ≤ 6%).
 * 'frame'  — frame-to-frame (≈46 ms hop) approximation computed in the
 *            browser. Captures prosody on top of tremor, so values run
 *            ~10× higher than clinical thresholds.
 */
export type VoiceQualitySource = 'praat' | 'frame'

export interface AudioFeatures {
  duration_sec: number
  sample_rate: number
  pitch: { mean_hz: number; min_hz: number; max_hz: number; std_hz: number; voiced_ratio: number }
  energy: { rms_mean: number; rms_std: number; db_mean: number; db_max: number; db_min: number; db_range: number }
  spectral: { centroid_mean_hz: number; centroid_std_hz: number; bandwidth_mean_hz: number; rolloff_mean_hz: number; flatness_mean: number; contrast_mean_db: number }
  mfccs: Record<string, number>
  zero_crossing: { mean: number; std: number }
  rhythm: { tempo_bpm: number; onset_count: number; onsets_per_second: number; articulation_rate?: number }
  voice_quality: {
    jitter_abs_ms: number
    jitter_rel_pct: number
    shimmer_abs: number
    shimmer_rel_pct: number
    source: VoiceQualitySource
    /** 떨림을 잰 구간. 'vowel' = 지속 모음 "아~", 'speech' = 문단 읽기 (예전 기록은 없음) */
    task?: 'vowel' | 'speech'
  }
  hnr_db: number
}

function arrMean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
}

function arrStd(arr: number[], mu?: number): number {
  if (arr.length < 2) return 0
  const m = mu ?? arrMean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

// Simple decimation (no anti-aliasing — sufficient for pitch detection)
function downsample(data: Float32Array, factor: number): Float32Array {
  const out = new Float32Array(Math.floor(data.length / factor))
  for (let i = 0; i < out.length; i++) out[i] = data[i * factor]
  return out
}

// Autocorrelation-based pitch detection for a single frame.
// Uses proper normalized autocorrelation (bounded [-1,1]) to avoid
// bias toward short lags that caused spurious high-pitch detections.
// Returns f0 in Hz, or null if unvoiced.
function detectPitchFrame(frame: Float32Array, sr: number): number | null {
  const n = frame.length
  const minLag = Math.floor(sr / 500) // 500 Hz upper limit (conservative)
  const maxLag = Math.min(Math.floor(sr / 60), n - 1) // 60 Hz lower limit

  // Silence gate
  let r0 = 0
  for (let i = 0; i < n; i++) r0 += frame[i] * frame[i]
  if (r0 < 1e-7) return null

  let bestNorm = 0.45 // raised voiced threshold (was 0.25)
  let bestLag = -1

  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0, ex = 0, es = 0
    for (let i = 0; i < n - lag; i++) {
      ac += frame[i] * frame[i + lag]
      ex += frame[i] * frame[i]
      es += frame[i + lag] * frame[i + lag]
    }
    // Normalized autocorrelation: bounded [-1, 1], no lag-length bias
    const denom = Math.sqrt(ex * es)
    if (denom < 1e-10) continue
    const norm = ac / denom
    if (norm > bestNorm) {
      bestNorm = norm
      bestLag = lag
    }
  }

  // 가장 짧은 지연(500Hz)에서 최대면 봉우리가 아니라 저음 잡음(에어컨, 바람 소리)이 이어진 것이다
  return bestLag > minLag ? sr / bestLag : null
}

/** 목소리가 이만큼(초) 잡히지 않으면 분석하지 않는다. 무음이나 잡음만 있는 녹음이 "떨림 0%" 같은 결과로 통과하지 않게. */
export const MIN_VOICED_SEC = 0.5

// Remove outliers via IQR before computing pitch statistics
function filterPitchOutliers(f0s: number[]): number[] {
  if (f0s.length < 8) return f0s
  const sorted = [...f0s].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  return f0s.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr)
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1)
  return sorted[idx]
}

/** 녹음 하나의 음향 수치. 디코딩에 실패하거나 목소리가 MIN_VOICED_SEC만큼 잡히지 않으면 null. */
export async function extractAudioFeatures(audioBlob: Blob): Promise<AudioFeatures | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext as typeof AudioContext
    const audioCtx = new AudioCtx()
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    await audioCtx.close()

    const origSr = audioBuffer.sampleRate
    const duration = audioBuffer.duration
    const rawData = audioBuffer.getChannelData(0)

    // Downsample to ~11025 Hz for faster pitch computation
    const dsf = Math.max(1, Math.round(origSr / 11025))
    const dsData = downsample(rawData, dsf)
    const dsSr = origSr / dsf

    // ── Pitch + voice quality per frame ──────────────────
    const FRAME = 1024  // larger frame → better low-frequency resolution
    const HOP = 512

    const f0s: number[] = []
    const voicedRms: number[] = []
    let totalFrames = 0

    for (let start = 0; start + FRAME <= dsData.length; start += HOP) {
      const frame = dsData.subarray(start, start + FRAME)

      let sq = 0
      for (let i = 0; i < FRAME; i++) sq += frame[i] * frame[i]
      const rms = Math.sqrt(sq / FRAME)
      totalFrames++

      const f0 = detectPitchFrame(frame, dsSr)
      if (f0 !== null) {
        f0s.push(f0)
        voicedRms.push(rms)
      }
    }

    const voicedRatio = totalFrames > 0 ? f0s.length / totalFrames : 0
    if ((f0s.length * HOP) / dsSr < MIN_VOICED_SEC) return null

    // Filter outliers before computing statistics
    const cleanF0s = filterPitchOutliers(f0s)
    const pitchMean = arrMean(cleanF0s)
    const pitchStd = arrStd(cleanF0s, pitchMean)

    const pitch = cleanF0s.length > 0
      ? (() => {
          const sorted = [...cleanF0s].sort((a, b) => a - b)
          return {
            mean_hz: pitchMean,
            min_hz: percentile(sorted, 0.05), // 5th percentile — avoids single-frame floor
            max_hz: percentile(sorted, 0.95), // 95th percentile — avoids single-frame spike
            std_hz: pitchStd,
            voiced_ratio: voicedRatio,
          }
        })()
      : { mean_hz: 150, min_hz: 100, max_hz: 280, std_hz: 25, voiced_ratio: 0.5 }

    // ── Energy stats (20 ms frames on original resolution) ─
    const frameMs = Math.floor(origSr * 0.02)
    const rmsFrames: number[] = []
    const dbFrames: number[] = []

    for (let i = 0; i + frameMs <= rawData.length; i += frameMs) {
      let sq = 0
      for (let j = 0; j < frameMs; j++) sq += rawData[i + j] ** 2
      const rms = Math.sqrt(sq / frameMs)
      rmsFrames.push(rms)
      dbFrames.push(rms > 1e-10 ? 20 * Math.log10(rms) : -100)
    }

    const rmsMean = arrMean(rmsFrames)
    const activeDb = dbFrames.filter((d) => d > -100)
    // 목소리 크기는 목소리가 난 구간으로만 잰다. 말 사이 쉼까지 평균에 넣으면 쉼이 많은 문장이 실제보다 작게 나와
    // 허밍(쉼 없음)과 문장을 비교할 수 없다.
    const dbMean = arrMean(voicedRms.map((r) => 20 * Math.log10(r)))
    const dbMax = activeDb.length > 0 ? Math.max(...activeDb) : 0
    const dbMin = activeDb.length > 0 ? Math.min(...activeDb) : -80

    const energy = {
      rms_mean: rmsMean,
      rms_std: arrStd(rmsFrames, rmsMean),
      db_mean: dbMean,
      db_max: dbMax,
      db_min: dbMin,
      db_range: dbMax - dbMin,
    }

    // ── Zero crossing rate ─────────────────────────────────
    const zcrVals: number[] = []
    for (let i = 0; i + frameMs <= rawData.length; i += frameMs) {
      let crossings = 0
      for (let j = 0; j < frameMs - 1; j++) {
        if ((rawData[i + j] >= 0) !== (rawData[i + j + 1] >= 0)) crossings++
      }
      zcrVals.push(crossings / frameMs)
    }
    const zcrMean = arrMean(zcrVals)
    const zero_crossing = { mean: zcrMean, std: arrStd(zcrVals, zcrMean) }

    // ── Speech rate: syllable nuclei (de Jong & Wempe, 2009) ─
    // onsets_per_second는 이름만 남기고 음절/초(쉼 포함)를 담는다. 소비처: calcPaceScore,
    // 훈련 PACE_RANGE, 장면 판정. 예전 '1.3배 상승' 방식은 실측 초당 1회 안팎으로 낮게 셌다.
    const sylRate = syllableRate(rawData, origSr)
    const rhythm = {
      tempo_bpm: Math.max(60, Math.round(sylRate.speechRate * 60 * 0.5)),
      onset_count: sylRate.count,
      onsets_per_second: sylRate.speechRate,
      // 쉼을 뺀 조음 속도. 자유 발화는 생각하느라 쉬는 시간이 있어 페르소나 판정에는 이 값을 쓴다.
      articulation_rate: sylRate.articulationRate,
    }

    // ── Jitter (pitch period perturbation, voiced frames) ─
    let jitterSum = 0
    for (let i = 1; i < f0s.length; i++) {
      jitterSum += Math.abs(1 / f0s[i] - 1 / f0s[i - 1])
    }
    const jitterAbs = f0s.length > 1 ? jitterSum / (f0s.length - 1) : 0
    const meanPeriod = f0s.length > 0 ? arrMean(f0s.map((f) => 1 / f)) : 0.007
    const jitterRel = meanPeriod > 0 ? jitterAbs / meanPeriod : 0

    // ── Shimmer (amplitude perturbation, voiced frames) ──
    let shimmerSum = 0
    for (let i = 1; i < voicedRms.length; i++) {
      shimmerSum += Math.abs(voicedRms[i] - voicedRms[i - 1])
    }
    const shimmerAbs = voicedRms.length > 1 ? shimmerSum / (voicedRms.length - 1) : 0
    const meanVoicedRms = arrMean(voicedRms)
    const shimmerRel = meanVoicedRms > 0 ? shimmerAbs / meanVoicedRms : 0

    const voice_quality = {
      jitter_abs_ms: jitterAbs * 1000,
      jitter_rel_pct: jitterRel * 100,
      shimmer_abs: shimmerAbs,
      shimmer_rel_pct: shimmerRel * 100,
      source: 'frame' as VoiceQualitySource,
    }

    // ── Spectral placeholders (not rendered in UI) ────────
    const spectral = {
      centroid_mean_hz: pitchMean * 2.5,
      centroid_std_hz: 200,
      bandwidth_mean_hz: 1500,
      rolloff_mean_hz: 3000,
      flatness_mean: 0.1,
      contrast_mean_db: 20,
    }
    const mfccs: Record<string, number> = Object.fromEntries(
      Array.from({ length: 13 }, (_, i) => [`mfcc_${i + 1}`, 0]),
    )

    return {
      duration_sec: duration,
      sample_rate: origSr,
      pitch,
      energy,
      spectral,
      mfccs,
      zero_crossing,
      rhythm,
      voice_quality,
      hnr_db: 10,
    }
  } catch (err) {
    console.error('[audio features] extraction failed:', err)
    return null
  }
}

/**
 * Cycle-to-cycle Praat jitter/shimmer from the Modal microservice.
 * Returns null on any failure (Modal unconfigured, network error, recording
 * too short for cycle detection) — callers stay on the in-browser fallback.
 */
async function fetchPraatVoiceQuality(blob: Blob): Promise<
  { jitter_rel_pct: number; shimmer_rel_pct: number; hnr_db: number } | null
> {
  try {
    const wav = await audioBlobToWav(blob)
    const res = await fetch('/api/voice-quality', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wav,
    })
    if (res.status !== 200) return null
    const data = await res.json()
    const j = Number(data.jitter_rel_pct)
    const s = Number(data.shimmer_rel_pct)
    const h = Number(data.hnr_db)
    if (!Number.isFinite(j) || !Number.isFinite(s)) return null
    return { jitter_rel_pct: j, shimmer_rel_pct: s, hnr_db: Number.isFinite(h) ? h : 0 }
  } catch (err) {
    console.warn('[praat voice-quality] fetch failed:', err)
    return null
  }
}

/**
 * Like extractAudioFeatures(), but overlays clinical Praat jitter/shimmer
 * from the Modal microservice onto voice_quality (tagged source='praat').
 * Falls back to the browser-only frame-based numbers if Modal is offline.
 */
export async function extractAudioFeaturesWithPraat(
  blob: Blob,
  /**
   * 지속 모음 "아~" 구간. 있으면 떨림(jitter, shimmer, HNR)은 이 구간에서만 잰다.
   * 떨림은 원래 지속 모음으로 재는 지표다. 이어 말하기에서는 억양과 자음 전환이 섞여 부풀려진다.
   */
  vowelBlob?: Blob | null,
): Promise<AudioFeatures | null> {
  // "아~" 구간에 목소리가 없으면(말하지 않았거나 너무 짧으면) 말하기 구간으로 떨림을 잰다.
  const vowelFeatures = vowelBlob ? await extractAudioFeatures(vowelBlob) : null
  const qualityBlob = vowelFeatures && vowelBlob ? vowelBlob : blob
  const [features, praat] = await Promise.all([
    extractAudioFeatures(blob),
    fetchPraatVoiceQuality(qualityBlob),
  ])
  if (!features) return null
  // Modal이 꺼져 있으면 브라우저 근사치를 쓰되, 모음이 있으면 모음 구간의 근사치를 쓴다.
  if (vowelFeatures) features.voice_quality = { ...vowelFeatures.voice_quality }
  features.voice_quality.task = vowelFeatures ? 'vowel' : 'speech'
  // 대체 측정으로 넘어가면 기록해 둔다. 2026-10-25까지 운영 환경 주소가 비어 있어 아무도 모른 채 대체 측정만 썼다.
  if (!praat) trackEvent('voice_quality_fallback', { task: features.voice_quality.task })
  if (praat) {
    features.voice_quality.jitter_rel_pct = praat.jitter_rel_pct
    features.voice_quality.shimmer_rel_pct = praat.shimmer_rel_pct
    // jitter_abs_ms / shimmer_abs aren't shown in UI but keep them
    // proportional so anything downstream stays sane.
    features.voice_quality.jitter_abs_ms = praat.jitter_rel_pct / 100 * 7 // ~7ms mean adult period
    features.voice_quality.shimmer_abs = praat.shimmer_rel_pct / 100
    features.voice_quality.source = 'praat'
    features.hnr_db = praat.hnr_db
  }
  return features
}
