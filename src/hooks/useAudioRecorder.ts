'use client'

import { useRef, useState, useCallback } from 'react'
import { trackEvent } from '@/lib/analytics'

export type RecordingState = 'idle' | 'recording' | 'recorded'

export interface AudioRecorderResult {
  state: RecordingState
  duration: number          // seconds elapsed while recording
  audioBlob: Blob | null
  audioUrl: string | null
  analyserNode: AnalyserNode | null
  start: () => Promise<void>
  stop: () => void
  reset: () => void
  error: string | null
}

export function useAudioRecorder(maxSeconds = 30): AudioRecorderResult {
  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()
    streamRef.current = null
    audioCtxRef.current = null
  }, [])

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    cleanup()
  }, [cleanup])

  const start = useCallback(async () => {
    setError(null)
    setAudioBlob(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    chunksRef.current = []
    setDuration(0)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      trackEvent('mic_permission_granted')
    } catch {
      setError('마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.')
      return
    }
    streamRef.current = stream

    // Web Audio API analyser
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    setAnalyserNode(analyser)

    // MediaRecorder
    const recorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: getSupportedMimeType() })
      const url = URL.createObjectURL(blob)
      setAudioBlob(blob)
      setAudioUrl(url)
      setState('recorded')
      setAnalyserNode(null)
    }

    recorder.start(100) // collect chunks every 100ms
    setState('recording')

    // Timer
    timerRef.current = setInterval(() => {
      setDuration((d) => {
        const next = d + 1
        if (next >= maxSeconds) {
          stop()
        }
        return next
      })
    }, 1000)

    // Hard auto-stop safety
    autoStopRef.current = setTimeout(() => stop(), maxSeconds * 1000 + 500)
  }, [audioUrl, maxSeconds, stop])

  const reset = useCallback(() => {
    cleanup()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setAudioBlob(null)
    setDuration(0)
    setAnalyserNode(null)
    setError(null)
    setState('idle')
  }, [cleanup, audioUrl])

  return { state, duration, audioBlob, audioUrl, analyserNode, start, stop, reset, error }
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}
