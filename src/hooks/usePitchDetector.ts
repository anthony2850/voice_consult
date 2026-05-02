'use client'

import { useCallback, useEffect, useRef } from 'react'

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let rmsSum = 0
  for (let i = 0; i < buf.length; i++) rmsSum += buf[i] * buf[i]
  if (Math.sqrt(rmsSum / buf.length) < 0.01) return -1

  // Trim silent edges
  let r1 = 0, r2 = buf.length - 1
  for (let i = 0; i < buf.length / 2; i++) {
    if (Math.abs(buf[i]) < 0.2) { r1 = i; break }
  }
  for (let i = 1; i < buf.length / 2; i++) {
    if (Math.abs(buf[buf.length - i]) < 0.2) { r2 = buf.length - i; break }
  }
  const trimmed = buf.slice(r1, r2 + 1)
  const len = trimmed.length

  // Autocorrelation
  const c = new Float32Array(len).fill(0)
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - i; j++) c[i] += trimmed[j] * trimmed[j + i]
  }

  // Find first dip then global max
  let d = 0
  while (d < len - 1 && c[d] > c[d + 1]) d++
  let maxVal = -Infinity, maxPos = d
  for (let i = d; i < len; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i }
  }
  if (maxPos <= 0 || maxPos >= len - 1) return -1

  // Parabolic interpolation for sub-sample accuracy
  const x1 = c[maxPos - 1], x2 = c[maxPos], x3 = c[maxPos + 1]
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  const T0 = a !== 0 ? maxPos - b / (2 * a) : maxPos
  const hz = sampleRate / T0
  return hz > 60 && hz < 2000 ? hz : -1
}

export function usePitchDetector() {
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close().catch(() => {})
    streamRef.current = null
    ctxRef.current = null
    analyserRef.current = null
  }, [])

  const start = useCallback(async () => {
    stop()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    streamRef.current = stream
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0
    source.connect(analyser)
    analyserRef.current = analyser
  }, [stop])

  useEffect(() => () => stop(), [stop])

  // Return ref directly so callers can always read the latest value without re-renders
  return { analyserRef, start, stop }
}

export { autoCorrelate }
