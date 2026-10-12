'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'
import { type Persona, normalizeEmotionScore, findBestPersona } from '@/lib/personas'
import { validateEmotionMap } from '@/lib/voiceAnalysis'
import PersonaRadarChart from '@/components/PersonaRadarChart'
import { type AudioFeatures } from '@/lib/extractAudioFeatures'
import ConcernsModal from '@/components/training/ConcernsModal'
import { useConcerns } from '@/hooks/useConcerns'
import {
  calcVoiceScores,
  suggestConcerns,
  CONCERN_THRESHOLD,
  getScoreColor,
  getScoreBarColor,
  getStabilityDesc,
  getPaceDesc,
  getExpressivenessDesc,
  getPitchToneLabel,
  getPitchToneColor,
} from '@/lib/voiceScores'

// ── Score Card ────────────────────────────────────────────
function ScoreCard({
  emoji, title, score, description, detail, animate,
}: {
  emoji: string; title: string; score: number; description: string; detail?: string; animate: boolean
}) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">{emoji}</span>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        <span className={`ml-auto text-3xl font-black tabular-nums ${getScoreColor(score)}`}>{score}</span>
      </div>
      <div className="w-full bg-border rounded-full h-2.5 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getScoreBarColor(score)}`}
          style={{ width: animate ? `${score}%` : '0%' }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {detail && <p className="text-[10px] text-muted-foreground/60 mt-1">{detail}</p>}
    </div>
  )
}

// ── Stat row (collapsed details) ──────────────────────────
function StatRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground tabular-nums">
        {value}
        {unit && <span className="text-muted-foreground font-normal ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}

const AXES = [
  { key: 'stability', label: '목소리 안정감', short: '안정감' },
  { key: 'pace', label: '말하기 여유 및 전달력', short: '전달력' },
  { key: 'expressiveness', label: '생동감 및 표현력', short: '표현력' },
] as const

interface Loaded {
  features: AudioFeatures
  persona: Persona | null
  rawEmotions: Record<string, number>
}

/** Read what the record page left in sessionStorage. null = nothing usable. */
function readSession(): Loaded | null {
  try {
    const stored = sessionStorage.getItem('audioFeatures')
    const features = stored ? (JSON.parse(stored) as AudioFeatures) : null
    if (!features) return null
    const storedEmotions = sessionStorage.getItem('voiceEmotions')
    const rawEmotions = validateEmotionMap(storedEmotions ? JSON.parse(storedEmotions) : null)
    return {
      features,
      rawEmotions: rawEmotions ?? {},
      persona: rawEmotions ? findBestPersona(rawEmotions).persona : null,
    }
  } catch {
    return null
  }
}

// ── Main ──────────────────────────────────────────────────
export default function VoiceDetailClient() {
  const router = useRouter()
  // undefined = loading, null = nothing to show
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined)
  const [animate, setAnimate] = useState(false)

  const { concerns, loading: concernsLoading, save: saveConcerns } = useConcerns()
  const [showConcerns, setShowConcerns] = useState(false)
  const autoOpened = useRef(false)

  useEffect(() => {
    // sessionStorage is client-only, so it has to be read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(readSession())
    const t = setTimeout(() => setAnimate(true), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (loaded) trackEvent('voice_detail_view')
  }, [loaded])

  const scores = useMemo(() => (loaded ? calcVoiceScores(loaded.features) : null), [loaded])
  const suggestedFromScores = useMemo(() => (scores ? suggestConcerns(scores) : []), [scores])

  // 진단을 처음 본 사용자에게 고민 모달 한 번 자동 노출 (아직 고민을 고르지 않은 경우만)
  useEffect(() => {
    if (autoOpened.current || concernsLoading || !scores) return
    autoOpened.current = true
    if (concerns.length === 0 && suggestedFromScores.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowConcerns(true)
    }
  }, [scores, concerns, concernsLoading, suggestedFromScores])

  const weakest = useMemo(() => {
    if (!scores) return null
    return AXES.reduce((min, a) => (scores[a.key] < scores[min.key] ? a : min), AXES[0])
  }, [scores])

  const handleTrain = () => {
    const persona = loaded?.persona ?? null
    const rawEmotions = loaded?.rawEmotions ?? {}
    const belowEmotions = persona
      ? persona.emotions.filter((e) => {
          const userScore = normalizeEmotionScore(e, rawEmotions)
          return (persona.targetScores[e] ?? 0) - userScore > 10
        })
      : []
    trackEvent('result_train_clicked', {
      persona_id: persona?.id ?? 'unknown',
      gap_emotion_count: belowEmotions.length,
      weakest_axis: weakest?.key ?? 'unknown',
    })
    if (persona) {
      sessionStorage.setItem(
        'trainingTarget',
        JSON.stringify({ emotions: belowEmotions.length > 0 ? belowEmotions : persona.emotions, personaId: persona.id }),
      )
    }
    router.push('/training')
  }

  if (loaded === undefined) return null

  if (!loaded || !scores || !weakest) {
    return (
      <div className="flex min-h-[calc(100vh-84px)] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 text-5xl" aria-hidden="true">🎙️</div>
        <h1 className="mb-2 text-xl font-bold text-foreground">표시할 목소리 진단이 없어요</h1>
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
          목소리를 녹음하면 안정감·전달력·표현력을 측정해 드려요.
        </p>
        <Button
          size="lg"
          onClick={() => router.push('/record')}
          className="h-12 rounded-2xl gradient-primary border-0 px-6 font-bold"
        >
          목소리 녹음하러 가기
        </Button>
      </div>
    )
  }

  const { features } = loaded
  const allGood = scores[weakest.key] >= CONCERN_THRESHOLD
  const summary = allGood
    ? '세 영역 모두 고르게 좋아요'
    : `${weakest.short}이 가장 아쉬워요`

  const userScores: Record<string, number> = {}
  for (const a of AXES) userScores[a.label] = scores[a.key]

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* ── Header ── */}
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-8 pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/result')}
            className="flex items-center gap-1 text-white/80 text-xs mb-4 active:opacity-70"
          >
            <ChevronLeft size={14} />
            페르소나 결과
          </button>
          <p className="text-white/80 text-xs font-medium mb-1">내 목소리 진단</p>
          <h1 className="text-2xl font-black text-white">{summary}</h1>
        </div>
      </div>

      <div className="relative z-10 mt-4 px-4 space-y-4">
        {/* Radar */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📊</span>
            <h2 className="text-sm font-bold text-foreground">목소리 품질 분석</h2>
          </div>
          <PersonaRadarChart axes={AXES.map((a) => a.label)} userScores={userScores} animate={animate} />
        </div>

        <ScoreCard
          emoji="🎤"
          title="목소리 안정감"
          score={scores.stability}
          description={getStabilityDesc(scores.stability)}
          detail={`Jitter ${features.voice_quality.jitter_rel_pct.toFixed(2)}% · Shimmer ${features.voice_quality.shimmer_rel_pct.toFixed(2)}%`}
          animate={animate}
        />
        <ScoreCard
          emoji="🗣️"
          title="말하기 여유 및 전달력"
          score={scores.pace}
          description={getPaceDesc(scores.pace, features.rhythm.onsets_per_second)}
          detail={`초당 ${features.rhythm.onsets_per_second.toFixed(1)}음절 · 총 ${features.rhythm.onset_count}회 · ${features.duration_sec.toFixed(1)}초`}
          animate={animate}
        />
        <ScoreCard
          emoji="✨"
          title="생동감 및 표현력"
          score={scores.expressiveness}
          description={getExpressivenessDesc(scores.expressiveness)}
          detail={`피치 변화폭 ${features.pitch.std_hz.toFixed(1)}Hz · 평균 음량 ${features.energy.db_mean.toFixed(1)}dB`}
          animate={animate}
        />

        {/* Raw numbers, collapsed by default */}
        <details className="glass rounded-3xl px-5 py-4 group">
          <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-bold text-foreground">
            <span className="text-base">🎵</span>
            피치 상세 수치
            <span className={`ml-auto text-xs font-bold ${getPitchToneColor(features.pitch.mean_hz)}`}>
              {getPitchToneLabel(features.pitch.mean_hz)}
            </span>
            <ChevronLeft size={14} className="-rotate-90 group-open:rotate-90 transition-transform text-muted-foreground" />
          </summary>
          <div className="mt-3">
            <StatRow label="평균 피치" value={features.pitch.mean_hz.toFixed(1)} unit="Hz" />
            <StatRow label="최솟값" value={features.pitch.min_hz.toFixed(1)} unit="Hz" />
            <StatRow label="최댓값" value={features.pitch.max_hz.toFixed(1)} unit="Hz" />
            <StatRow label="유성음 비율" value={(features.pitch.voiced_ratio * 100).toFixed(1)} unit="%" />
          </div>
        </details>

        {/* ── Single CTA ── */}
        <button
          onClick={handleTrain}
          className="w-full h-13 px-4 py-3.5 rounded-2xl gradient-primary text-gray-900 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30 active:scale-[0.98] transition-transform"
        >
          <Dumbbell size={16} className="shrink-0" />
          <span>{allGood ? '내 목소리 더 다듬기' : `${weakest.short} 보완 훈련 시작하기`}</span>
        </button>
      </div>

      <ConcernsModal
        open={showConcerns}
        initial={concerns.length > 0 ? concerns : suggestedFromScores}
        onClose={() => setShowConcerns(false)}
        onSave={saveConcerns}
        title="내 목소리 고민 확인"
      />
    </div>
  )
}
