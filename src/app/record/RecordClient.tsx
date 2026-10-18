'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, RotateCcw, Play, Pause, ChevronRight, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { saveVoiceRecord } from '@/lib/voiceDB'
import { extractAudioFeaturesWithPraat } from '@/lib/extractAudioFeatures'
import { splitRecordingToWav } from '@/lib/audioToWav'
import { trackEvent } from '@/lib/analytics'
import { readVoiceAnalysisResponse, VoiceAnalysisError } from '@/lib/voiceAnalysis'

const MAX_SECONDS = 40
/** 문단 읽기 부분이 이보다 짧으면 억양과 말 속도를 믿을 수 없다 */
const MIN_SPEECH_SECONDS = 8
/** "다 읽었어요" 뒤 "아~" 녹음 길이 */
const VOWEL_MS = 3500

/**
 * 질문, 감탄, 평서문을 섞은 약 20초 문단 (약 94음절).
 * 평평한 인사 한 줄로는 억양 변화폭과 말 속도가 사람마다 거의 다르지 않다.
 */
const READING_SCRIPT = [
  '안녕하세요, 오늘은 제 목소리를 들려 드리려고 해요.',
  '요즘 날씨가 정말 좋지 않나요?',
  '아침에 창문을 열었더니 바람이 기분 좋게 불어오더라고요.',
  '와, 이런 날엔 어디든 떠나고 싶어져요!',
  '그래도 오늘은 차분하게 제 목소리부터 확인해 볼게요.',
]

const VOCAL_TIPS = [
  { tip: '복식호흡을 하면 목소리에 깊이가 생겨요. 배에서 소리를 밀어올리듯 발성해보세요.' },
  { tip: '녹음 전 미지근한 물 한 모금이 성대를 풀어줘요. 차가운 음료는 피하세요.' },
  { tip: '턱을 약간 당기고 시선을 정면보다 살짝 위로 향하면 공명이 잘 돼요.' },
  { tip: '말 속도를 평소보다 10% 느리게 해보세요. 듣는 사람이 신뢰감을 더 느껴요.' },
  { tip: '문장 끝을 내려서 마무리하면 자신감 있는 인상을 줘요.' },
  { tip: '중요한 단어를 강조할 때 살짝 높은 음으로 올리면 집중도가 높아져요.' },
  { tip: '발성 전 "음~" 허밍 5초로 성대를 워밍업하면 목이 덜 쉬어요.' },
  { tip: '살짝 미소를 지으면서 말하면 목소리 톤이 자연스럽게 밝아져요.' },
  { tip: '가슴에 손을 얹고 말할 때 진동이 느껴지면 흉성 공명이 잘 되는 거예요.' },
  { tip: '말 중간 0.5초 간격을 두면 듣는 사람에게 흡인력 있는 목소리로 느껴져요.' },
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
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [currentTip, setCurrentTip] = useState(VOCAL_TIPS[0])

  useEffect(() => {
    setCurrentTip(VOCAL_TIPS[Math.floor(Math.random() * VOCAL_TIPS.length)])
  }, [])

  const { state, duration, audioBlob, audioUrl, analyserNode, start, stop, markAndStopAfter, markSec, reset, error } =
    useAudioRecorder(MAX_SECONDS)
  // 녹음 중 단계: 문단 읽기 → "아~"
  const phase: 'read' | 'vowel' | null = state === 'recording' ? (markSec == null ? 'read' : 'vowel') : null
  const speechSec = markSec ?? duration
  const [vowelLeft, setVowelLeft] = useState(3)
  useEffect(() => {
    if (phase !== 'vowel') return
    setVowelLeft(3)
    const t = setInterval(() => setVowelLeft((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(t)
  }, [phase])

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
    setAnalyzeError(null)
    trackEvent('analyze_started', { duration_sec: duration, audio_size: audioBlob.size })

    // fake progress animation while waiting for API
    const progressInterval = setInterval(() => {
      setAnalyzeProgress((p) => Math.min(p + Math.random() * 6 + 2, 90))
    }, 300)

    try {
      // 문단(감정, 억양, 말 속도)과 "아~"(떨림)로 나눈다. OpenAI 오디오 모델은 wav/mp3만 받는다.
      const { speech, vowel } = await splitRecordingToWav(audioBlob, markSec)
      const formData1 = new FormData()
      formData1.append('audio', speech, 'voice.wav')

      const [emotionRes, audioFeatures] = await Promise.all([
        fetch('/api/analyze-voice', { method: 'POST', body: formData1 }),
        extractAudioFeaturesWithPraat(speech, vowel),
      ])

      const emotionData = await readVoiceAnalysisResponse(emotionRes)

      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotionData.emotions))
      sessionStorage.setItem('voiceAnalysisMeta', JSON.stringify({
        source: emotionData.source,
        model: emotionData.model,
      }))
      sessionStorage.setItem('audioFeatures', JSON.stringify(audioFeatures))

      // IndexedDB에 오디오 + 분석 결과 저장 (비동기, 실패해도 결과 페이지 이동은 계속)
      const rawEmotions = emotionData.emotions
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
    } catch (err) {
      clearInterval(progressInterval)
      setAnalyzing(false)
      setAnalyzeProgress(0)
      setAnalyzeError(
        err instanceof VoiceAnalysisError && !err.retryable
          ? '현재 음성 분석 서비스 설정을 확인하고 있어요. 잠시 후 다시 시도해 주세요.'
          : '음성 분석에 실패했어요. 녹음은 그대로 있으니 다시 시도해 주세요.',
      )
      trackEvent('analyze_failed', { error: err instanceof Error ? err.message.slice(0, 100) : 'unknown' })
    } finally {
      clearInterval(progressInterval)
    }
  }

  const progressPct = (duration / MAX_SECONDS) * 100

  // ── 분석 중 로딩 화면 ──────────────────────────────────
  if (analyzing) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)] px-5 pt-16 pb-8 text-center">
        <p className="eyebrow">분석 중</p>
        <h2 className="mt-2 text-[32px] leading-[1.18] font-black tracking-[-0.03em] text-foreground">목소리를<br />읽고 있어요</h2>
        <p className="mt-3 text-[15px] text-muted-foreground">감정과 억양, 말 속도, 떨림을 재고 있어요. 몇 초면 끝나요.</p>
        <div className="mx-auto mt-10 relative w-24 h-24 flex items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping [animation-duration:2s]" />
          <span className="relative w-20 h-20 rounded-full bg-primary flex items-center justify-center">
            <Sparkles size={30} className="text-primary-foreground" />
          </span>
        </div>
        <section className="mt-10 rounded-[28px] bg-secondary px-5 py-5 text-left">
          <p className="eyebrow">발성 꿀팁</p>
          <p className="mt-1.5 text-[15px] text-foreground leading-relaxed">{currentTip.tip}</p>
        </section>
        <div className="mt-auto pt-8">
          <div className="h-3 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-label="분석 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(analyzeProgress)}>
            <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${analyzeProgress}%` }} />
          </div>
          <p className="text-[13px] font-semibold text-muted-foreground mt-2 tabular-nums">{Math.floor(analyzeProgress)}%</p>
        </div>
      </div>
    )
  }

  // ── States ────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] px-5 pt-6 pb-4">

      {/* Header */}
      <div className="mb-6">
        <p className="eyebrow mb-2">목소리 페르소나</p>
        <h1 className="text-[28px] leading-[1.2] font-black tracking-[-0.03em] text-foreground">목소리 녹음</h1>
        <p className="text-[15px] text-muted-foreground mt-2 leading-relaxed">
          {state === 'idle'    && '아래 문단을 평소 목소리로 읽고, 마지막에 "아~"를 3초 내요'}
          {phase === 'read'    && '다 읽으면 아래 버튼을 눌러 주세요'}
          {phase === 'vowel'   && '"아~"를 편한 높이로 길게 내 주세요'}
          {state === 'recorded'  && '녹음이 완료됐어요! 확인 후 분석을 시작하세요'}
        </p>
      </div>

      {/* Waveform card — 녹음 전에는 감춘다(빈 파형과 00:00뿐이라 녹음 시작 버튼만 아래로 민다).
          캔버스는 파형 훅이 잡고 있어야 해서 지우지 않고 감추기만 한다. */}
      <div className={`relative glass rounded-3xl overflow-hidden flex-col items-center justify-center p-6 mb-6 ${state === 'idle' ? 'hidden' : 'flex'}`}
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

      {analyzeError && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3 mb-4 text-sm text-destructive" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{analyzeError}</p>
        </div>
      )}

      {/* Tips — 한 줄로. 녹음 시작 버튼이 첫 화면 안에 보이게 한다. */}
      {state === 'idle' && (
        <p className="text-xs text-muted-foreground mb-4 px-1">
          조용한 곳에서 마이크와 10~20cm 떨어져 읽어 주세요.
        </p>
      )}

      {/* Script (prompt text) → "아~" */}
      {phase === 'vowel' ? (
        <div className="glass rounded-2xl p-6 mb-6 text-center" aria-live="polite">
          <p className="text-[11px] text-muted-foreground mb-2 font-semibold">마지막으로</p>
          <p className="text-4xl font-black text-foreground">아~</p>
          <p className="text-sm text-muted-foreground mt-2">편한 높이로 길게, {vowelLeft > 0 ? `${vowelLeft}초` : '끝!'}</p>
        </div>
      ) : (
        <div className="glass rounded-2xl p-4 mb-6">
          <p className="text-[11px] text-muted-foreground mb-2 font-semibold">읽어 주세요</p>
          <p className="text-[15px] text-foreground leading-relaxed">{READING_SCRIPT.join(' ')}</p>
          <p className="text-[11px] text-muted-foreground mt-3">
            다 읽은 뒤 &ldquo;아~&rdquo;를 3초 길게 내면 끝나요
          </p>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="space-y-3">
        {state === 'idle' && (
          <Button
            size="lg"
            onClick={start}
            className="w-full h-14 text-[16px] font-bold rounded-full gradient-primary border-0 active:scale-95 transition-transform"
          >
            <Mic size={20} className="mr-2" />
            녹음 시작
          </Button>
        )}

        {phase === 'read' && (
          <Button
            size="lg"
            onClick={() => markAndStopAfter(VOWEL_MS)}
            className="w-full h-14 text-[16px] font-bold rounded-full gradient-primary border-0 active:scale-95 transition-transform"
          >
            다 읽었어요, 이제 &ldquo;아~&rdquo;
            <ChevronRight size={18} className="ml-1" />
          </Button>
        )}
        {phase === 'read' && (
          <button onClick={stop} className="w-full py-1 text-xs text-muted-foreground underline-offset-4 hover:underline">
            &ldquo;아~&rdquo; 없이 녹음 끝내기
          </button>
        )}
        {phase === 'vowel' && (
          <Button
            size="lg"
            disabled
            className="w-full h-14 text-base font-bold rounded-2xl bg-secondary text-foreground border-0 disabled:opacity-100"
          >
            &ldquo;아~&rdquo; 녹음 중, 자동으로 끝나요
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
              disabled={speechSec < MIN_SPEECH_SECONDS}
              className="w-full h-14 text-[16px] font-bold rounded-full gradient-primary border-0 active:scale-95 transition-transform disabled:opacity-40"
            >
              이 목소리로 분석하기
              <ChevronRight size={18} className="ml-1" />
            </Button>

            {speechSec < MIN_SPEECH_SECONDS && (
              <p className="text-center text-xs text-muted-foreground">
                문단을 끝까지 읽어 주세요. 읽는 부분이 {MIN_SPEECH_SECONDS}초 이상이어야 분석할 수 있어요
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
