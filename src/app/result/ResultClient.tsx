'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Share2, ChevronRight, Mic } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'
import { type Persona, normalizeEmotionScore, findBestPersona } from '@/lib/personas'
import { EMOTION_KO } from '@/lib/emotions'
import { validateEmotionMap } from '@/lib/voiceAnalysis'

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
    userScores[e] = normalizeEmotionScore(e, rawEmotions)
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

      {/* Emotion bars */}
      <div className="space-y-3 mb-4">
        {gaps.map((g) => {
          const label = EMOTION_KO[g.name] ?? g.name
          return (
            <div key={g.name}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-foreground">{label}</span>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-[10px] text-muted-foreground">
                    목표 <span className="text-foreground font-bold">{g.target}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    내 점수 <span className="font-bold text-foreground">{g.user}</span>
                  </span>
                </div>
              </div>
              {/* Target track — gold marker = persona target, teal fill = my score */}
              <div className="relative h-2.5 rounded-full bg-border overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#FFD700] z-10"
                  style={{ left: `${g.target}%` }}
                />
                <div
                  className="h-full rounded-full bg-[#00BECD] transition-all duration-700 ease-out"
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
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-center">
              <p className="text-[11px] font-bold text-rose-400 mb-1">✦ 이 페르소나와 다른 점</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {below.map((g) => EMOTION_KO[g.name] ?? g.name).join(', ')} 영역이 이 페르소나보다 낮게 나왔어요.
              </p>
            </div>
          )}
          {above.length > 0 && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
              <p className="text-[11px] font-bold text-emerald-400 mb-1">✦ 이 페르소나보다 강한 점</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {above.map((g) => EMOTION_KO[g.name] ?? g.name).join(', ')} 영역은 페르소나 기준보다 더 높게 나왔어요.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Share link encoding ───────────────────────────────────
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

// ── Main Component ────────────────────────────────────────
export default function ResultClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [emotions, setEmotions] = useState<{ name: string; score: number }[]>([])
  const [rawEmotionMap, setRawEmotionMap] = useState<Record<string, number>>({})
  const [animate, setAnimate] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [similarity, setSimilarity] = useState(0)
  const [resultStatus, setResultStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [analysisMeta, setAnalysisMeta] = useState<{ source: string; model?: string } | null>(null)
  // Shared links carry emotions only — no audio features, so no voice detail page.
  const [isShared, setIsShared] = useState(false)
  const [hasVoiceDetail, setHasVoiceDetail] = useState(false)

  useEffect(() => {
    let raw: Record<string, number> | null = null
    // URL param이 있으면 공유 링크 → param 우선 사용
    const sharedData = searchParams.get('d')
    if (sharedData) {
      raw = validateEmotionMap(decodeEmotions(sharedData))
      if (raw) {
        setAnalysisMeta({ source: '공유된 AI 분석' })
        setIsShared(true)
      }
    } else {
      try {
        const stored = sessionStorage.getItem('voiceEmotions')
        raw = validateEmotionMap(stored ? JSON.parse(stored) : null)
        const storedMeta = sessionStorage.getItem('voiceAnalysisMeta')
        if (storedMeta) {
          const meta = JSON.parse(storedMeta) as { source?: unknown; model?: unknown }
          if (meta.source === 'openai') {
            setAnalysisMeta({
              source: 'OpenAI',
              model: typeof meta.model === 'string' ? meta.model : undefined,
            })
          }
        }
        setHasVoiceDetail(!!sessionStorage.getItem('audioFeatures'))
      } catch {
        raw = null
      }
    }
    if (!raw) {
      setResultStatus('unavailable')
      return
    }
    const sorted = Object.entries(raw)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
    setEmotions(sorted)
    setRawEmotionMap(raw)

    const { persona: matched, similarity: sim } = findBestPersona(raw)
    setPersona(matched)
    setSimilarity(sim)
    setResultStatus('ready')

    trackEvent('analysis_completed')
    trackEvent('funnel_result_view')

    const t1 = setTimeout(() => setRevealed(true), 100)
    const t2 = setTimeout(() => setAnimate(true), 300)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [searchParams])

  const handleShare = async () => {
    const top3 = emotions.slice(0, 3).map((e) => EMOTION_KO[e.name] ?? e.name).join(', ')

    trackEvent('share_clicked', { content_type: 'result', persona_id: persona?.id ?? 'unknown' })

    // Supabase에 저장 후 짧은 공유 URL 생성
    let shareUrl: string
    let urlSource: 'short' | 'encoded' = 'short'
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
      urlSource = 'encoded'
    }

    try {
      await navigator.share({
        title: '내 목소리 감정 분석 결과',
        text: `내 목소리에서 가장 많이 감지된 감정: ${top3}`,
        url: shareUrl,
      })
      // GA4 권장 이벤트 이름 — 자동 분류됨
      trackEvent('share', { method: 'web_share', content_type: 'result', persona_id: persona?.id ?? 'unknown', url_source: urlSource })
    } catch {
      await navigator.clipboard.writeText(shareUrl).catch(() => {})
      trackEvent('share', { method: 'clipboard', content_type: 'result', persona_id: persona?.id ?? 'unknown', url_source: urlSource })
      alert('링크가 복사됐어요!')
    }
  }

  const handleVoiceDetail = () => {
    trackEvent('result_voice_detail_clicked', { persona_id: persona?.id ?? 'unknown' })
    router.push('/result/voice')
  }

  if (resultStatus === 'loading') return null

  if (resultStatus === 'unavailable') {
    return (
      <div className="flex min-h-[calc(100vh-84px)] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 text-5xl" aria-hidden="true">🎙️</div>
        <h1 className="mb-2 text-xl font-bold text-foreground">표시할 음성 분석 결과가 없어요</h1>
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
          임의의 결과는 보여드리지 않아요. 목소리를 다시 녹음해 실제 AI 분석을 진행해 주세요.
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

  return (
    <div
      className={`flex flex-col min-h-[calc(100vh-84px)] pb-8 transition-opacity duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* ── Hero Banner ── */}
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            목소리 페르소나 분석 완료
          </Badge>
          {analysisMeta && (
            <p className="mb-2 text-[11px] font-medium text-white/75">
              {analysisMeta.source} 음성 분석{analysisMeta.model ? ` · ${analysisMeta.model}` : ''}
            </p>
          )}
          <h1 className="text-2xl font-black text-white mb-2">
            {persona ? `${persona.emoji} ${persona.name}` : '감정 분석 리포트'}
          </h1>
          {persona && (
            <p className="text-white/85 text-sm">
              {persona.category} · 페르소나 일치율 <span className="font-bold text-white tabular-nums">{similarity}%</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Cards ── */}
      <div className="mt-4 px-4 space-y-4">
        {persona && (
          <PersonaGapSection
            persona={persona}
            similarity={similarity}
            rawEmotions={rawEmotionMap}
            animate={animate}
          />
        )}

        {/* ── Actions: one primary, one secondary, small text links ── */}
        <div className="space-y-2.5 pt-1">
          {hasVoiceDetail && (
            <button
              onClick={handleVoiceDetail}
              className="w-full h-13 px-4 py-3.5 rounded-2xl gradient-primary text-gray-900 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30 active:scale-[0.98] transition-transform"
            >
              <span>내 목소리 자세히 보기</span>
              <ChevronRight size={16} className="shrink-0 opacity-70" />
            </button>
          )}
          {isShared && (
            <button
              onClick={() => {
                trackEvent('shared_result_try_clicked', { persona_id: persona?.id ?? 'unknown' })
                router.push('/record')
              }}
              className="w-full h-13 px-4 py-3.5 rounded-2xl gradient-primary text-gray-900 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30 active:scale-[0.98] transition-transform"
            >
              <Mic size={16} className="shrink-0" />
              <span>나도 내 목소리 분석하기</span>
            </button>
          )}
          <Button
            variant="outline"
            size="lg"
            onClick={handleShare}
            className="w-full h-12 rounded-2xl border-border bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform gap-2"
          >
            <Share2 size={16} />
            공유하기
          </Button>
          <div className="flex items-center justify-center gap-4 pt-1 text-xs text-muted-foreground">
            <button
              onClick={() => {
                trackEvent('result_retry_clicked', { persona_id: persona?.id ?? 'unknown' })
                router.push('/record')
              }}
              className="underline-offset-4 hover:underline"
            >
              다시 분석하기
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => {
                trackEvent('result_explore_personas_clicked', { persona_id: persona?.id ?? 'unknown' })
                router.push('/personas')
              }}
              className="underline-offset-4 hover:underline"
            >
              다른 페르소나 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
