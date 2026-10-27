import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('./analytics', () => ({ trackEvent: () => {} }))
import { extractAudioFeatures } from './extractAudioFeatures'

const SR = 44100

/** decodeAudioData가 이 샘플을 돌려주는 가짜 AudioContext */
function withSamples(samples: Float32Array) {
  class FakeCtx {
    async decodeAudioData() {
      return { sampleRate: SR, duration: samples.length / SR, getChannelData: () => samples }
    }
    async close() {}
  }
  vi.stubGlobal('window', { AudioContext: FakeCtx })
}

const blob = { arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Blob

function tone(sec: number, hz: number, amp: number, gapEvery = 0): Float32Array {
  const out = new Float32Array(Math.round(sec * SR))
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    // gapEvery초마다 0.3초 쉼 (말 사이 쉼 흉내). 쉼에도 방 잡음이 조금 있다.
    const silent = gapEvery > 0 && t % gapEvery > gapEvery - 0.3
    out[i] = silent ? 0.0005 * Math.sin(2 * Math.PI * 3000 * t + i) : amp * Math.sin(2 * Math.PI * hz * t)
  }
  return out
}

function lowNoise(sec: number): Float32Array {
  // 저음 잡음: 흰 잡음을 강하게 평활해 에어컨 소리처럼 만든다
  const out = new Float32Array(Math.round(sec * SR))
  let y = 0
  let seed = 1
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 16807) % 2147483647
    y = 0.995 * y + 0.005 * ((seed / 2147483647) * 2 - 1)
    out[i] = y * 0.5
  }
  return out
}

beforeEach(() => vi.unstubAllGlobals())

describe('extractAudioFeatures voice check', () => {
  it('rejects a silent recording instead of reporting 0% jitter', async () => {
    withSamples(new Float32Array(5 * SR))
    expect(await extractAudioFeatures(blob)).toBeNull()
  })
  it('rejects low rumble noise with no voice', async () => {
    withSamples(lowNoise(5))
    expect(await extractAudioFeatures(blob)).toBeNull()
  })
  it('measures a hum', async () => {
    withSamples(tone(5, 150, 0.1))
    const f = await extractAudioFeatures(blob)
    expect(f).not.toBeNull()
    expect(f!.pitch.voiced_ratio).toBeGreaterThan(0.8)
  })
  it('loudness ignores pauses between words', async () => {
    withSamples(tone(6, 150, 0.1))
    const steady = (await extractAudioFeatures(blob))!.energy.db_mean
    withSamples(tone(6, 150, 0.1, 1))
    const withPauses = (await extractAudioFeatures(blob))!.energy.db_mean
    // 예전 방식(쉼까지 평균)이면 14dB쯤 작아졌다 (0.7 x -23dB + 0.3 x -69dB)
    expect(Math.abs(steady - withPauses)).toBeLessThan(1)
  })
})
