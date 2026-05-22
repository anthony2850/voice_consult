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
