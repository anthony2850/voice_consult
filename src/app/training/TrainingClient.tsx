'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Flame, Plus } from 'lucide-react'
import { useTrack } from '@/hooks/useTrack'
import { SCENE_LABELS, TRACKS, getRung } from '@/lib/curriculum'
import { listTracks, relativeDay, type TrackSummary } from '@/lib/trackList'
import { streakFrom, toDateStr } from '@/lib/streak'
import { trackEvent } from '@/lib/analytics'

function trackName(t: Pick<TrackSummary, 'scene' | 'concern'>) {
  return `${SCENE_LABELS[t.scene].emoji} ${SCENE_LABELS[t.scene].label} · ${TRACKS[t.concern].label}`
}

/** 훈련 탭 첫 화면: 지금 트랙, 쉬고 있는 트랙, 새 트랙 시작. */
export default function TrainingClient() {
  const router = useRouter()
  const { loading, profile, sessions, planSwitch, switchTrack } = useTrack()
  const [switching, setSwitching] = useState(false)
  const todayStr = useMemo(() => toDateStr(new Date()), [])

  const tracks = useMemo(
    () => listTracks(sessions, { scene: profile.scene, concern: profile.trackConcern, rung: profile.trackRung }),
    [sessions, profile.scene, profile.trackConcern, profile.trackRung],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-84px)]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const current = tracks.find((t) => t.current) ?? null
  const resting = tracks.filter((t) => !t.current)
  const streak = streakFrom(sessions.map((s) => s.session_date), todayStr)
  const doneToday = sessions.some((s) => s.session_date === todayStr && s.kind === 'session')

  /** 쉬고 있는 트랙으로 돌아가기. 규칙은 planTrackSwitch (진단 재사용·재진단 권유·진단 필요). */
  async function openResting(t: TrackSummary) {
    if (switching) return
    const next = { scene: t.scene, concern: t.concern }
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
      const ok = await switchTrack(next, plan.rung, plan.baseline)
      if (!ok) return
      trackEvent('training_track_switched', {
        from_scene: current?.scene ?? 'none', from_concern: current?.concern ?? 'none',
        to_scene: next.scene, to_concern: next.concern, plan: plan.kind,
      })
      router.push('/training/track')
    } finally { setSwitching(false) }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-white mb-1">내 훈련</h1>
          <p className="text-white/80 text-sm">한 가지 고민을 한 트랙으로 깊게 연습해요.</p>
          {tracks.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
                <Flame size={14} className="text-orange-300" />
                <span className="text-white text-xs font-bold">{streak}일 연속</span>
              </div>
              <div className="bg-white/15 rounded-full px-3 py-1">
                <span className="text-white text-xs font-bold">트랙 {tracks.length}개</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {current ? (
          <div className="glass rounded-3xl p-5 space-y-3">
            <button onClick={() => router.push('/training/track')} className="w-full text-left">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-primary">● 지금 하는 트랙</p>
                <span className="flex items-center text-[11px] text-muted-foreground">자세히 <ChevronRight size={12} /></span>
              </div>
              <p className="text-lg font-black text-foreground mt-1">{trackName(current)}</p>
              <p className="text-sm text-foreground/80 mt-0.5">{current.rung}단계 · {getRung(current.rung).title}</p>
              <p className="text-[11px] text-muted-foreground mt-1">세션 {current.sessions}회 · 마지막 {relativeDay(current.lastAt)}</p>
            </button>
            <button
              onClick={() => {
                trackEvent('training_session_cta', { concern: current.concern, rung: current.rung, source: 'hub' })
                router.push('/training/session')
              }}
              className="w-full h-12 px-4 rounded-2xl gradient-primary text-gray-900 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30 active:scale-[0.98] transition-transform"
            >
              오늘 세션 시작 — 약 5분
              <ChevronRight size={16} className="opacity-70" />
            </button>
            {doneToday && <p className="text-[11px] text-emerald-500 text-center">✓ 오늘 이미 한 번 했어요. 한 번 더 해도 돼요.</p>}
          </div>
        ) : (
          <div className="glass rounded-3xl p-5 space-y-2">
            <p className="text-sm font-bold text-foreground">아직 트랙이 없어요</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              트랙은 &lsquo;어떤 상황에서&rsquo;와 &lsquo;무엇이 고민인지&rsquo;의 조합이에요. 상황을 고르고 3분 진단을 하면, 결과를 보고 고민을 골라 시작해요.
            </p>
          </div>
        )}

        {resting.length > 0 && (
          <div className="glass rounded-3xl p-5 space-y-2">
            <p className="text-sm font-bold text-foreground">쉬고 있는 트랙</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">기록은 트랙마다 따로 남아요. 돌아가면 하던 단계부터 이어서 해요.</p>
            <div className="divide-y divide-border/50">
              {resting.map((t) => (
                <button
                  key={`${t.scene}:${t.concern}`}
                  disabled={switching}
                  onClick={() => openResting(t)}
                  className="w-full flex items-center gap-3 py-3 text-left active:opacity-70 disabled:opacity-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{trackName(t)}</p>
                    <p className="text-[11px] text-muted-foreground">{t.rung}단계 · 세션 {t.sessions}회 · {relativeDay(t.lastAt)}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-primary shrink-0">이어 하기</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            trackEvent('training_new_track_clicked', { tracks: tracks.length })
            router.push('/training/start')
          }}
          className={`w-full rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.98] transition-transform ${
            current ? 'border border-dashed border-border text-foreground' : 'gradient-primary text-gray-900 shadow-lg shadow-[#FFD700]/30'
          }`}
        >
          <Plus size={16} />
          {current ? '새 트랙 시작' : '첫 트랙 시작하기'}
        </button>
        {current && (
          <p className="text-[11px] text-muted-foreground text-center -mt-2">
            상황을 고르고 진단부터 해요. 한 트랙에 꾸준히 머물수록 변화가 빨라요.
          </p>
        )}
      </div>
    </div>
  )
}
