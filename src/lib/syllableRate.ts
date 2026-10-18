/**
 * 말 속도 — 음절 핵(syllable nuclei) 검출. 순수 함수, 브라우저와 Node 모두에서 돈다.
 *
 * de Jong, N. H., & Wempe, T. (2009). Praat script to detect syllable nuclei and measure
 * speech rate automatically. Behavior Research Methods, 41(2), 385–390.
 *
 * 1. 10ms 간격 세기(dB) 곡선을 만든다.
 * 2. 가장 큰 세기(99번째 백분위)에서 25dB 아래를 무음 기준선으로 둔다.
 * 3. 기준선 위의 봉우리 중, 다음 봉우리와의 사이가 2dB 이상 꺼지는 것만 음절로 센다.
 * 4. 봉우리 지점이 유성음(성대가 울림)인 것만 남긴다.
 *
 * 예전 방식(소리가 1.3배 이상 갑자기 커지는 순간 세기)은 부드럽게 이어지는 음절을 놓쳐
 * 실측이 초당 1회 안팎으로 나왔다.
 */

const HOP_SEC = 0.01
/**
 * de Jong & Wempe 기본값은 세기 창 64ms(최소 피치 50Hz), 무음 25dB, 꺼짐 2dB.
 * 한국어 예시 녹음(사람이 센 23음절)에서 64ms는 27, 80ms는 24로 셌다(2026-10-18).
 * 한국어는 음절이 고르게 이어져 조금 더 부드러운 곡선이 맞아 창만 80ms로 둔다. 녹음 하나로 맞춘 값이라 재확인 필요.
 */
export const SYLLABLE_DEFAULTS = { winSec: 0.08, silenceDb: 25, minDipDb: 2 }

export interface SyllableRate {
  /** 음절 수 */
  count: number
  /** 첫 소리부터 마지막 소리까지 (초) */
  speakingSec: number
  /** 쉼 포함 말 속도 (음절/초) */
  speechRate: number
  /** 쉼 뺀 조음 속도 (음절/초) */
  articulationRate: number
}

function intensityDb(x: Float32Array, sr: number, winSec: number): number[] {
  const hop = Math.max(1, Math.round(sr * HOP_SEC))
  const win = Math.max(2, Math.round(sr * winSec))
  const w = new Float32Array(win)
  let wsum = 0
  for (let i = 0; i < win; i++) { w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1)); wsum += w[i] }
  const out: number[] = []
  for (let s = 0; s + win <= x.length; s += hop) {
    let e = 0
    for (let i = 0; i < win; i++) e += x[s + i] * x[s + i] * w[i]
    const p = e / wsum
    out.push(p > 1e-12 ? 10 * Math.log10(p) : -120)
  }
  return out
}

/** 봉우리 지점의 유성음 여부 — 정규화 자기상관이 0.45를 넘으면 유성음. 60~500Hz. */
function voicedAt(x: Float32Array, sr: number, center: number): boolean {
  const half = Math.round(sr * 0.02)
  const a = Math.max(0, center - half), b = Math.min(x.length, center + half)
  const n = b - a
  const minLag = Math.floor(sr / 500), maxLag = Math.min(Math.floor(sr / 60), n - 1)
  if (maxLag <= minLag) return false
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0, ex = 0, es = 0
    for (let i = a; i < b - lag; i++) {
      ac += x[i] * x[i + lag]; ex += x[i] * x[i]; es += x[i + lag] * x[i + lag]
    }
    const d = Math.sqrt(ex * es)
    if (d > 1e-10 && ac / d > 0.45) return true
  }
  return false
}

function downsample(x: Float32Array, sr: number): { y: Float32Array; sr: number } {
  const f = Math.max(1, Math.round(sr / 11025))
  if (f === 1) return { y: x, sr }
  const y = new Float32Array(Math.floor(x.length / f))
  for (let i = 0; i < y.length; i++) {
    let s = 0
    for (let k = 0; k < f; k++) s += x[i * f + k]
    y[i] = s / f // 평균으로 줄여 간단한 저역 통과를 겸한다
  }
  return { y, sr: sr / f }
}

export function syllableRate(
  samples: Float32Array, sampleRate: number, opts: Partial<typeof SYLLABLE_DEFAULTS> = {},
): SyllableRate {
  const { winSec, silenceDb, minDipDb } = { ...SYLLABLE_DEFAULTS, ...opts }
  const { y, sr } = downsample(samples, sampleRate)
  const db = intensityDb(y, sr, winSec)
  const empty = { count: 0, speakingSec: 0, speechRate: 0, articulationRate: 0 }
  if (db.length < 3) return empty

  const sorted = [...db].sort((p, q) => p - q)
  const q99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))]
  const threshold = q99 - silenceDb

  const above = db.map((v) => v > threshold)
  const first = above.indexOf(true)
  const last = above.lastIndexOf(true)
  if (first < 0) return empty
  const speakingSec = (last - first + 1) * HOP_SEC
  const phonationSec = above.filter(Boolean).length * HOP_SEC

  const peaks: number[] = []
  for (let i = 1; i < db.length - 1; i++) {
    if (db[i] > threshold && db[i] > db[i - 1] && db[i] >= db[i + 1]) peaks.push(i)
  }

  // 다음 봉우리까지 사이에서 2dB 이상 꺼지는 봉우리만 남긴다. 마지막 봉우리는 소리 끝까지 본다.
  const kept: number[] = []
  for (let k = 0; k < peaks.length; k++) {
    const p = peaks[k]
    const end = k + 1 < peaks.length ? peaks[k + 1] : Math.min(db.length - 1, last + 1)
    let dip = db[p]
    for (let i = p; i <= end; i++) dip = Math.min(dip, db[i])
    if (db[p] - dip > minDipDb) kept.push(p)
  }

  const hop = Math.round(sr * HOP_SEC), win = Math.round(sr * winSec)
  const count = kept.filter((f) => voicedAt(y, sr, f * hop + Math.floor(win / 2))).length

  return {
    count,
    speakingSec,
    speechRate: speakingSec > 0 ? count / speakingSec : 0,
    articulationRate: phonationSec > 0 ? count / phonationSec : 0,
  }
}
