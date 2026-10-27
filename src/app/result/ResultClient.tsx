'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Share2, ChevronRight, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'
import { getPersona, sceneInk, sceneTint } from '@/lib/personas'
import { acousticZ, decodeScene, parseSceneResult, pickScene, whySentence, type SceneResult } from '@/lib/voiceScene'
import { calcVoiceScores, suggestConcerns } from '@/lib/voiceScores'
import { TRACKS } from '@/lib/curriculum'
import { validateEmotionMap } from '@/lib/voiceAnalysis'
import type { AudioFeatures } from '@/lib/voiceDB'
import VoiceMap from '@/components/scene/VoiceMap'
import { getSpeakCategory, readStoredPrompt } from '@/lib/speakPrompts'

// ── 예전 공유 링크(/result?d=…) 읽기. 새 링크는 /r/[id]에서 결과를 직접 넘긴다. ──
function decodeEmotions(encoded: string): Record<string, number> | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4)
    return JSON.parse(decodeURIComponent(atob(padded)))
  } catch {
    return null
  }
}

const CONCERN_COACH: Record<'trembling' | 'fast' | 'small_voice', string> = {
  trembling: '다만 발표나 면접에서는 떨림이 먼저 들릴 수 있어요.',
  fast: '다만 긴장하면 말이 더 빨라질 수 있어요.',
  small_voice: '다만 넓은 자리에서는 작게 들릴 수 있어요.',
}

interface Loaded {
  raw: Record<string, number>
  scene: SceneResult
  features: AudioFeatures | null
  isShared: boolean
  meta: { source: string; model?: string } | null
  /** 녹음 때 고른 말하기 방식 (공유 링크에는 없음) */
  categoryLabel: string | null
}

/** 공유 링크(/r/[id])가 넘겨주는 보낸 사람의 결과 */
interface SharedResult {
  emotions: unknown
  scene: unknown
}

function load(params: URLSearchParams, shared?: SharedResult): Loaded | null {
  if (shared) {
    const raw = validateEmotionMap(shared.emotions)
    if (!raw) return null
    const scene = parseSceneResult(shared.scene) ?? pickScene(raw, null)
    return { raw, scene, features: null, isShared: true, meta: { source: '공유된 AI 분석' }, categoryLabel: null }
  }
  const sharedData = params.get('d')
  if (sharedData) {
    const raw = validateEmotionMap(decodeEmotions(sharedData))
    if (!raw) return null
    // 공유 링크에는 음향 값이 없다. 보낸 사람의 장면이 실려 오면 그대로 쓰고, 옛 링크면 감정만으로 다시 계산한다.
    const s = params.get('s')
    const scene = (s && decodeScene(s)) || pickScene(raw, null)
    return { raw, scene, features: null, isShared: true, meta: { source: '공유된 AI 분석' }, categoryLabel: null }
  }
  try {
    const stored = sessionStorage.getItem('voiceEmotions')
    const raw = validateEmotionMap(stored ? JSON.parse(stored) : null)
    if (!raw) return null
    const fStored = sessionStorage.getItem('audioFeatures')
    const features = fStored ? (JSON.parse(fStored) as AudioFeatures) : null
    let meta: Loaded['meta'] = null
    const storedMeta = sessionStorage.getItem('voiceAnalysisMeta')
    if (storedMeta) {
      const m = JSON.parse(storedMeta) as { source?: unknown; model?: unknown }
      if (m.source === 'openai') meta = { source: 'OpenAI', model: typeof m.model === 'string' ? m.model : undefined }
    }
    const spoken = readStoredPrompt()
    return { raw, scene: pickScene(raw, features), features, isShared: false, meta, categoryLabel: spoken ? getSpeakCategory(spoken.category).label : null }
  } catch {
    return null
  }
}

// ── Main Component ────────────────────────────────────────
export default function ResultClient({ shared }: { shared?: SharedResult } = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined)
  const [revealed, setRevealed] = useState(false)
  const debug = searchParams.get('debug') === '1'

  useEffect(() => {
    // sessionStorage is client-only, so it has to be read after hydration.
    const l = load(searchParams, shared)
    setLoaded(l)
    if (!l) return
    trackEvent('analysis_completed')
    trackEvent('funnel_result_view')
    if (!l.isShared) {
      trackEvent('scene_assigned', { scene_id: l.scene.id, quadrant: getPersona(l.scene.id).quadrant, border: l.scene.border })
    }
    const t = setTimeout(() => setRevealed(true), 100)
    return () => clearTimeout(t)
  }, [searchParams, shared])

  const coach = useMemo(() => {
    if (!loaded?.features) return null
    const p = getPersona(loaded.scene.id)
    const concern = suggestConcerns(calcVoiceScores(loaded.features))[0]
    if (!concern || concern === 'diction') return { text: `${p.strength} 지금 목소리 좋아요. 면접이나 발표 문장으로도 재 볼까요?`, track: null }
    return { text: `${p.strength} ${CONCERN_COACH[concern]}`, track: TRACKS[concern].label }
  }, [loaded])

  if (loaded === undefined) return null

  if (loaded === null) {
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

  const { scene, raw, isShared, meta, features } = loaded
  const persona = getPersona(scene.id)
  const second = getPersona(scene.second)
  const ink = sceneInk(persona.color)

  const handleShare = async () => {
    trackEvent('share_clicked', { content_type: 'result', persona_id: persona.id })
    // 결과를 주소에 싣지 않는다. 짧은 링크를 못 만들면 다시 누르게 한다.
    let shareUrl: string
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotions: raw, scene }),
      })
      const json = await res.json()
      if (!res.ok || !json.id) throw new Error(json.error ?? 'no id')
      shareUrl = `${window.location.origin}/r/${json.id}`
    } catch {
      trackEvent('share_failed', { content_type: 'result' })
      alert('공유 링크를 만들지 못했어요. 잠시 후 다시 눌러 주세요.')
      return
    }
    try {
      await navigator.share({
        title: `내 목소리는 '${persona.name}' 같대요`,
        text: `${persona.tagline}. 너는 어떤 페르소나일까?`,
        url: shareUrl,
      })
      trackEvent('share', { method: 'web_share', content_type: 'result', persona_id: persona.id })
    } catch {
      await navigator.clipboard.writeText(shareUrl).catch(() => {})
      trackEvent('share', { method: 'clipboard', content_type: 'result', persona_id: persona.id })
      alert('링크가 복사됐어요!')
    }
  }

  return (
    <div className={`flex flex-col min-h-[calc(100vh-84px)] pb-8 transition-opacity duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}>
      {/* ── Scene header ── */}
      <div className="px-5 pt-8 pb-7" style={{ background: sceneTint(persona.color, 22) }}>
        <p className="text-xs font-semibold" style={{ color: ink }}>
          {isShared ? '친구의 목소리 페르소나' : loaded.categoryLabel ? `${loaded.categoryLabel}로 잰 오늘의 목소리 페르소나` : '오늘의 목소리 페르소나'}
        </p>
        {meta && (
          <p className="text-[11px] mt-0.5" style={{ color: ink, opacity: 0.8 }}>
            {meta.source}{meta.model ? ` ${meta.model}` : ''} 음성 분석
          </p>
        )}
        <div className="h-4" aria-hidden="true" />
        {/* 그림 자리 — 그림이 생기기 전에는 대표색 도형 */}
        <div className="relative w-20 h-20 mb-4" aria-hidden="true">
          <span className="absolute inset-0 rounded-full" style={{ background: persona.color }} />
          <span className="absolute -right-3 -bottom-2 w-9 h-9 rounded-full border-4" style={{ background: sceneTint(persona.color, 45), borderColor: sceneTint(persona.color, 22) }} />
        </div>
        <h1 className="text-[26px] leading-tight font-black text-foreground">{persona.name}</h1>
        <p className="mt-2 text-sm font-medium" style={{ color: ink }}>{persona.tagline}</p>
      </div>

      <div className="mt-4 px-4 space-y-4">
        {/* ── Why ── */}
        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-[15px] font-bold text-foreground leading-relaxed">{whySentence(scene)}</p>
          <ul className="space-y-1.5">
            {persona.lines.map((l) => (
              <li key={l} className="flex gap-2 text-sm text-foreground/85 leading-relaxed">
                <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: persona.color }} aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Map ── */}
        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-sm font-bold text-foreground">내 목소리 지도</p>
          <VoiceMap energy={scene.energy} mood={scene.mood} id={scene.id} second={scene.second} />
          {scene.border && (
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              지금은 경계에 있어요. 다시 녹음하면 {second.name}이 나올 수도 있어요.
            </p>
          )}
        </div>

        {/* ── Coach ── */}
        {coach && (
          <div className="rounded-3xl p-5 space-y-1.5" style={{ background: sceneTint(persona.color, 12) }}>
            <p className="text-[11px] font-semibold" style={{ color: ink }}>코치 한마디</p>
            <p className="text-sm text-foreground leading-relaxed">
              {coach.text}
              {coach.track && <> <span className="font-semibold">{coach.track} 트랙</span>을 해 볼까요?</>}
            </p>
          </div>
        )}

        {debug && !isShared && (
          <pre className="text-[10px] leading-snug bg-secondary/60 rounded-xl p-3 overflow-x-auto">
            {JSON.stringify({ energy: scene.energy, mood: scene.mood, border: scene.border, second: scene.second, acoustic: acousticZ(features) }, null, 1)}
          </pre>
        )}

        {/* ── Actions ── */}
        <div className="space-y-2.5 pt-1">
          {features && (
            <button
              onClick={() => {
                trackEvent('result_voice_detail_clicked', { persona_id: persona.id })
                router.push('/result/voice')
              }}
              className="w-full h-14 px-4 rounded-full gradient-primary text-primary-foreground text-[16px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <span>이 페르소나를 만든 수치 보기</span>
              <ChevronRight size={16} className="shrink-0 opacity-70" />
            </button>
          )}
          {isShared && (
            <button
              onClick={() => {
                trackEvent('shared_result_try_clicked', { persona_id: persona.id })
                router.push('/record')
              }}
              className="w-full h-14 px-4 rounded-full gradient-primary text-primary-foreground text-[16px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Mic size={16} className="shrink-0" />
              <span>내 목소리는 어떤 페르소나일까?</span>
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
          <div className="flex items-center justify-center gap-8 pt-1 text-xs text-muted-foreground">
            <button
              onClick={() => {
                trackEvent('result_retry_clicked', { persona_id: persona.id })
                router.push('/record')
              }}
              className="underline-offset-4 hover:underline"
            >
              다시 분석하기
            </button>
            <button
              onClick={() => {
                trackEvent('result_explore_personas_clicked', { persona_id: persona.id })
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
