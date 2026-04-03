'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, RotateCcw, Play, Pause, ChevronRight, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { saveVoiceRecord } from '@/lib/voiceDB'
import { extractAudioFeatures } from '@/lib/extractAudioFeatures'

const MAX_SECONDS = 30
const MIN_SECONDS = 3   // minimum recording before allowing proceed

const VOCAL_TIPS = [
  { emoji: '🎯', tip: '복식호흡을 하면 목소리에 깊이가 생겨요. 배에서 소리를 밀어올리듯 발성해보세요.' },
  { emoji: '💧', tip: '녹음 전 미지근한 물 한 모금이 성대를 풀어줘요. 차가운 음료는 피하세요.' },
  { emoji: '📐', tip: '턱을 약간 당기고 시선을 정면보다 살짝 위로 향하면 공명이 잘 돼요.' },
  { emoji: '🐢', tip: '말 속도를 평소보다 10% 느리게 해보세요. 듣는 사람이 신뢰감을 더 느껴요.' },
  { emoji: '🌊', tip: '문장 끝을 내려서 마무리하면 자신감 있는 인상을 줘요.' },
  { emoji: '🎵', tip: '중요한 단어를 강조할 때 살짝 높은 음으로 올리면 집중도가 높아져요.' },
  { emoji: '🧘', tip: '발성 전 "음~" 허밍 5초로 성대를 워밍업하면 목이 덜 쉬어요.' },
  { emoji: '😊', tip: '살짝 미소를 지으면서 말하면 목소리 톤이 자연스럽게 밝아져요.' },
  { emoji: '🔊', tip: '가슴에 손을 얹고 말할 때 진동이 느껴지면 흉성 공명이 잘 되는 거예요.' },
  { emoji: '⏸️', tip: '말 중간 0.5초 간격을 두면 듣는 사람에게 흡인력 있는 목소리로 느껴져요.' },
]

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

export default function RecordClient() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playProgress, setPlayProgress] = useState(0)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [currentTip] = useState(() => VOCAL_TIPS[Math.floor(Math.random() * VOCAL_TIPS.length)])

  const { state, duration, audioBlob, audioUrl, analyserNode, start, stop, reset, error } =
    useAudioRecorder(MAX_SECONDS)

  useWaveform({
    analyser: analyserNode,
    canvasRef,
    active: state === 'recording',
  })

  // Sync audio element with playback progress
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => {
      if (audio.duration) setPlayProgress((audio.currentTime / audio.duration) * 100)
    }
    const onEnded = () => {
      setIsPlaying(false)
      setPlayProgress(0)
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [audioUrl])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const handleProceed = async () => {
    if (!audioBlob) return
    setAnalyzing(true)
    setAnalyzeProgress(0)

    // fake progress animation while waiting for API
    const progressInterval = setInterval(() => {
      setAnalyzeProgress((p) => Math.min(p + Math.random() * 6 + 2, 90))
    }, 300)

    try {
      const formData1 = new FormData()
      formData1.append('audio', audioBlob, 'voice.webm')

      const [emotionRes, audioFeatures] = await Promise.all([
        fetch('/api/analyze-voice', { method: 'POST', body: formData1 }),
        extractAudioFeatures(audioBlob),
      ])

      const emotionData = await emotionRes.json()

      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotionData.emotions ?? null))
      sessionStorage.setItem('audioFeatures', JSON.stringify(audioFeatures))

      // IndexedDB에 오디오 + 분석 결과 저장 (비동기, 실패해도 결과 페이지 이동은 계속)
      const rawEmotions: Record<string, number> = emotionData.emotions ?? {}
      const top5 = Object.entries(rawEmotions)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      saveVoiceRecord(audioBlob, {
        emotions: top5,
        audioFeatures: audioFeatures,
      }).catch((e) => console.warn('[voiceDB] 저장 실패:', e))

      setAnalyzeProgress(100)
      setTimeout(() => router.push('/result'), 400)
    } catch {
      clearInterval(progressInterval)
      setAnalyzing(false)
      setAnalyzeProgress(0)
    } finally {
      clearInterval(progressInterval)
    }
  }

  const progressPct = (duration / MAX_SECONDS) * 100

  // ── 분석 중 로딩 화면 ──────────────────────────────────
  if (analyzing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-84px)] px-5 text-center">
        <div className="relative mb-8">
          <span className="absolute inset-0 rounded-full gradient-primary opacity-20 animate-ping scale-150" />
          <div className="relative w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-2xl shadow-primary/40">
            <Sparkles size={32} className="text-white animate-spin" style={{ animationDuration: '2s' }} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">AI가 분석 중이에요</h2>
        <p className="text-sm text-muted-foreground mb-6">목소리의 감정·톤·에너지 패턴을 읽고 있어요</p>
        <div className="w-full max-w-[300px] bg-muted rounded-2xl px-4 py-3 mb-6 text-left">
          <p className="text-xs font-semibold text-primary mb-1">발성 꿀팁 {currentTip.emoji}</p>
          <p className="text-sm text-foreground leading-relaxed">{currentTip.tip}</p>
        </div>
        <div className="w-full max-w-[280px]">
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div className="h-full gradient-primary rounded-full transition-all duration-300" style={{ width: `${analyzeProgress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{Math.floor(analyzeProgress)}%</p>
        </div>
      </div>
    )
  }

  // ── States ────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] px-5 pt-6 pb-4">

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">STEP 1</p>
        <h1 className="text-xl font-bold text-foreground">목소리 녹음</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {state === 'idle'    && '평소 자신의 원래 목소리대로 편하게 읽어 주세요'}
          {state === 'recording' && '자연스럽게 말씀해 주세요 — 30초까지 녹음됩니다'}
          {state === 'recorded'  && '녹음이 완료됐어요! 확인 후 분석을 시작하세요'}
        </p>
      </div>

      {/* Waveform card */}
      <div className="relative glass rounded-3xl overflow-hidden flex flex-col items-center justify-center p-6 mb-6"
           style={{ minHeight: 180 }}>
        {/* Status indicator dot */}
        {state === 'recording' && (
          <span className="absolute top-4 right-4 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] text-red-400 font-semibold">REC</span>
          </span>
        )}

        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: 80 }}
        />

        {/* Timer */}
        <div className="mt-4 text-center">
          <span className="text-3xl font-mono font-bold tracking-widest text-foreground">
            {formatTime(duration)}
          </span>
          {state === 'recording' && (
            <span className="text-xs text-muted-foreground ml-2">/ {formatTime(MAX_SECONDS)}</span>
          )}
        </div>

        {/* Progress bar */}
        {state === 'recording' && (
          <div className="w-full mt-3">
            <Progress value={progressPct} className="h-1.5 bg-border" />
          </div>
        )}

        {/* Playback bar (recorded) */}
        {state === 'recorded' && (
          <div className="w-full mt-3">
            <Progress value={playProgress} className="h-1.5 bg-border" />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3 mb-4 text-sm text-destructive">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Tips */}
      {state === 'idle' && (
        <div className="glass rounded-2xl p-4 mb-6">
          <p className="text-xs font-semibold text-muted-foreground mb-2">녹음 팁</p>
          <ul className="space-y-1.5">
            {[
              '조용한 환경에서 녹음해 주세요',
              '마이크와 10~20cm 거리를 유지하세요',
              '스크립트를 자연스럽게 소리 내어 읽어 주세요',
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Script (prompt text) */}
      <div className="glass rounded-2xl p-4 mb-6">
        <p className="text-[11px] text-muted-foreground mb-2 font-semibold">읽어 주세요</p>
        <p className="text-sm text-foreground leading-relaxed">
          &ldquo;안녕하세요. 저는 오늘 제 목소리를 분석하러 왔습니다. 저는 평소에 친구들과 이야기하는 것을 좋아하고, 새로운 것을 배우는 것도 즐깁니다. 잘 부탁드립니다.&rdquo;
        </p>
        <p className="text-[10px] text-muted-foreground mt-2">
          ✦ 평소 자신의 목소리 그대로 자연스럽게 읽어 주세요
        </p>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="space-y-3">
        {state === 'idle' && (
          <Button
            size="lg"
            onClick={start}
            className="w-full h-14 text-base font-bold rounded-2xl gradient-primary border-0 shadow-xl shadow-primary/30 active:scale-95 transition-transform"
          >
            <Mic size={20} className="mr-2" />
            녹음 시작
          </Button>
        )}

        {state === 'recording' && (
          <Button
            size="lg"
            onClick={stop}
            className="w-full h-14 text-base font-bold rounded-2xl bg-red-600 hover:bg-red-700 border-0 shadow-xl shadow-red-900/40 active:scale-95 transition-transform"
          >
            <Square size={18} className="mr-2 fill-white" />
            녹음 중지
          </Button>
        )}

        {state === 'recorded' && (
          <>
            {/* Audio playback (hidden element) */}
            {audioUrl && (
              <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={togglePlay}
                className="flex-1 h-12 rounded-2xl border-border bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform"
              >
                {isPlaying
                  ? <><Pause size={18} className="mr-2" />일시정지</>
                  : <><Play size={18} className="mr-2" />듣기</>
                }
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={reset}
                className="h-12 px-4 rounded-2xl border-border bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform"
                aria-label="다시 녹음"
              >
                <RotateCcw size={18} />
              </Button>
            </div>

            <Button
              size="lg"
              onClick={handleProceed}
              disabled={duration < MIN_SECONDS}
              className="w-full h-14 text-base font-bold rounded-2xl gradient-primary border-0 shadow-xl shadow-primary/30 active:scale-95 transition-transform disabled:opacity-40"
            >
              이 목소리로 분석하기
              <ChevronRight size={18} className="ml-1" />
            </Button>

            {duration < MIN_SECONDS && (
              <p className="text-center text-xs text-muted-foreground">
                {MIN_SECONDS}초 이상 녹음해야 분석이 가능해요
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
