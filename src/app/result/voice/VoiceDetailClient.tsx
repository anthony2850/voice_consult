'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, AudioWaveform, ChevronLeft, Dumbbell, Gauge, Mic, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'
import { pickScene, type SceneResult } from '@/lib/voiceScene'
import { validateEmotionMap } from '@/lib/voiceAnalysis'
import PersonaRadarChart from '@/components/PersonaRadarChart'
import { type AudioFeatures } from '@/lib/extractAudioFeatures'
import ConcernsModal from '@/components/training/ConcernsModal'
import { PageHeader } from '@/components/ds'
import { useConcerns } from '@/hooks/useConcerns'
import {
  calcVoiceScores,
  suggestConcerns,
  CONCERN_THRESHOLD,
  getStabilityDesc,
  getPaceDesc,
  getExpressivenessDesc,
  expressivenessCues,
  getPitchToneLabel,
} from '@/lib/voiceScores'

/** "억양 변화 18%, 세기 변화 95%" (평균 대비 출렁임) */
function expressivenessDetail(f: AudioFeatures): string {
  const { pitchCV, rmsCV } = expressivenessCues(f)
  const pct = (x: number | null) => (x == null ? '측정 안 됨' : `${Math.round(x * 100)}%`)
  return `억양 변화 ${pct(pitchCV)}, 세기 변화 ${pct(rmsCV)} (평균 대비 출렁임)`
}

// ── Score Card ────────────────────────────────────────────
function ScoreCard({
  icon: Icon, title, score, description, detail, animate,
}: {
  icon: LucideIcon; title: string; score: number; description: string; detail?: string; animate: boolean
}) {
  return (
    <section className="rounded-[28px] bg-secondary p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Icon size={20} className="text-accent shrink-0" aria-hidden="true" />
        <h2 className="text-[16px] font-bold text-foreground">{title}</h2>
        <span className={`ml-auto text-[32px] leading-none font-black tracking-[-0.03em] tabular-nums text-foreground`}>{score}</span>
      </div>
      <div className="w-full bg-card rounded-full h-3 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out bg-accent`}
          style={{ width: animate ? `${score}%` : '0%' }}
        />
      </div>
      <p className="text-[14px] text-foreground/80">{description}</p>
      {detail && <p className="text-[12px] text-muted-foreground mt-1">{detail}</p>}
    </section>
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
  scene: SceneResult | null
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
      scene: rawEmotions ? pickScene(rawEmotions, features) : null,
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
    trackEvent('result_train_clicked', {
      persona_id: loaded?.scene?.id ?? 'unknown',
      weakest_axis: weakest?.key ?? 'unknown',
    })
    router.push('/training')
  }

  if (loaded === undefined) return null

  if (!loaded || !scores || !weakest) {
    return (
      <div className="flex min-h-[calc(100vh-84px)] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 w-16 h-16 rounded-full bg-secondary flex items-center justify-center" aria-hidden="true"><Mic size={28} className="text-accent" /></div>
        <h1 className="mb-2 text-xl font-bold text-foreground">표시할 목소리 진단이 없어요</h1>
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
          목소리를 녹음하면 안정감, 전달력, 표현력을 측정해 드려요.
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
  // 그래프 이름표는 짧은 이름 — 긴 이름은 양옆이 화면 밖으로 잘린다
  for (const a of AXES) userScores[a.short] = scores[a.key]

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <PageHeader
        back={{ label: '페르소나 결과', onClick: () => router.push('/result') }}
        eyebrow="내 목소리 진단"
        title={summary}
      />

      <div className="mt-4 px-5 space-y-4">
        {/* Radar */}
        <section className="rounded-[28px] bg-secondary p-6">
          <h2 className="text-[16px] font-bold text-foreground mb-4">목소리 품질 분석</h2>
          <PersonaRadarChart axes={AXES.map((a) => a.short)} userScores={userScores} animate={animate} />
        </section>

        <ScoreCard
          icon={AudioWaveform}
          title="목소리 안정감"
          score={scores.stability}
          description={getStabilityDesc(scores.stability)}
          detail={`Jitter ${features.voice_quality.jitter_rel_pct.toFixed(2)}%, Shimmer ${features.voice_quality.shimmer_rel_pct.toFixed(2)}%, ${features.voice_quality.task === 'vowel' ? '"아~" 3초로 측정' : '"아~"가 잡히지 않아 말하기 구간으로 잰 참고값'}`}
          animate={animate}
        />
        <ScoreCard
          icon={Gauge}
          title="말하기 여유 및 전달력"
          score={scores.pace}
          description={getPaceDesc(scores.pace, features.rhythm.onsets_per_second)}
          detail={`초당 ${features.rhythm.onsets_per_second.toFixed(1)}음절, 총 ${features.rhythm.onset_count}음절, ${features.duration_sec.toFixed(1)}초`}
          animate={animate}
        />
        <ScoreCard
          icon={Activity}
          title="생동감 및 표현력"
          score={scores.expressiveness}
          description={getExpressivenessDesc(scores.expressiveness)}
          detail={expressivenessDetail(features)}
          animate={animate}
        />

        {/* Raw numbers, collapsed by default */}
        <details className="rounded-[28px] bg-secondary px-6 py-5 group">
          <summary className="flex items-center gap-2 cursor-pointer list-none text-[16px] font-bold text-foreground">
            피치 상세 수치
            <span className={`ml-auto text-xs font-bold text-accent`}>
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
          className="w-full h-14 px-4 rounded-full gradient-primary text-primary-foreground text-[16px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
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
