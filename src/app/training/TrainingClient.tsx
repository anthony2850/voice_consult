'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Plus } from 'lucide-react'
import { useTrack } from '@/hooks/useTrack'
import { SCENE_LABELS, TRACKS, getRung } from '@/lib/curriculum'
import { listTracks, relativeDay, type TrackSummary } from '@/lib/trackList'
import { toDateStr } from '@/lib/streak'
import { daysTrainedThisWeek } from '@/lib/plan'
import { trackEvent } from '@/lib/analytics'
import { PageHeader, Pill, PrimaryButton, SCENE_ICON } from '@/components/ds'

function trackName(t: Pick<TrackSummary, 'scene' | 'concern'>) {
  return `${SCENE_LABELS[t.scene].label} ${TRACKS[t.concern].label} 트랙`
}

/** 훈련 탭 첫 화면: 지금 트랙, 쉬고 있는 트랙, 새 트랙 시작. */
export default function TrainingClient() {
  const router = useRouter()
  const { loading, profile, sessions, plan, planSwitch, switchTrack } = useTrack()
  const [switching, setSwitching] = useState(false)
  const todayStr = useMemo(() => toDateStr(new Date()), [])

  const tracks = useMemo(
    () => listTracks(sessions, { scene: profile.scene, concern: profile.trackConcern, rung: profile.trackRung }),
    [sessions, profile.scene, profile.trackConcern, profile.trackRung],
  )

  // 처음 온 사람(트랙도 계획도 없음)은 온보딩부터
  const firstVisit = !loading && tracks.length === 0 && !plan
  useEffect(() => {
    if (firstVisit) router.replace('/training/onboarding')
  }, [firstVisit, router])

  if (loading || firstVisit) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-84px)]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const current = tracks.find((t) => t.current) ?? null
  const resting = tracks.filter((t) => !t.current)
  const weeklyGoal = plan?.weeklyGoal ?? 3
  const weekDone = daysTrainedThisWeek(sessions.filter((s) => s.kind === 'session').map((s) => s.session_date))
  const doneToday = sessions.some((s) => s.session_date === todayStr && s.kind === 'session')

  /** 쉬고 있는 트랙으로 돌아가기. 규칙은 planTrackSwitch (진단 재사용, 재진단 권유, 진단 필요). */
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
      <PageHeader
        title="내 훈련"
        sub="한 가지 고민을 한 트랙으로 깊게 연습해요."
        chips={tracks.length > 0 && (
          <>
            <Pill tone="data">이번 주 {weekDone}/{weeklyGoal}회</Pill>
            <Pill>트랙 {tracks.length}개</Pill>
          </>
        )}
      />

      <div className="px-5 pt-4 space-y-4">
        {current ? (
          <section className="rounded-[28px] bg-secondary p-6 space-y-5">
            <button onClick={() => router.push('/training/track')} className="w-full text-left">
              <div className="flex items-center justify-between">
                <p className="eyebrow">지금 하는 트랙</p>
                <span className="flex items-center text-[13px] font-semibold text-muted-foreground">자세히 <ChevronRight size={16} /></span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {(() => { const Icon = SCENE_ICON[current.scene]; return <span className="w-11 h-11 shrink-0 rounded-2xl bg-card flex items-center justify-center"><Icon size={22} className="text-accent" aria-hidden="true" /></span> })()}
                <p className="text-[22px] leading-tight font-black tracking-[-0.02em] text-foreground">{trackName(current)}</p>
              </div>
              <p className="mt-3 text-[15px] font-semibold text-foreground">{current.rung}단계: {getRung(current.rung).title}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">세션 {current.sessions}회, 마지막 {relativeDay(current.lastAt)}</p>
            </button>
            <PrimaryButton
              onClick={() => {
                trackEvent('training_session_cta', { concern: current.concern, rung: current.rung, from: 'hub' })
                router.push('/training/session')
              }}
            >
              오늘 세션 시작, 약 5분
            </PrimaryButton>
            {doneToday && <p className="-mt-2 text-[13px] font-semibold text-good text-center">오늘 이미 한 번 했어요. 한 번 더 해도 돼요.</p>}
          </section>
        ) : (
          <section className="rounded-[28px] bg-secondary p-6 space-y-2">
            <p className="text-[18px] font-black text-foreground">아직 트랙이 없어요</p>
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              트랙은 &lsquo;어떤 상황에서&rsquo;와 &lsquo;무엇이 고민인지&rsquo;의 조합이에요. 상황을 고르고 3분 진단을 하면, 결과를 보고 고민을 골라 시작해요.
            </p>
          </section>
        )}

        {resting.length > 0 && (
          <section className="rounded-[28px] bg-secondary p-6">
            <p className="eyebrow">쉬고 있는 트랙</p>
            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">기록은 트랙마다 따로 남아요. 돌아가면 하던 단계부터 이어서 해요.</p>
            <div className="mt-3 space-y-2">
              {resting.map((t) => {
                const Icon = SCENE_ICON[t.scene]
                return (
                  <button
                    key={`${t.scene}:${t.concern}`}
                    disabled={switching}
                    onClick={() => openResting(t)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left active:opacity-70 disabled:opacity-50"
                  >
                    <Icon size={20} className="shrink-0 text-foreground/55" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-foreground truncate">{trackName(t)}</p>
                      <p className="text-[12px] text-muted-foreground tabular-nums">{t.rung}단계, 세션 {t.sessions}회, {relativeDay(t.lastAt)}</p>
                    </div>
                    <span className="text-[13px] font-bold text-accent shrink-0">이어 하기</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {current ? (
          <>
            <button
              onClick={() => {
                trackEvent('training_new_track_clicked', { tracks: tracks.length })
                router.push('/training/start')
              }}
              className="w-full h-14 rounded-full border-2 border-dashed border-border flex items-center justify-center gap-2 text-[16px] font-bold text-foreground active:bg-secondary"
            >
              <Plus size={18} /> 새 트랙 시작
            </button>
            <p className="-mt-2 text-[13px] text-muted-foreground text-center">상황을 고르고 진단부터 해요. 한 트랙에 꾸준히 머물수록 변화가 빨라요.</p>
          </>
        ) : (
          <PrimaryButton
            onClick={() => {
              trackEvent('training_new_track_clicked', { tracks: tracks.length })
              router.push('/training/start')
            }}
          >
            첫 트랙 시작하기
          </PrimaryButton>
        )}
      </div>
    </div>
  )
}
