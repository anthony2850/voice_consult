'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Flame, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTrack } from '@/hooks/useTrack'
import {
  CONCERN_LABELS, CONCERN_ORDER, SCENE_LABELS, SCENE_ORDER, SCENE_SCRIPTS, TRACKS, getRung,
  type ConcernSlug, type Scene,
} from '@/lib/curriculum'
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
  const { loading, profile, sessions, trackSessions, saveScene, planSwitch, switchTrack } = useTrack()
  const [switching, setSwitching] = useState(false)
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

        <div className="px-4 pt-4 space-y-4">
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
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">훈련 내내 연습할 문장</p>
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
            진단 시작하기 — 녹음 4번, 약 3분
            <ChevronRight size={16} className="opacity-70" />
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            쉬운 소리부터 실제 문장까지 차례로 녹음해서, 어디서부터 어려워지는지 찾아요.
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
            {SCENE_LABELS[scene].emoji} {SCENE_LABELS[scene].label}
          </Badge>
          <h1 className="text-2xl font-black text-white mb-1">{track.emoji} {track.label}</h1>
          <p className="text-white/85 text-sm">{rung}단계 · {current.title}</p>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
              <Flame size={14} className="text-orange-300" />
              <span className="text-white text-xs font-bold">{streak}일 연속</span>
            </div>
            <div className="bg-white/15 rounded-full px-3 py-1">
              <span className="text-white text-xs font-bold">세션 {trackSessions.length}회</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="rounded-2xl bg-primary/10 border border-primary/30 px-4 py-3">
          <p className="text-[11px] font-semibold text-primary mb-0.5">녹음할 때 확인할 것</p>
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
            <p className="text-[11px] font-semibold text-muted-foreground">지난번 연습이 남아 있었나</p>
            <p className="text-sm text-foreground leading-relaxed">{retentionCopy(lastVerdict, last.voice_use ?? 'normal')}</p>
          </div>
        )}

        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-sm font-bold text-foreground">훈련 단계</p>
          <RungLadder current={rung} />
          <p className="text-[11px] text-muted-foreground">
            매 세션 이미 할 수 있는 단계 하나와 지금 도전하는 단계 하나를 연습해요. 목표에 들어오고 목이 힘들지 않았으면 다음 단계로 올라가요.
          </p>
        </div>

        <div className="glass rounded-3xl p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-foreground">다른 트랙 해 보기</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              기록은 트랙마다 따로 남아요. 돌아오면 하던 단계부터 이어서 해요. 처음 해 보는 상황은 문장이 달라서 진단부터 해요. 다만 한 트랙에 꾸준히 머물수록 변화가 빨라요.
            </p>
          </div>
          {([
            { title: '상황', items: SCENE_ORDER.map((s) => ({ key: s, label: `${SCENE_LABELS[s].emoji} ${SCENE_LABELS[s].label}`, on: s === scene })) },
            { title: '고민', items: CONCERN_ORDER.map((c) => ({ key: c, label: `${TRACKS[c].emoji} ${CONCERN_LABELS[c]}`, on: c === track.concern })) },
          ] as const).map((row) => (
            <div key={row.title} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground">{row.title}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {row.items.map((it) => (
                  <button
                    key={it.key}
                    disabled={switching || it.on}
                    onClick={async () => {
                      const next = row.title === '상황'
                        ? { scene: it.key as Scene, concern: track.concern }
                        : { scene, concern: it.key as ConcernSlug }
                      const plan = planSwitch(next)
                      const diagnoseUrl = `/training/diagnose?scene=${next.scene}&concern=${next.concern}`
                      if (plan.kind === 'diagnose') {
                        const sceneLabel = SCENE_LABELS[next.scene].label
                        if (!window.confirm(`'${sceneLabel}' 상황은 연습 문장이 달라서 진단부터 해야 해요. 녹음 4번, 약 3분이에요.\n\n지금 할까요? 진단을 마치면 트랙이 바뀌어요.`)) return
                        trackEvent('training_track_switch_diagnose', { to_scene: next.scene, to_concern: next.concern, reason: 'new_scene' })
                        router.push(diagnoseUrl)
                        return
                      }
                      if (plan.kind === 'suggest-rediagnose') {
                        const again = window.confirm(`이 상황의 진단을 한 지 ${plan.ageDays}일 지났어요. 그동안 목소리가 바뀌었을 수 있어요.\n\n지금 목소리로 다시 재 볼까요?\n(취소하면 지난 진단 결과로 바로 시작해요)`)
                        if (again) {
                          trackEvent('training_track_switch_diagnose', { to_scene: next.scene, to_concern: next.concern, reason: 'stale' })
                          router.push(diagnoseUrl)
                          return
                        }
                      }
                      setSwitching(true)
                      try {
                        await switchTrack(next, plan.rung, plan.baseline)
                        trackEvent('training_track_switched', { from_scene: scene, from_concern: track.concern, to_scene: next.scene, to_concern: next.concern, plan: plan.kind })
                      } finally { setSwitching(false) }
                    }}
                    className={`rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all active:scale-[0.98] ${
                      it.on ? 'bg-primary/15 border border-primary/50 text-foreground' : 'bg-secondary/60 text-foreground hover:bg-secondary'
                    } disabled:cursor-default`}
                  >
                    {it.label}{it.on && <span className="text-primary"> · 지금</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <details className="glass rounded-3xl px-5 py-4">
          <summary className="text-sm font-bold text-foreground cursor-pointer list-none">학습 원리 다시 보기</summary>
          <div className="mt-3"><PrinciplesCard title="" /></div>
        </details>

        <button
          onClick={() => {
            trackEvent('training_track_reset', { concern: track.concern, sessions: trackSessions.length })
            router.push(`/training/diagnose?scene=${scene}&concern=${track.concern}`)
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={12} /> 처음부터 다시 진단하기
        </button>
      </div>
    </div>
  )
}
