import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { syllableRate } from './syllableRate'

/** 16비트 PCM WAV를 첫 채널 Float32Array로 읽는다 */
function readWav(path: string): { x: Float32Array; sr: number } {
  const b = readFileSync(path)
  let off = 12, sr = 0, ch = 1, bits = 16
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4)
    const size = b.readUInt32LE(off + 4)
    if (id === 'fmt ') { ch = b.readUInt16LE(off + 10); sr = b.readUInt32LE(off + 12); bits = b.readUInt16LE(off + 22) }
    if (id === 'data') {
      if (bits !== 16) throw new Error('16-bit PCM only')
      const n = size / 2 / ch
      const x = new Float32Array(n)
      for (let i = 0; i < n; i++) x[i] = b.readInt16LE(off + 8 + i * 2 * ch) / 32768
      return { x, sr }
    }
    off += 8 + size + (size % 2)
  }
  throw new Error('no data chunk')
}

/** 성대 진동(150Hz 펄스열)을 rate회/초로 켰다 껐다 하는 합성 음성 */
function syntheticSyllables(rate: number, seconds: number, sr = 16000): Float32Array {
  const x = new Float32Array(Math.round(seconds * sr))
  for (let i = 0; i < x.length; i++) {
    const t = i / sr
    const env = Math.sin(Math.PI * rate * t) ** 2
    const voice = Math.sin(2 * Math.PI * 150 * t) + 0.5 * Math.sin(2 * Math.PI * 300 * t)
    x[i] = 0.3 * env * voice
  }
  return x
}

describe('syllableRate', () => {
  it('counts one nucleus per syllable-like burst', () => {
    const r = syllableRate(syntheticSyllables(5, 4), 16000)
    expect(r.count).toBeGreaterThanOrEqual(18)
    expect(r.count).toBeLessThanOrEqual(21)
    expect(r.speechRate).toBeGreaterThan(4.3)
    expect(r.speechRate).toBeLessThan(5.7)
  })

  it('ignores unvoiced noise bursts', () => {
    const sr = 16000, x = new Float32Array(sr * 2)
    let seed = 1
    for (let i = 0; i < x.length; i++) {
      seed = (seed * 16807) % 2147483647
      const env = Math.sin(Math.PI * 4 * (i / sr)) ** 2
      x[i] = 0.3 * env * ((seed / 2147483647) * 2 - 1)
    }
    expect(syllableRate(x, sr).count).toBeLessThanOrEqual(2)
  })

  it('returns zero for silence', () => {
    expect(syllableRate(new Float32Array(16000), 16000)).toMatchObject({ count: 0, speechRate: 0 })
  })

  it('real Korean sample: "오늘 점심 뭐 먹지, 아 벌써 4시네…" (23 syllables by hand) counts within ±3', () => {
    const { x, sr } = readWav(join(process.cwd(), 'public/personas/persona-1.wav'))
    const r = syllableRate(x, sr)
    expect(r.count).toBeGreaterThanOrEqual(20)
    expect(r.count).toBeLessThanOrEqual(26)
    expect(r.speechRate).toBeGreaterThan(3)
    expect(r.speechRate).toBeLessThan(7)
  })
})
