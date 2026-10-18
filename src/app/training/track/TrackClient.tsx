'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, Flame, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTrack } from '@/hooks/useTrack'
import { SCENE_LABELS, TRACKS, getRung } from '@/lib/curriculum'
import { retentionCopy, retentionVerdict } from '@/lib/trainingCycle'
import { streakFrom, toDateStr } from '@/lib/streak'
import PrinciplesCard from '@/components/training/PrinciplesCard'
import RungLadder from '@/components/training/RungLadder'
import { trackEvent } from '@/lib/analytics'

/** 지금 트랙의 대시보드. 트랙을 고르고 바꾸는 일은 훈련 탭 첫 화면(/training)에서 한다. */
export default function TrackClient() {
  const router = useRouter()
  const { loading, profile, sessions, trackSessions } = useTrack()
  const todayStr = useMemo(() => toDateStr(new Date()), [])

  useEffect(() => {
    if (!loading && !profile.trackConcern) router.replace('/training')
  }, [loading, profile.trackConcern, router])

  if (loading || !profile.trackConcern) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-84px)]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

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
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-6 pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/training')}
            className="flex items-center gap-1 text-xs text-white/80 hover:text-white mb-4"
          >
            <ArrowLeft size={14} /> 내 훈련
          </button>
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
            trackEvent('training_session_cta', { concern: track.concern, rung, source: 'track' })
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
