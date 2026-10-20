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
  /** 녹음 중 지금 시점(초)을 표시하고, afterMs 뒤에 자동으로 멈춘다 */
  markAndStopAfter: (afterMs: number) => void
  /** markAndStopAfter를 누른 시점 (녹음 시작부터 초). 없으면 null */
  markSec: number | null
  reset: () => void
  error: string | null
  /** 마이크 허락을 못 받았다 */
  micDenied: boolean
}

export function useAudioRecorder(maxSeconds = 30): AudioRecorderResult {
  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 마이크 허락을 못 받았다. 앱 안 브라우저 안내를 띄울지 정할 때 쓴다 */
  const [micDenied, setMicDenied] = useState(false)
  const [markSec, setMarkSec] = useState<number | null>(null)
  const startedAtRef = useRef<number>(0)

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
      // duration === maxSeconds implies the auto-stop / hard-stop path triggered
      const reason = duration >= maxSeconds ? 'autostop' : 'manual'
      trackEvent('record_stopped', { reason, duration_sec: duration })
    }
    cleanup()
  }, [cleanup, duration, maxSeconds])

  const start = useCallback(async () => {
    setError(null)
    setMicDenied(false)
    setAudioBlob(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    chunksRef.current = []
    setDuration(0)
    setMarkSec(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      trackEvent('mic_permission_granted')
    } catch {
      trackEvent('mic_permission_denied')
      setError('마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.')
      setMicDenied(true)
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
    startedAtRef.current = performance.now()
    setState('recording')
    trackEvent('record_started', { max_seconds: maxSeconds })

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

  const markAndStopAfter = useCallback((afterMs: number) => {
    if (mediaRecorderRef.current?.state !== 'recording') return
    setMarkSec((performance.now() - startedAtRef.current) / 1000)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    autoStopRef.current = setTimeout(() => stop(), afterMs)
  }, [stop])

  const reset = useCallback(() => {
    cleanup()
    setMarkSec(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setAudioBlob(null)
    setDuration(0)
    setAnalyserNode(null)
    setError(null)
    setState('idle')
  }, [cleanup, audioUrl])

  return { state, duration, audioBlob, audioUrl, analyserNode, start, stop, markAndStopAfter, markSec, reset, error, micDenied }
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}
