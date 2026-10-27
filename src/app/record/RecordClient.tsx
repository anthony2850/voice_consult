'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle, Lightbulb, MessagesSquare, Mic, Pause, Play, Presentation, RefreshCw, RotateCcw, Sparkles, UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { saveNewAnalysis } from '@/lib/guest-migration'
import { extractAudioFeaturesWithPraat } from '@/lib/extractAudioFeatures'
import { splitRecordingToWav } from '@/lib/audioToWav'
import { trackEvent } from '@/lib/analytics'
import { readVoiceAnalysisResponse, VoiceAnalysisError } from '@/lib/voiceAnalysis'
import { SPEAK_CATEGORIES, SPEAK_PROMPT_KEY, getSpeakCategory, isSpeakCategory, pickPromptIndex, type SpeakCategory } from '@/lib/speakPrompts'
import { InAppEscapeSheet } from '@/components/InAppEscapeSheet'
import { OnboardingShell, OnboardingTitle } from '@/components/onboarding/OnboardingParts'
import { OptionCard, Pill, PrimaryButton } from '@/components/ds'

/** 말하기 30초 + "아~" 3.5초가 넉넉히 들어가는 안전 상한 */
const MAX_SECONDS = 40
/** 자유 발화 길이. 이 시간이 되면 자동으로 "아~" 단계로 넘어간다. */
const TALK_SECONDS = 30
/** 말한 부분이 이보다 짧으면 억양과 말 속도를 믿기 어렵다. 짧을수록 결과가 녹음마다 더 흔들린다. */
const MIN_SPEECH_SECONDS = 7
/** "다 말했어요" 뒤 "아~" 녹음 길이 */
const VOWEL_MS = 3500

const CATEGORY_ICON: Record<SpeakCategory, LucideIcon> = { intro: UserRound, explain: Presentation, story: MessagesSquare, opinion: Lightbulb }

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

export default function RecordClient() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [currentTip, setCurrentTip] = useState(VOCAL_TIPS[0])

  // 주제 고르기 → 말하기. 앱 안 브라우저에서 밖으로 나와 다시 열면 주소에 실린 질문으로 바로 이어진다.
  const params = useSearchParams()
  const urlCategory = params.get('category')
  const urlQ = Number(params.get('q'))
  const [stage, setStage] = useState<'topic' | 'talk'>(isSpeakCategory(urlCategory) ? 'talk' : 'topic')
  const [category, setCategory] = useState<SpeakCategory | null>(isSpeakCategory(urlCategory) ? urlCategory : null)
  const [promptIdx, setPromptIdx] = useState(Number.isInteger(urlQ) && urlQ >= 0 ? urlQ : 0)
  const [escapeOpen, setEscapeOpen] = useState(false)

  useEffect(() => {
    setCurrentTip(VOCAL_TIPS[Math.floor(Math.random() * VOCAL_TIPS.length)])
  }, [])

  const { state, duration, audioBlob, audioUrl, analyserNode, start, stop, markAndStopAfter, markSec, reset, error, micDenied } =
    useAudioRecorder(MAX_SECONDS)
  useEffect(() => { if (micDenied) setEscapeOpen(true) }, [micDenied])
  // 녹음 중 단계: 말하기 → "아~"
  const phase: 'talk' | 'vowel' | null = state === 'recording' ? (markSec == null ? 'talk' : 'vowel') : null
  const speechSec = markSec ?? duration
  const [vowelLeft, setVowelLeft] = useState(3)
  useEffect(() => {
    if (phase !== 'vowel') return
    setVowelLeft(3)
    const t = setInterval(() => setVowelLeft((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(t)
  }, [phase])
  // 30초가 되면 자동으로 "아~"로
  useEffect(() => {
    if (phase === 'talk' && duration >= TALK_SECONDS) markAndStopAfter(VOWEL_MS)
  }, [phase, duration, markAndStopAfter])

  useWaveform({
    analyser: analyserNode,
    canvasRef,
    active: state === 'recording',
  })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => setIsPlaying(false)
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [audioUrl])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) { audio.pause(); setIsPlaying(false) } else { audio.play(); setIsPlaying(true) }
  }

  const handleProceed = async () => {
    if (!audioBlob) return
    setAnalyzing(true)
    setAnalyzeProgress(0)
    setAnalyzeError(null)
    trackEvent('analyze_started', { duration_sec: duration, audio_size: audioBlob.size, category: category ?? 'none' })
    if (category) sessionStorage.setItem(SPEAK_PROMPT_KEY, JSON.stringify({ category, index: promptIdx }))

    // fake progress animation while waiting for API
    const progressInterval = setInterval(() => {
      setAnalyzeProgress((p) => Math.min(p + Math.random() * 6 + 2, 90))
    }, 300)

    try {
      // 말한 부분(감정, 억양, 말 속도)과 "아~"(떨림)로 나눈다. OpenAI 오디오 모델은 wav/mp3만 받는다.
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

      // 녹음은 어디에도 남기지 않는다. 로그인했으면 수치만 계정에 저장한다.
      void saveNewAnalysis(emotionData.emotions, audioFeatures)

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

  // ── 주제 고르기 ──────────────────────────────────────────
  if (stage === 'topic' || !category) {
    return (
      <OnboardingShell
        step={0} total={2} onBack={() => router.push('/')}
        footer={
          <PrimaryButton
            disabled={!category}
            onClick={() => {
              if (!category) return
              setPromptIdx(pickPromptIndex(category))
              setStage('talk')
              trackEvent('record_category_selected', { category })
            }}
          >
            다음
          </PrimaryButton>
        }
      >
        <OnboardingTitle sub="30초 동안 편하게 말하면, 오늘 목소리가 어떤 페르소나처럼 들리는지 알려 드려요.">{'어떤 방식으로\n말해 볼까요?'}</OnboardingTitle>
        <div className="space-y-3" role="radiogroup" aria-label="말하기 방식">
          {SPEAK_CATEGORIES.map((c) => (
            <OptionCard key={c.id} icon={CATEGORY_ICON[c.id]} title={c.label} sub={c.sub} selected={category === c.id} onSelect={() => setCategory(c.id)} />
          ))}
        </div>
      </OnboardingShell>
    )
  }

  // ── 말하기 ────────────────────────────────────────────
  const cat = getSpeakCategory(category)
  const prompt = cat.prompts[promptIdx] ?? cat.prompts[0]
  const remaining = Math.max(0, TALK_SECONDS - duration)
  const canFinishTalk = speechSec >= MIN_SPEECH_SECONDS

  return (
    <OnboardingShell
      step={1} total={2}
      onBack={() => { if (state === 'recording') stop(); reset(); setStage('topic') }}
      footer={
        <div className="space-y-3">
          {state === 'idle' && (
            <PrimaryButton onClick={start}><span className="inline-flex items-center gap-2"><Mic size={20} />녹음 시작</span></PrimaryButton>
          )}
          {phase === 'talk' && (
            <PrimaryButton disabled={!canFinishTalk} onClick={() => markAndStopAfter(VOWEL_MS)}>
              {canFinishTalk ? '다 말했어요, 이제 "아~"' : `${MIN_SPEECH_SECONDS - duration}초만 더 말해 주세요`}
            </PrimaryButton>
          )}
          {phase === 'vowel' && (
            <button type="button" disabled className="w-full h-14 rounded-full bg-secondary text-foreground text-[16px] font-bold">
              &ldquo;아~&rdquo; 녹음 중, 자동으로 끝나요
            </button>
          )}
          {state === 'recorded' && (
            <>
              <PrimaryButton disabled={!canFinishTalk} onClick={handleProceed}>이 목소리로 분석하기</PrimaryButton>
              {!canFinishTalk && <p className="text-center text-[13px] text-muted-foreground">{MIN_SPEECH_SECONDS}초 이상 말해야 분석할 수 있어요</p>}
            </>
          )}
        </div>
      }
    >
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <p className="eyebrow">{cat.label}</p>
          {state === 'recording' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-background">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />REC
            </span>
          )}
        </div>
        <h1 className="mt-3 text-[24px] leading-[1.35] font-black tracking-[-0.02em] text-foreground">{prompt.q}</h1>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {prompt.hints.map((h) => <Pill key={h}>{h}</Pill>)}
        </div>
        {state === 'idle' && (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => { setPromptIdx(pickPromptIndex(category, promptIdx)); trackEvent('record_prompt_shuffled', { category }) }}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-[14px] font-semibold text-accent active:bg-secondary"
            >
              <RefreshCw size={15} aria-hidden="true" />다른 질문
            </button>
            <p className="text-[12px] text-muted-foreground">이름이나 회사 이름은 빼도 돼요. 녹음은 저장하지 않아요.</p>
          </div>
        )}
      </div>

      <div className="mt-10 text-center" aria-live="polite">
        {phase === 'vowel' ? (
          <>
            <p className="text-[72px] leading-none font-black tracking-[-0.03em] text-foreground">아~</p>
            <p className="mt-3 text-[15px] text-muted-foreground">편한 높이로 길게, {vowelLeft > 0 ? `${vowelLeft}초` : '끝!'}</p>
          </>
        ) : state === 'recorded' ? (
          <>
            <p className="text-[56px] leading-none font-black tracking-[-0.03em] text-foreground tabular-nums">{Math.round(speechSec)}<span className="text-[24px]">초</span></p>
            <p className="mt-3 text-[15px] text-muted-foreground">말한 시간이에요. 들어 보고 분석해 보세요.</p>
          </>
        ) : (
          <>
            <p className={`text-[88px] leading-none font-black tracking-[-0.04em] tabular-nums ${state === 'recording' ? 'text-foreground' : 'text-border'}`}>{remaining}</p>
            <p className="mt-3 text-[15px] text-muted-foreground">
              {state === 'idle' ? '녹음을 누르면 30초 동안 말해요. 다 말하면 "아~"를 3초 내요.' : '편하게, 평소 말투 그대로요.'}
            </p>
          </>
        )}
      </div>

      {/* 파형. 캔버스는 파형 훅이 잡고 있어야 해서 지우지 않고 감추기만 한다. */}
      <canvas ref={canvasRef} className={`mt-6 w-full ${state === 'recording' ? 'block' : 'hidden'}`} style={{ height: 64 }} aria-hidden="true" />

      {state === 'recorded' && audioUrl && (
        <div className="mt-6 flex justify-center gap-3">
          <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
          <button type="button" onClick={togglePlay} className="h-12 px-5 rounded-full bg-secondary text-[15px] font-semibold text-foreground inline-flex items-center gap-2 active:bg-border/60">
            {isPlaying ? <><Pause size={17} />일시정지</> : <><Play size={17} />들어 보기</>}
          </button>
          <button type="button" onClick={reset} aria-label="다시 녹음" className="h-12 px-5 rounded-full bg-secondary text-[15px] font-semibold text-foreground inline-flex items-center gap-2 active:bg-border/60">
            <RotateCcw size={17} />다시
          </button>
        </div>
      )}

      {(error || analyzeError) && (
        <div className="mt-6 flex items-start gap-2 rounded-2xl bg-caution-tint p-3 text-[13px] text-caution" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{error ?? analyzeError}</p>
        </div>
      )}
      <InAppEscapeSheet
        open={escapeOpen && micDenied}
        onClose={() => setEscapeOpen(false)}
        url={`${typeof window === 'undefined' ? '' : window.location.origin}/record?category=${category}&q=${promptIdx}`}
      />
    </OnboardingShell>
  )
}
