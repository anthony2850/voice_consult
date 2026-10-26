'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { useTrack } from '@/hooks/useTrack'
import { SCENE_LABELS, TRACKS, getRung } from '@/lib/curriculum'
import { retentionCopy, retentionVerdict } from '@/lib/trainingCycle'
import { toDateStr } from '@/lib/streak'
import { daysTrainedThisWeek } from '@/lib/plan'
import PrinciplesCard from '@/components/training/PrinciplesCard'
import RungLadder from '@/components/training/RungLadder'
import { trackEvent } from '@/lib/analytics'
import { CONCERN_ICON, PageHeader, Pill, PrimaryButton } from '@/components/ds'

/** 지금 트랙의 대시보드. 트랙을 고르고 바꾸는 일은 훈련 탭 첫 화면(/training)에서 한다. */
export default function TrackClient() {
  const router = useRouter()
  const { loading, profile, sessions, trackSessions, plan } = useTrack()
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
  const weeklyGoal = plan?.weeklyGoal ?? 3
  const weekDone = daysTrainedThisWeek(sessions.filter((s) => s.kind === 'session').map((s) => s.session_date))
  const doneToday = sessions.some((s) => s.session_date === todayStr && s.kind === 'session')

  const Icon = CONCERN_ICON[track.concern]
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <PageHeader
        back={{ label: '내 훈련', onClick: () => router.push('/training') }}
        eyebrow={`${SCENE_LABELS[scene].label} 상황`}
        title={<span className="flex items-center gap-3"><Icon size={28} className="text-accent shrink-0" aria-hidden="true" />{track.label} 트랙</span>}
        sub={`${rung}단계: ${current.title}`}
        chips={<><Pill tone="data">이번 주 {weekDone}/{weeklyGoal}회</Pill><Pill>연습 {trackSessions.length}회</Pill></>}
      />

      <div className="px-5 pt-4 space-y-4">
        <section className="rounded-[28px] bg-secondary p-6 space-y-5">
          <PrimaryButton
            onClick={() => {
              trackEvent('training_session_cta', { concern: track.concern, rung, from: 'track' })
              router.push('/training/session')
            }}
          >
            오늘 연습 시작, 약 5분
          </PrimaryButton>
          {doneToday && <p className="-mt-2 text-[13px] font-semibold text-good text-center">오늘 이미 한 번 했어요. 한 번 더 해도 돼요.</p>}
        </section>

        {last && lastVerdict && (
          <section className="rounded-[28px] bg-secondary p-6 space-y-1.5">
            <p className="eyebrow">지난번 연습이 남아 있었나</p>
            <p className="text-[15px] text-foreground leading-relaxed">{retentionCopy(lastVerdict)}</p>
          </section>
        )}

        <section className="rounded-[28px] bg-secondary p-6 space-y-4">
          <p className="text-[18px] font-black text-foreground">훈련 단계</p>
          <RungLadder current={rung} />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            연습마다 몸 풀기로 한 단계 아래를, 도전으로 지금 단계를 해요. 기준에 들어오고 목이 편했으면 다음 단계로 올라가요.
          </p>
        </section>

        <details className="rounded-[28px] bg-secondary px-6 py-5">
          <summary className="text-[16px] font-bold text-foreground cursor-pointer list-none">학습 원리 다시 보기</summary>
          <div className="mt-3"><PrinciplesCard title="" /></div>
        </details>

        <button
          onClick={() => {
            trackEvent('training_track_reset', { concern: track.concern, sessions: trackSessions.length })
            router.push(`/training/diagnose?scene=${scene}&concern=${track.concern}`)
          }}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={14} /> 처음부터 다시 진단하기
        </button>
      </div>
    </div>
  )
}
