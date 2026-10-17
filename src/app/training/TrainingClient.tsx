'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Flame, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTrack } from '@/hooks/useTrack'
import { SCENE_LABELS, SCENE_ORDER, SCENE_SCRIPTS, TRACKS, getRung, type Scene } from '@/lib/curriculum'
import { retentionCopy, retentionVerdict } from '@/lib/trainingCycle'
import PrinciplesCard from '@/components/training/PrinciplesCard'
import RungLadder from '@/components/training/RungLadder'
import { trackEvent } from '@/lib/analytics'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function streakFrom(dates: string[], todayStr: string): number {
  const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  if (unique.length === 0) return 0
  const y = new Date(todayStr); y.setDate(y.getDate() - 1)
  if (unique[0] !== todayStr && unique[0] !== toDateStr(y)) return 0
  let count = 0
  let expected = unique[0]
  for (const date of unique) {
    if (date === expected) {
      count++
      const d = new Date(expected); d.setDate(d.getDate() - 1); expected = toDateStr(d)
    } else if (date < expected) break
  }
  return count
}

export default function TrainingClient() {
  const router = useRouter()
  const { loading, profile, sessions, trackSessions, saveScene, clearTrack } = useTrack()
  const [sceneSaving, setSceneSaving] = useState(false)
  const todayStr = useMemo(() => toDateStr(new Date()), [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-84px)]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  // ── 온보딩: 장면 → 진단 ────────────────────────────────────────────────────
  if (!profile.trackConcern) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
        <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-8 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">훈련 시작</Badge>
            <h1 className="text-2xl font-black text-white mb-1">어떤 상황에서 말하나요?</h1>
            <p className="text-white/80 text-sm">그 상황의 문장으로 처음부터 끝까지 훈련해요.</p>
          </div>
        </div>

        <div className="relative z-10 -mt-3 px-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {SCENE_ORDER.map((s: Scene) => {
              const sel = profile.scene === s
              return (
                <button
                  key={s}
                  disabled={sceneSaving}
                  onClick={async () => {
                    setSceneSaving(true)
                    try {
                      await saveScene(s)
                      trackEvent('training_scene_selected', { scene: s })
                    } finally { setSceneSaving(false) }
                  }}
                  className={`text-left rounded-2xl p-4 transition-all active:scale-[0.98] ${
                    sel ? 'bg-primary/15 border border-primary/50' : 'glass'
                  }`}
                >
                  <span className="text-2xl">{SCENE_LABELS[s].emoji}</span>
                  <p className="text-sm font-bold text-foreground mt-1">{SCENE_LABELS[s].label}</p>
                  <p className="text-[11px] text-muted-foreground">{SCENE_LABELS[s].hint}</p>
                </button>
              )
            })}
          </div>

          {profile.scene && (
            <div className="rounded-2xl bg-secondary/60 px-4 py-3">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">트랙 내내 쓸 기준 문장</p>
              <p className="text-sm text-foreground leading-relaxed">&ldquo;{SCENE_SCRIPTS[profile.scene].short}&rdquo;</p>
            </div>
          )}

          <PrinciplesCard />

          <button
            disabled={!profile.scene}
            onClick={() => {
              trackEvent('training_diagnosis_cta', { scene: profile.scene ?? 'none' })
              router.push('/training/diagnose')
            }}
            className="w-full h-13 px-4 py-3.5 rounded-2xl gradient-primary text-gray-900 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            진단 시작하기 — 4계단, 약 3분
            <ChevronRight size={16} className="opacity-70" />
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            어느 계단에서 흔들리는지 찾아요. 점수는 보여주지 않아요.
          </p>
        </div>
      </div>
    )
  }

  // ── 트랙 대시보드 ──────────────────────────────────────────────────────────
  const track = TRACKS[profile.trackConcern]
  const rung = profile.trackRung ?? 1
  const current = getRung(rung)
  const scene = profile.scene ?? 'daily'
  const last = trackSessions[0] ?? null
  const prev = trackSessions[1] ?? null
  const lastVerdict = last ? retentionVerdict(track.metric, prev?.performance ?? null, last.retention) : null
  const streak = streakFrom(sessions.map((s) => s.session_date), todayStr)
  const doneToday = sessions.some((s) => s.session_date === todayStr && s.kind === 'session')

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            {SCENE_LABELS[scene].emoji} {SCENE_LABELS[scene].label} 트랙
          </Badge>
          <h1 className="text-2xl font-black text-white mb-1">{track.emoji} {track.label}</h1>
          <p className="text-white/85 text-sm">{rung}단 · {current.title}</p>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
              <Flame size={14} className="text-orange-300" />
              <span className="text-white text-xs font-bold">{streak}일 연속</span>
            </div>
            <div className="bg-white/15 rounded-full px-3 py-1">
              <span className="text-white text-xs font-bold">{trackSessions.length}번째 세션까지</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-3 px-4 space-y-4">
        <div className="rounded-2xl bg-primary/10 border border-primary/30 px-4 py-3">
          <p className="text-[11px] font-semibold text-primary mb-0.5">이 트랙에서 들을 것 하나</p>
          <p className="text-sm font-bold text-foreground">{track.keyInfo}</p>
        </div>

        <button
          onClick={() => {
            trackEvent('training_session_cta', { concern: track.concern, rung })
            router.push('/training/session')
          }}
          className="w-full h-13 px-4 py-3.5 rounded-2xl gradient-primary text-gray-900 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30 active:scale-[0.98] transition-transform"
        >
          오늘 세션 시작 — 약 5분
          <ChevronRight size={16} className="opacity-70" />
        </button>
        {doneToday && (
          <p className="text-[11px] text-emerald-500 text-center -mt-2">✓ 오늘 이미 한 번 했어요. 한 번 더 해도 돼요.</p>
        )}

        {last && lastVerdict && (
          <div className="glass rounded-3xl p-5 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground">지난 세션에서 남은 것</p>
            <p className="text-sm text-foreground leading-relaxed">{retentionCopy(lastVerdict, last.voice_use ?? 'normal')}</p>
          </div>
        )}

        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-sm font-bold text-foreground">전이 사다리</p>
          <RungLadder current={rung} />
          <p className="text-[11px] text-muted-foreground">
            매 세션 한 계단 아래(성공 경험)와 현재 계단(도전)을 해요. 기준 안에 들고 힘들지 않았으면 올라가요.
          </p>
        </div>

        <details className="glass rounded-3xl px-5 py-4">
          <summary className="text-sm font-bold text-foreground cursor-pointer list-none">학습 원리 다시 보기</summary>
          <div className="mt-3"><PrinciplesCard title="" /></div>
        </details>

        <button
          onClick={async () => {
            if (!window.confirm('트랙을 끝내고 다시 진단할까요? 지금까지의 기록은 남아요.')) return
            trackEvent('training_track_reset', { concern: track.concern, sessions: trackSessions.length })
            await clearTrack()
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={12} /> 다른 고민으로 다시 진단하기
        </button>
      </div>
    </div>
  )
}
