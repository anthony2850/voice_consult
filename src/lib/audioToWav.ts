'use client'

/**
 * Decode a browser-recorded audio blob (webm/opus, mp4/aac, ogg) and
 * re-encode it as 16-bit PCM mono WAV at 16 kHz — the format OpenAI's
 * audio models (`gpt-4o-mini-audio-preview`) accept via `input_audio`.
 *
 * Runs entirely in the browser via Web Audio API (no ffmpeg needed).
 */
export async function audioBlobToWav(blob: Blob): Promise<Blob> {
  const TARGET_SR = 16000

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  const ctx = new AudioCtx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  } finally {
    await ctx.close()
  }

  // Resample to mono 16 kHz via OfflineAudioContext (clean resampling + mixdown)
  const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SR))
  const offline = new OfflineAudioContext(1, frameCount, TARGET_SR)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()

  return encodeWav(rendered.getChannelData(0), TARGET_SR)
}

/** "아~" 구간이 이보다 짧으면 떨림 측정에 쓰지 않는다 (Praat 주기 검출에 충분한 길이) */
export const MIN_VOWEL_SEC = 1.5

/**
 * 녹음 하나를 "다 읽었어요"를 누른 시점(markSec)에서 둘로 나눈다.
 * - speech: 처음 ~ markSec (문단 읽기) — 감정, 억양, 말 속도
 * - vowel: markSec + 0.4초 ~ 끝 - 0.15초 ("아~") — 떨림. 짧으면 null.
 * 버튼을 누르고 "아~"를 시작하기까지의 0.4초, 녹음이 멈추는 끝 0.15초는 뺀다.
 */
export async function splitRecordingToWav(blob: Blob, markSec: number | null): Promise<{ speech: Blob; vowel: Blob | null }> {
  const TARGET_SR = 16000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  const ctx = new AudioCtx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  } finally {
    await ctx.close()
  }
  const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SR))
  const offline = new OfflineAudioContext(1, frameCount, TARGET_SR)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const all = (await offline.startRendering()).getChannelData(0)

  if (markSec == null || markSec <= 0 || markSec >= decoded.duration) {
    return { speech: encodeWav(all, TARGET_SR), vowel: null }
  }
  const cut = Math.round(markSec * TARGET_SR)
  const vStart = Math.min(all.length, cut + Math.round(0.4 * TARGET_SR))
  const vEnd = Math.max(vStart, all.length - Math.round(0.15 * TARGET_SR))
  const vowel = vEnd - vStart >= MIN_VOWEL_SEC * TARGET_SR ? encodeWav(all.subarray(vStart, vEnd), TARGET_SR) : null
  return { speech: encodeWav(all.subarray(0, cut), TARGET_SR), vowel }
}

/** Encode mono Float32 PCM samples as a 16-bit PCM WAV blob. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  // RIFF header
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  // fmt chunk
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)              // PCM chunk size
  view.setUint16(20, 1, true)               // audio format = PCM
  view.setUint16(22, 1, true)               // channels = mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)  // byte rate (sr * blockAlign)
  view.setUint16(32, 2, true)               // block align (channels * bytesPerSample)
  view.setUint16(34, 16, true)              // bits per sample
  // data chunk
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}
