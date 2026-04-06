'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Square, Dumbbell } from 'lucide-react'
import { PERSONAS, type Persona } from '@/lib/personas'
import { Badge } from '@/components/ui/badge'

const EMOTION_KO: Record<string, string> = {
  'Admiration': '감탄', 'Adoration': '경애', 'Aesthetic Appreciation': '미적 감상',
  'Amusement': '즐거움', 'Awe': '경외감', 'Awkwardness': '어색함',
  'Calmness': '차분함', 'Concentration': '집중', 'Contemplation': '사색',
  'Contentment': '만족감', 'Craving': '갈망', 'Determination': '결단력',
  'Disappointment': '실망', 'Doubt': '의심', 'Ecstasy': '황홀감',
  'Empathic Pain': '공감적 아픔', 'Enthusiasm': '열정', 'Excitement': '흥분',
  'Interest': '호기심', 'Joy': '기쁨', 'Love': '사랑', 'Nostalgia': '향수',
  'Pain': '아파함', 'Pride': '자부심', 'Realization': '깨달음',
  'Relief': '안도감', 'Romance': '설렘', 'Sympathy': '공감·위로',
  'Triumph': '승리감', 'Surprise (positive)': '기분 좋은 놀람',
}

// ── Audio playback hook ───────────────────────────────────
// sampleAudio 있으면 <audio> 재생, 없으면 TTS 폴백
function usePersonaAudio() {
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const toggle = (persona: Persona) => {
    // 이미 재생 중이면 정지
    if (speakingId === persona.id) {
      audioRef.current?.pause()
      audioRef.current = null
      window.speechSynthesis?.cancel()
      setSpeakingId(null)
      return
    }

    // 다른 페르소나 재생 중이면 먼저 정지
    audioRef.current?.pause()
    audioRef.current = null
    window.speechSynthesis?.cancel()

    setSpeakingId(persona.id)

    if (persona.sampleAudio) {
      // 실제 오디오 파일 재생
      const audio = new Audio(persona.sampleAudio)
      audioRef.current = audio
      audio.onended = () => setSpeakingId(null)
      audio.onerror = () => setSpeakingId(null)
      audio.play().catch(() => setSpeakingId(null))
    } else {
      // TTS 폴백
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setSpeakingId(null)
        return
      }
      const utterance = new SpeechSynthesisUtterance(persona.script)
      utterance.lang = 'ko-KR'
      utterance.rate = 0.88
      utterance.onend = () => setSpeakingId(null)
      utterance.onerror = () => setSpeakingId(null)
      window.speechSynthesis.speak(utterance)
    }
  }

  return { speakingId, toggle }
}

// ── Persona card ──────────────────────────────────────────
function PersonaCard({
  persona,
  isSpeaking,
  onToggleListen,
  onStartTraining,
}: {
  persona: Persona
  isSpeaking: boolean
  onToggleListen: () => void
  onStartTraining: () => void
}) {
  return (
    <div className="glass rounded-3xl p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl shrink-0">{persona.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-sm font-bold text-foreground">{persona.name}</h2>
            <Badge className="bg-primary/10 text-primary border-0 text-[10px] shrink-0">
              {persona.category}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{persona.description}</p>
        </div>
      </div>

      {/* Emotion tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {persona.emotions.map((e) => (
          <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {EMOTION_KO[e] ?? e}
          </span>
        ))}
      </div>

      {/* Script preview */}
      <p className="text-[11px] text-muted-foreground/70 italic leading-relaxed mb-4 border-l-2 border-primary/30 pl-3">
        &ldquo;{persona.script.length > 55 ? persona.script.slice(0, 55) + '…' : persona.script}&rdquo;
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onToggleListen}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors shrink-0 ${
            isSpeaking
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
          }`}
        >
          {isSpeaking ? <Square size={12} /> : <Play size={12} />}
          {isSpeaking ? '정지' : '시범 듣기'}
        </button>

        <button
          onClick={onStartTraining}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm active:scale-[0.98] transition-transform"
        >
          <Dumbbell size={12} className="shrink-0" />
          이 페르소나로 훈련 시작
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────
export default function PersonasClient() {
  const router = useRouter()
  const { speakingId, toggle } = usePersonaAudio()

  const handleStartTraining = (persona: Persona) => {
    window.speechSynthesis?.cancel()
    // audio 정지는 usePersonaAudio 내부에서 처리되므로 여기선 생략
    sessionStorage.setItem(
      'trainingTarget',
      JSON.stringify({ emotions: persona.emotions, personaId: persona.id }),
    )
    router.push('/training')
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 active:opacity-60"
        >
          <ArrowLeft size={16} />
          돌아가기
        </button>
        <h1 className="text-xl font-black text-foreground">페르소나 탐색</h1>
        <p className="text-sm text-muted-foreground mt-1">
          목표로 삼고 싶은 페르소나를 골라 시범 음성을 들어보세요
        </p>
      </div>

      {/* Cards */}
      <div className="px-4 space-y-3">
        {PERSONAS.map((persona) => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            isSpeaking={speakingId === persona.id}
            onToggleListen={() => toggle(persona)}
            onStartTraining={() => handleStartTraining(persona)}
          />
        ))}
      </div>
    </div>
  )
}
