'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Share2, RotateCcw, FileText, Sparkles, Dumbbell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'
import { type Persona, normalizeHumeScore, findBestPersona } from '@/lib/personas'
import PersonaRadarChart from '@/components/PersonaRadarChart'
import { type AudioFeatures } from '@/lib/extractAudioFeatures'
import LoginCTA from '@/components/LoginCTA'

// ── Korean labels for 49 emotions ────────────────────────
const EMOTION_KO: Record<string, string> = {
  'Admiration': '감탄',
  'Adoration': '경애',
  'Aesthetic Appreciation': '미적 감상',
  'Amusement': '즐거움',
  'Anger': '분노',
  'Anxiety': '불안',
  'Awe': '경외감',
  'Awkwardness': '어색함',
  'Boredom': '지루함',
  'Calmness': '차분함',
  'Concentration': '집중',
  'Confusion': '혼란',
  'Contemplation': '사색',
  'Contempt': '경멸',
  'Contentment': '만족감',
  'Craving': '갈망',
  'Desire': '욕망',
  'Determination': '결단력',
  'Disappointment': '실망',
  'Disgust': '혐오',
  'Distress': '고통',
  'Doubt': '의심',
  'Ecstasy': '황홀감',
  'Embarrassment': '당혹감',
  'Empathic Pain': '공감적 아픔',
  'Enthusiasm': '열정',
  'Entrancement': '매혹',
  'Envy': '질투',
  'Excitement': '흥분',
  'Fear': '두려움',
  'Guilt': '죄책감',
  'Horror': '공포',
  'Interest': '호기심',
  'Joy': '기쁨',
  'Love': '사랑',
  'Nostalgia': '향수',
  'Pain': '통증',
  'Pride': '자부심',
  'Realization': '깨달음',
  'Relief': '안도',
  'Romance': '낭만',
  'Sadness': '슬픔',
  'Satisfaction': '성취감',
  'Shame': '수치심',
  'Surprise (negative)': '놀람 (부정)',
  'Surprise (positive)': '놀람 (긍정)',
  'Sympathy': '공감',
  'Tiredness': '피로감',
  'Triumph': '승리감',
}

// ── Emotion Bar ───────────────────────────────────────────
function EmotionBar({
  name,
  score,
  maxScore,
  rank,
  animate,
}: {
  name: string
  score: number
  maxScore: number
  rank: number
  animate: boolean
}) {
  const pct = Math.round((score / maxScore) * 100)
  const isTop5 = rank <= 5

  return (
    <div className={`flex items-center gap-3 ${isTop5 ? 'py-1' : 'py-0.5'}`}>
      {isTop5 && (
        <span className="text-[10px] font-black text-primary w-4 shrink-0 text-center">
          {rank}
        </span>
      )}
      {!isTop5 && <span className="w-4 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className={`truncate ${isTop5 ? 'text-xs font-bold text-foreground' : 'text-[11px] text-muted-foreground'}`}>
            {EMOTION_KO[name] ?? name}
          </span>
          <span className={`ml-2 shrink-0 tabular-nums ${isTop5 ? 'text-xs font-bold text-primary' : 'text-[10px] text-muted-foreground'}`}>
            {(score * 100).toFixed(1)}%
          </span>
        </div>
        <div className={`rounded-full bg-border overflow-hidden ${isTop5 ? 'h-2.5' : 'h-1.5'}`}>
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${isTop5 ? 'gradient-primary' : 'bg-muted-foreground/40'}`}
            style={{ width: animate ? `${pct}%` : '0%' }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group/tip cursor-help">
      <span className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground border border-muted-foreground/30 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">?</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 text-[10px] text-white bg-gray-900 rounded-xl opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 text-center leading-relaxed shadow-lg">
        {text}
      </span>
    </span>
  )
}

// ── Feature stat row ──────────────────────────────────────
function StatRow({ label, value, unit, tooltip }: { label: string; value: string | number; unit?: string; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      <span className="text-xs font-semibold text-foreground tabular-nums">
        {typeof value === 'number' ? value.toFixed(2) : value}
        {unit && <span className="text-muted-foreground font-normal ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}

// ── Pitch tone label ──────────────────────────────────────
function getPitchToneLabel(hz: number): string {
  if (hz <= 220) return '낮은 편'
  if (hz <= 349) return '중간인 편'
  return '높은 편'
}

function getPitchToneColor(hz: number): string {
  if (hz <= 220) return 'text-blue-600'
  if (hz <= 349) return 'text-emerald-600'
  return 'text-violet-600'
}

// ── Score calculations ─────────────────────────────────────
function calcStabilityScore(jitter: number, shimmer: number): number {
  const j = Math.max(0, 1 - jitter / 1.0) * 100
  const s = Math.max(0, 1 - shimmer / 3.0) * 100
  return Math.round(j * 0.5 + s * 0.5)
}

function calcPaceScore(opsec: number): number {
  const optimal = 4.5
  const sigma = 1.8
  return Math.round(100 * Math.exp(-0.5 * Math.pow((opsec - optimal) / sigma, 2)))
}

function calcExpressivenessScore(stdHz: number, dbMean: number): number {
  const pitchVar = Math.min(100, (stdHz / 70) * 100)
  const dbScore = Math.min(100, Math.max(0, ((dbMean + 50) / 45) * 100))
  return Math.round(pitchVar * 0.6 + dbScore * 0.4)
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-violet-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-rose-600'
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-violet-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-rose-500'
}

function getStabilityDesc(score: number): string {
  if (score >= 80) return '떨림이 거의 없고 균일한 목소리예요'
  if (score >= 60) return '대체로 안정적인 목소리예요'
  if (score >= 40) return '목소리에 약간의 흔들림이 있어요'
  return '목소리 떨림이 다소 두드러져요'
}

function getPaceDesc(score: number, opsec: number): string {
  if (opsec < 2.5) return '말하는 속도가 다소 느린 편이에요'
  if (opsec > 6.5) return '말하는 속도가 다소 빠른 편이에요'
  if (score >= 80) return '듣기 좋은 여유 있는 속도예요'
  if (score >= 60) return '전반적으로 괜찮은 전달 속도예요'
  return '속도 조절에 약간 여유가 필요해요'
}

function getExpressivenessDesc(score: number): string {
  if (score >= 80) return '에너지 넘치고 표현력이 풍부해요'
  if (score >= 60) return '적절한 생동감이 느껴져요'
  if (score >= 40) return '약간의 음성 변화가 있어요'
  return '다소 단조로운 목소리 톤이에요'
}

// ── Score Card ────────────────────────────────────────────
function ScoreCard({
  emoji, title, score, description, detail, animate,
}: {
  emoji: string; title: string; score: number; description: string; detail?: string; animate: boolean
}) {
  const colorText = getScoreColor(score)
  const colorBar = getScoreBarColor(score)
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">{emoji}</span>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        <span className={`ml-auto text-3xl font-black tabular-nums ${colorText}`}>{score}</span>
      </div>
      <div className="w-full bg-border rounded-full h-2.5 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${colorBar}`}
          style={{ width: animate ? `${score}%` : '0%' }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {detail && <p className="text-[10px] text-muted-foreground/60 mt-1">{detail}</p>}
    </div>
  )
}

// ── Audio feature section ─────────────────────────────────
function AudioFeaturesSection({ features, animate }: { features: AudioFeatures; animate: boolean }) {
  const toneLabel = getPitchToneLabel(features.pitch.mean_hz)
  const toneColor = getPitchToneColor(features.pitch.mean_hz)

  const stabilityScore = calcStabilityScore(
    features.voice_quality.jitter_rel_pct,
    features.voice_quality.shimmer_rel_pct,
  )
  const paceScore = calcPaceScore(features.rhythm.onsets_per_second)
  const expressivenessScore = calcExpressivenessScore(features.pitch.std_hz, features.energy.db_mean)

  return (
    <div className="space-y-4">
      {/* Pitch */}
      <div className="glass rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🎵</span>
          <h2 className="text-sm font-bold text-foreground">피치 (Pitch / F0)</h2>
          <span className={`ml-auto text-xs font-bold ${toneColor}`}>{toneLabel}</span>
        </div>
        <StatRow label="평균 피치" value={features.pitch.mean_hz.toFixed(1)} unit="Hz" />
        <StatRow label="최솟값" value={features.pitch.min_hz.toFixed(1)} unit="Hz" />
        <StatRow label="최댓값" value={features.pitch.max_hz.toFixed(1)} unit="Hz" />
        <StatRow
          label="유성음 비율"
          value={(features.pitch.voiced_ratio * 100).toFixed(1)}
          unit="%"
          tooltip="전체 발화 중 실제로 성대가 떨려 소리가 난 구간의 비율이에요. 높을수록 목소리가 끊기지 않고 안정적으로 이어졌다는 의미예요."
        />
      </div>

      {/* 목소리 안정감 */}
      <ScoreCard
        emoji="🎤"
        title="목소리 안정감"
        score={stabilityScore}
        description={getStabilityDesc(stabilityScore)}
        detail={`Jitter ${features.voice_quality.jitter_rel_pct.toFixed(2)}% · Shimmer ${features.voice_quality.shimmer_rel_pct.toFixed(2)}%`}
        animate={animate}
      />

      {/* 말하기 여유 및 전달력 */}
      <ScoreCard
        emoji="🗣️"
        title="말하기 여유 및 전달력"
        score={paceScore}
        description={getPaceDesc(paceScore, features.rhythm.onsets_per_second)}
        detail={`초당 ${features.rhythm.onsets_per_second.toFixed(1)}음절 · 총 ${features.rhythm.onset_count}회 · ${features.duration_sec.toFixed(1)}초`}
        animate={animate}
      />

      {/* 생동감 및 표현력 */}
      <ScoreCard
        emoji="✨"
        title="생동감 및 표현력"
        score={expressivenessScore}
        description={getExpressivenessDesc(expressivenessScore)}
        detail={`피치 변화폭 ${features.pitch.std_hz.toFixed(1)}Hz · 평균 음량 ${features.energy.db_mean.toFixed(1)}dB`}
        animate={animate}
      />
    </div>
  )
}

// ── Mock emotions (49개 중 48개 반환) ────────────────────
function getMockEmotions(): Record<string, number> {
  const names = Object.keys(EMOTION_KO)
  return Object.fromEntries(names.map((n) => [n, Math.random() * 0.14 + 0.01]))
}

// ── Pre-register (Fake Door) component ───────────────────
function PreRegisterForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [emailError, setEmailError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!isValid) {
      setEmailError('올바른 이메일 주소를 입력해 주세요.')
      return
    }
    setEmailError('')
    trackEvent('submit_pre_register', { email_domain: email.split('@')[1] })
    setSubmitted(true)
    alert('사전 예약이 완료되었습니다!')
  }

  if (submitted) {
    return (
      <div className="glass rounded-3xl p-5 border border-primary/20 text-center">
        <Sparkles size={28} className="text-primary mx-auto mb-2" />
        <p className="text-sm font-bold text-foreground">사전 예약 완료!</p>
        <p className="text-xs text-muted-foreground mt-1">출시 시 가장 먼저 알려드릴게요.</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-3xl p-5 border border-primary/20">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">🎙️</span>
        <div>
          <p className="text-sm font-bold text-foreground">
            더 정밀한 맞춤형 AI 발성 훈련 플랜 받아보기
          </p>
          <Badge className="mt-1 bg-accent/20 text-accent border-0 text-[10px]">사전 예약</Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        목소리 분석 결과를 바탕으로 개인 맞춤 AI 발성 훈련 플랜을 제공합니다. 출시 시 우선 안내 드립니다.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email"
          placeholder="이메일 주소를 입력해 주세요"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
          className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {emailError && (
          <p className="text-xs text-destructive">{emailError}</p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full h-12 text-sm font-bold rounded-2xl gradient-primary border-0 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
        >
          사전 예약하기
        </Button>
      </form>
    </div>
  )
}

// ── Training CTA Button ───────────────────────────────────
function TrainingButton({
  belowEmotions,
  personaId,
}: {
  belowEmotions: string[]
  personaId: number
}) {
  const router = useRouter()
  const koNames = belowEmotions.map((e) => EMOTION_KO[e] ?? e)
  const label =
    koNames.length <= 3
      ? koNames.join(', ')
      : `${koNames.slice(0, 3).join(', ')} 외 ${koNames.length - 3}가지`

  const handleClick = () => {
    sessionStorage.setItem(
      'trainingTarget',
      JSON.stringify({ emotions: belowEmotions, personaId }),
    )
    router.push('/training')
  }

  return (
    <button
      onClick={handleClick}
      className="w-full mt-1 h-13 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-900/30 active:scale-[0.98] transition-transform"
    >
      <Dumbbell size={16} className="shrink-0" />
      <span className="text-center leading-snug">
        <span className="opacity-80 font-normal text-[12px]">{label}</span>
        <br />
        속성 높이는 발성 훈련 하러가기
      </span>
    </button>
  )
}

// ── Persona Gap Analysis Section ─────────────────────────
function PersonaGapSection({
  persona,
  similarity,
  rawEmotions,
  animate,
}: {
  persona: Persona
  similarity: number
  rawEmotions: Record<string, number>
  animate: boolean
}) {
  const userScores: Record<string, number> = {}
  for (const e of persona.emotions) {
    userScores[e] = normalizeHumeScore(e, rawEmotions)
  }

  const gaps = persona.emotions.map((e) => ({
    name: e,
    target: persona.targetScores[e] ?? 0,
    user: userScores[e],
    gap: (persona.targetScores[e] ?? 0) - userScores[e],
  }))

  const below = gaps.filter((g) => g.gap > 10).sort((a, b) => b.gap - a.gap)
  const above = gaps.filter((g) => g.gap < -10).sort((a, b) => a.gap - b.gap)

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{persona.emoji}</span>
        <h2 className="text-sm font-bold text-foreground">페르소나 매칭 결과</h2>
        <span className="ml-auto text-lg font-black text-primary tabular-nums">{similarity}%</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        내 목소리는 <strong className="text-foreground">{persona.name}</strong> 페르소나와 가장 잘 맞아요
      </p>

      {/* Radar Chart */}
      <div className="mb-5">
        <PersonaRadarChart
          axes={persona.emotions}
          targetScores={persona.targetScores}
          userScores={userScores}
          animate={animate}
        />
        <div className="flex items-center justify-center gap-4 mt-2">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-3 h-1 rounded-full bg-violet-500/60 inline-block" style={{ border: '1px dashed rgba(139,92,246,0.8)' }} />
            목표 페르소나
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-3 h-1 rounded-full bg-emerald-500 inline-block" />
            내 목소리
          </span>
        </div>
      </div>

      {/* Emotion bars */}
      <div className="space-y-3 mb-4">
        {gaps.map((g) => {
          const isBelow = g.gap > 10
          const isAbove = g.gap < -10
          const barColor = isBelow ? 'bg-rose-500' : isAbove ? 'bg-emerald-500' : 'bg-violet-500'
          const label = EMOTION_KO[g.name] ?? g.name
          return (
            <div key={g.name}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    목표 <span className="text-foreground font-bold">{g.target}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    내 점수 <span className={`font-bold ${isBelow ? 'text-rose-400' : isAbove ? 'text-emerald-400' : 'text-violet-400'}`}>{g.user}</span>
                  </span>
                </div>
              </div>
              {/* Target track */}
              <div className="relative h-2.5 rounded-full bg-border overflow-hidden">
                {/* Target marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-violet-400 z-10"
                  style={{ left: `${g.target}%` }}
                />
                {/* User bar */}
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} opacity-80`}
                  style={{ width: animate ? `${g.user}%` : '0%' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Gap summary */}
      {(below.length > 0 || above.length > 0) && (
        <div className="space-y-2 pt-3 border-t border-border/40">
          {below.length > 0 && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3">
              <p className="text-[11px] font-bold text-rose-400 mb-1">✦ 이 페르소나와 다른 점</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {below.map((g) => EMOTION_KO[g.name] ?? g.name).join(', ')} 영역이 이 페르소나보다 낮게 나왔어요.
              </p>
            </div>
          )}
          {above.length > 0 && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-[11px] font-bold text-emerald-400 mb-1">✦ 이 페르소나보다 강한 점</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {above.map((g) => EMOTION_KO[g.name] ?? g.name).join(', ')} 영역은 페르소나 기준보다 더 높게 나왔어요.
              </p>
            </div>
          )}
          {below.length === 0 && above.length === 0 && (
            <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3">
              <p className="text-[11px] font-bold text-violet-400 mb-1">✦ 완벽한 매칭</p>
              <p className="text-[11px] text-muted-foreground">모든 감정이 이 페르소나와 아주 가깝게 나왔어요!</p>
            </div>
          )}

          {/* Training CTA */}
          {below.length > 0 && (
            <TrainingButton
              belowEmotions={below.map((g) => g.name)}
              personaId={persona.id}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────
function encodeEmotions(emotions: Record<string, number>): string {
  const compact = Object.fromEntries(
    Object.entries(emotions).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
  )
  // URL-safe base64: +→-, /→_, 패딩 = 제거
  return btoa(encodeURIComponent(JSON.stringify(compact)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodeEmotions(encoded: string): Record<string, number> | null {
  try {
    // URL-safe base64 복원
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4)
    return JSON.parse(decodeURIComponent(atob(padded)))
  } catch {
    return null
  }
}

export default function ResultClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [emotions, setEmotions] = useState<{ name: string; score: number }[]>([])
  const [rawEmotionMap, setRawEmotionMap] = useState<Record<string, number>>({})
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures | null>(null)
  const [animate, setAnimate] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [similarity, setSimilarity] = useState(0)

  useEffect(() => {
    let raw: Record<string, number>
    // URL param이 있으면 공유 링크 → param 우선 사용
    const sharedData = searchParams.get('d')
    if (sharedData) {
      raw = decodeEmotions(sharedData) ?? getMockEmotions()
    } else {
      try {
        const stored = sessionStorage.getItem('voiceEmotions')
        raw = stored ? JSON.parse(stored) : getMockEmotions()
      } catch {
        raw = getMockEmotions()
      }
    }
    const sorted = Object.entries(raw)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
    setEmotions(sorted)
    setRawEmotionMap(raw)

    const { persona: matched, similarity: sim } = findBestPersona(raw)
    setPersona(matched)
    setSimilarity(sim)

    try {
      const stored = sessionStorage.getItem('audioFeatures')
      if (stored) setAudioFeatures(JSON.parse(stored))
    } catch { /* ignore */ }

    trackEvent('analysis_completed')

    const t1 = setTimeout(() => setRevealed(true), 100)
    const t2 = setTimeout(() => setAnimate(true), 300)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const handleShare = async () => {
    const top3 = emotions.slice(0, 3).map((e) => EMOTION_KO[e.name] ?? e.name).join(', ')

    // Supabase에 저장 후 짧은 공유 URL 생성
    let shareUrl: string
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotions: rawEmotionMap }),
      })
      const json = await res.json()
      if (res.ok && json.id) {
        shareUrl = `${window.location.origin}/r/${json.id}`
      } else {
        throw new Error(json.error ?? 'no id')
      }
    } catch {
      // 저장 실패 시 URL 인코딩 방식으로 fallback
      const encoded = encodeEmotions(rawEmotionMap)
      shareUrl = `${window.location.origin}/result?d=${encoded}`
    }

    try {
      await navigator.share({
        title: '내 목소리 감정 분석 결과',
        text: `내 목소리에서 가장 많이 감지된 감정: ${top3}`,
        url: shareUrl,
      })
    } catch {
      await navigator.clipboard.writeText(shareUrl).catch(() => {})
      alert('링크가 복사됐어요!')
    }
  }

  if (emotions.length === 0) return null

  const maxScore = emotions[0].score
  const top5 = emotions.slice(0, 5)

  return (
    <div
      className={`flex flex-col min-h-[calc(100vh-84px)] pb-8 transition-opacity duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* ── Hero Banner ── */}
      <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            목소리 페르소나 분석 완료
          </Badge>
          <h1 className="text-2xl font-black text-white mb-1">
            {persona ? `${persona.emoji} ${persona.name}` : '감정 분석 리포트'}
          </h1>
          {persona && (
            <p className="text-white/90 text-sm font-semibold mb-1">
              일치율 {similarity}% · {persona.category}
            </p>
          )}
          <p className="text-white/70 text-sm">
            AI가 목소리에서 감지한 49가지 감정 지표
          </p>
          <div className="flex gap-2 mt-4 flex-wrap">
            {top5.map((e) => (
              <span
                key={e.name}
                className="bg-white/20 backdrop-blur text-white text-[11px] font-semibold px-2.5 py-1 rounded-full"
              >
                {EMOTION_KO[e.name] ?? e.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Cards ── */}
      <div className="mt-4 px-4 space-y-4">

        {/* Persona Match (always shown) */}
        {persona && (
          <PersonaGapSection
            persona={persona}
            similarity={similarity}
            rawEmotions={rawEmotionMap}
            animate={animate}
          />
        )}

        {/* Top 5 */}
        <div className="glass rounded-3xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-1">상위 5개 감정</h2>
          <p className="text-[11px] text-muted-foreground mb-4">목소리에서 가장 강하게 감지된 감정이에요</p>
          <div className="space-y-3">
            {top5.map((e, i) => (
              <EmotionBar
                key={e.name}
                name={e.name}
                score={e.score}
                maxScore={maxScore}
                rank={i + 1}
                animate={animate}
              />
            ))}
          </div>
        </div>

        {/* Audio features */}
        {audioFeatures && <AudioFeaturesSection features={audioFeatures} animate={animate} />}

        {/* Share + retry */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleShare}
            className="flex-1 h-12 rounded-2xl border-border bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform gap-2"
          >
            <Share2 size={16} />
            공유하기
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push('/record')}
            className="h-12 px-4 rounded-2xl border-border bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform"
            aria-label="다시 분석"
          >
            <RotateCcw size={16} />
          </Button>
        </div>

        {/* Report upsell CTA */}
        <div className="glass rounded-3xl p-5 border border-primary/20">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-sm font-bold text-foreground">음성 분석 리포트 받기</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI 감정 분석 기반 · 대인관계·커리어·성장 인사이트
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-foreground">
                990<span className="text-sm font-normal text-muted-foreground">원</span>
              </span>
              <span className="text-xs text-muted-foreground line-through">3,900원</span>
              <Badge className="bg-accent/20 text-accent border-0 text-[10px]">75% 할인</Badge>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => router.push('/checkout')}
            className="w-full h-13 text-base font-bold rounded-2xl gradient-primary border-0 shadow-xl shadow-primary/30 active:scale-95 transition-transform gap-2"
          >
            <FileText size={18} />
            990원으로 상세 리포트 받기
          </Button>
          <p className="text-center text-[11px] text-muted-foreground mt-2">결제 후 즉시 AI 리포트를 확인할 수 있어요</p>
        </div>

        {/* Fake Door — 사전 예약 수요 검증 */}
        <PreRegisterForm />

      </div>

      {/* 지연된 회원가입 CTA */}
      <LoginCTA />

    </div>
  )
}
