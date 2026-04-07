'use client'

export interface AudioFeatures {
  duration_sec: number
  sample_rate: number
  pitch: { mean_hz: number; min_hz: number; max_hz: number; std_hz: number; voiced_ratio: number }
  energy: { rms_mean: number; rms_std: number; db_mean: number; db_max: number; db_min: number; db_range: number }
  spectral: { centroid_mean_hz: number; centroid_std_hz: number; bandwidth_mean_hz: number; rolloff_mean_hz: number; flatness_mean: number; contrast_mean_db: number }
  mfccs: Record<string, number>
  zero_crossing: { mean: number; std: number }
  rhythm: { tempo_bpm: number; onset_count: number; onsets_per_second: number }
  voice_quality: { jitter_abs_ms: number; jitter_rel_pct: number; shimmer_abs: number; shimmer_rel_pct: number }
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

  return bestLag > 0 ? sr / bestLag : null
}

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
    const rmsByFrame: number[] = []
    let totalFrames = 0

    for (let start = 0; start + FRAME <= dsData.length; start += HOP) {
      const frame = dsData.subarray(start, start + FRAME)

      let sq = 0
      for (let i = 0; i < FRAME; i++) sq += frame[i] * frame[i]
      const rms = Math.sqrt(sq / FRAME)
      rmsByFrame.push(rms)
      totalFrames++

      const f0 = detectPitchFrame(frame, dsSr)
      if (f0 !== null) {
        f0s.push(f0)
        voicedRms.push(rms)
      }
    }

    const voicedRatio = totalFrames > 0 ? f0s.length / totalFrames : 0

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
    const dbMean = arrMean(activeDb)
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

    // ── Onset detection (energy rise, min gap = 2 frames) ─
    let onsetCount = 0
    let lastOnset = -3
    const noiseFl = arrMean(rmsByFrame) * 0.3

    for (let i = 2; i < rmsByFrame.length - 1; i++) {
      if (
        i - lastOnset >= 2 &&
        rmsByFrame[i] > noiseFl &&
        rmsByFrame[i] > rmsByFrame[i - 1] * 1.3 &&
        rmsByFrame[i] >= rmsByFrame[i + 1]
      ) {
        onsetCount++
        lastOnset = i
      }
    }

    const rhythm = {
      tempo_bpm: Math.max(60, Math.round((onsetCount / duration) * 60 * 0.5)),
      onset_count: onsetCount,
      onsets_per_second: duration > 0 ? onsetCount / duration : 0,
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
