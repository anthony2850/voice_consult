'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AudioWaveform, Briefcase, CalendarPlus, Check, CircleHelp, Gauge, MessageCircle, MessagesSquare,
  MoonStar, Phone, Presentation, Sprout, Sun, Sunrise, TrendingUp, Volume1, Zap, type LucideIcon,
} from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { useTrack } from '@/hooks/useTrack'
import { SCENE_LABELS, SCENE_ORDER, TRACKS, type ConcernSlug, type Scene } from '@/lib/curriculum'
import {
  PRACTICE_TIME, buildPracticeIcs, readPendingOnboarding, writePendingOnboarding,
  type PendingOnboarding, type PracticeTime, type WeeklyGoal,
} from '@/lib/plan'
import { signIn } from '@/components/LoginRequired'
import { getSpeakCategory, readStoredPrompt } from '@/lib/speakPrompts'
import { trackEvent } from '@/lib/analytics'
import { HoldButton, OnboardingShell, OnboardingTitle, OptionCard, PrimaryButton } from '@/components/onboarding/OnboardingParts'

const SCENE_ICON: Record<Scene, LucideIcon> = { interview: Briefcase, presentation: Presentation, call: Phone, daily: MessagesSquare }

type ConcernAnswer = ConcernSlug | 'unknown'
const CONCERN_OPTIONS: { value: ConcernAnswer; icon: LucideIcon; title: string; sub: string }[] = [
  { value: 'trembling', icon: AudioWaveform, title: '목소리가 떨려요', sub: '긴장하면 목소리가 흔들려요' },
  { value: 'small_voice', icon: Volume1, title: '목소리가 작대요', sub: '다시 말해 달라는 말을 자주 들어요' },
  { value: 'fast', icon: Gauge, title: '말이 빨라져요', sub: '긴장하면 숨 쉴 틈 없이 말해요' },
  { value: 'diction', icon: MessageCircle, title: '발음이 뭉개져요', sub: '또박또박 말하기가 어려워요' },
  { value: 'unknown', icon: CircleHelp, title: '잘 모르겠어요', sub: '재 보고 정할래요' },
]

const WEEKLY_OPTIONS: { value: WeeklyGoal; icon: LucideIcon; title: string; sub: string; badge?: string }[] = [
  { value: 3, icon: Sprout, title: '주 3회', sub: '월, 수, 금', badge: '추천' },
  { value: 5, icon: TrendingUp, title: '주 5회', sub: '평일마다' },
  { value: 7, icon: Zap, title: '매일', sub: '하루 5분씩' },
]

const TIME_ICON: Record<PracticeTime, LucideIcon> = { morning: Sunrise, midday: Sun, evening: MoonStar }
const TIME_ORDER: PracticeTime[] = ['morning', 'midday', 'evening']

const QUESTION_STEPS = 5

function timeText(t: PracticeTime) {
  const { label, hh, mm } = PRACTICE_TIME[t]
  const h12 = hh > 12 ? hh - 12 : hh
  return `${label} ${h12}시${mm ? ' 반' : ''}`
}

export default function OnboardingClient() {
  const router = useRouter()
  const params = useSearchParams()
  const { savePlan } = useTrack()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [step, setStep] = useState(0)
  const [scene, setScene] = useState<Scene | null>(null)
  const [concern, setConcern] = useState<ConcernAnswer | null>(null)
  const [weekly, setWeekly] = useState<WeeklyGoal | null>(null)
  const [time, setTime] = useState<PracticeTime | null>(null)
  const [finishing, setFinishing] = useState(false)
  const resumed = useRef(false)

  const finish = useCallback(async (a: PendingOnboarding) => {
    setFinishing(true)
    await savePlan({ weeklyGoal: a.weeklyGoal, time: a.time, selfConcern: a.selfConcern })
    writePendingOnboarding(null)
    trackEvent('onboarding_completed', { scene: a.scene, concern: a.selfConcern ?? 'unknown', weekly: a.weeklyGoal, time: a.time })
    router.push(`/training/diagnose?scene=${a.scene}${a.selfConcern ? `&concern=${a.selfConcern}` : ''}`)
  }, [router, savePlan])

  const resume = params.get('resume') === '1'
  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      const isAuthed = !!data.session
      setAuthed(isAuthed)
      // 방금 녹음에서 고른 말하기 방식에 맞는 상황을 미리 골라 둔다 (자기소개 → 면접)
      const spoken = readStoredPrompt()
      if (spoken) setScene((cur) => cur ?? getSpeakCategory(spoken.category).scene)
      // 로그인하고 돌아온 경우: 저장해 둔 답으로 이어서 진단으로 간다.
      // 로그인을 취소하고 돌아온 경우: 답을 채운 채 마지막 장으로.
      const pending = resume && !resumed.current ? readPendingOnboarding() : null
      if (!pending) return
      resumed.current = true
      if (isAuthed) { void finish(pending); return }
      setScene(pending.scene); setConcern(pending.selfConcern ?? 'unknown'); setWeekly(pending.weeklyGoal); setTime(pending.time)
      setStep(QUESTION_STEPS)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setAuthed(!!s))
    return () => subscription.unsubscribe()
  }, [resume, finish])

  useEffect(() => { trackEvent('onboarding_step_viewed', { step }) }, [step])

  const answers = useMemo<PendingOnboarding | null>(() => (
    scene && concern && weekly && time
      ? { scene, selfConcern: concern === 'unknown' ? null : concern, weeklyGoal: weekly, time }
      : null
  ), [scene, concern, weekly, time])

  const back = () => (step === 0 ? router.push('/') : setStep(step - 1))
  const next = () => setStep(step + 1)

  const downloadIcs = () => {
    if (!answers) return
    const url = URL.createObjectURL(new Blob([buildPracticeIcs(answers)], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'mytone-practice.ics'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    trackEvent('onboarding_calendar_added', { weekly: answers.weeklyGoal, time: answers.time })
  }

  const start = () => {
    if (!answers) return
    if (authed) { void finish(answers); return }
    writePendingOnboarding(answers)
    setStep(QUESTION_STEPS)
  }

  if (step === 0) {
    return (
      <OnboardingShell step={0} total={QUESTION_STEPS} onBack={back} footer={<PrimaryButton disabled={!scene} onClick={next}>다음</PrimaryButton>}>
        <OnboardingTitle sub="그 상황의 문장으로 처음부터 끝까지 연습해요.">{'어떤 상황에서\n말을 잘하고 싶나요?'}</OnboardingTitle>
        <div className="space-y-3" role="radiogroup" aria-label="상황">
          {SCENE_ORDER.map((s) => (
            <OptionCard key={s} icon={SCENE_ICON[s]} title={SCENE_LABELS[s].label} sub={SCENE_LABELS[s].hint} selected={scene === s} onSelect={() => setScene(s)} />
          ))}
        </div>
      </OnboardingShell>
    )
  }

  if (step === 1) {
    return (
      <OnboardingShell step={1} total={QUESTION_STEPS} onBack={back} footer={<PrimaryButton disabled={!concern} onClick={next}>다음</PrimaryButton>}>
        <OnboardingTitle sub="진단에서 실제로 재 보고, 고르신 것과 비교해 드려요.">{'말할 때 무엇이\n가장 걸리나요?'}</OnboardingTitle>
        <div className="space-y-3" role="radiogroup" aria-label="고민">
          {CONCERN_OPTIONS.map((o) => (
            <OptionCard key={o.value} icon={o.icon} title={o.title} sub={o.sub} selected={concern === o.value} onSelect={() => setConcern(o.value)} />
          ))}
        </div>
      </OnboardingShell>
    )
  }

  if (step === 2) {
    return (
      <OnboardingShell step={2} total={QUESTION_STEPS} onBack={back} footer={<PrimaryButton disabled={!weekly} onClick={next}>다음</PrimaryButton>}>
        <OnboardingTitle sub="목도 쉬는 날이 필요해요. 쉬는 날에는 기록이 끊기지 않아요.">{'일주일에 몇 번\n연습할까요?'}</OnboardingTitle>
        <div className="space-y-3" role="radiogroup" aria-label="연습 횟수">
          {WEEKLY_OPTIONS.map((o) => (
            <OptionCard key={o.value} icon={o.icon} title={o.title} sub={o.sub} badge={o.badge} selected={weekly === o.value} onSelect={() => setWeekly(o.value)} />
          ))}
        </div>
      </OnboardingShell>
    )
  }

  if (step === 3) {
    return (
      <OnboardingShell step={3} total={QUESTION_STEPS} onBack={back} footer={<PrimaryButton disabled={!time} onClick={next}>다음</PrimaryButton>}>
        <OnboardingTitle sub="시간을 정해 두면 실제로 지킬 확률이 높아져요. 그 시간에 캘린더 알림을 만들어 드릴게요.">{'언제 연습할까요?'}</OnboardingTitle>
        <div className="space-y-3" role="radiogroup" aria-label="연습 시간">
          {TIME_ORDER.map((t) => (
            <OptionCard key={t} icon={TIME_ICON[t]} title={PRACTICE_TIME[t].label} sub={PRACTICE_TIME[t].hint} selected={time === t} onSelect={() => setTime(t)} />
          ))}
        </div>
      </OnboardingShell>
    )
  }

  if (step === 4 && answers) {
    return (
      <OnboardingShell
        step={4} total={QUESTION_STEPS} onBack={back} align="top"
        footer={
          <div className="space-y-2">
            <HoldButton onDone={start} disabled={finishing}>{finishing ? '준비 중…' : '꾹 눌러서 진단 시작'}</HoldButton>
            <p className="text-center text-[13px] text-muted-foreground">녹음 4번, 약 3분이에요</p>
          </div>
        }
      >
        <p className="eyebrow">왜 효과가 있나요</p>
        <h1 className="mt-2 text-[32px] leading-[1.18] font-black tracking-[-0.03em]">
          목소리도 연습하면<br /><span className="text-accent">바뀌어요</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-foreground/80">
          연습 직후에 잘 되는 것과 실력이 남는 것은 달라요. 그래서 MyTone은 쉬고 난 뒤의 첫 녹음으로 실력을 확인하고, 그 결과로 다음 단계를 정해요.
        </p>

        <figure className="mt-6 rounded-[28px] bg-secondary p-5 m-0">
          <p className="text-[12px] font-bold tracking-wide text-muted-foreground">2주 동안 생기는 일</p>
          <svg viewBox="0 0 300 160" className="mt-3 w-full h-auto" role="img" aria-label="단계를 올리며 연습하면 쉬고 난 뒤 첫 녹음이 점점 좋아지고, 같은 연습만 반복하면 금방 제자리에 머무는 그림">
            <line x1="24" y1="128" x2="292" y2="128" stroke="currentColor" className="text-border" strokeWidth="1.5" />
            <line x1="24" y1="12" x2="24" y2="128" stroke="currentColor" className="text-border" strokeWidth="1.5" />
            <path d="M24 118 C 90 112, 150 92, 282 40" fill="none" stroke="#2D3A8C" strokeWidth="4" strokeLinecap="round" />
            <path d="M24 118 C 80 104, 140 100, 282 98" fill="none" stroke="currentColor" className="text-muted-foreground" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" />
            <circle cx="282" cy="40" r="5" fill="#2D3A8C" />
            <text x="128" y="38" fontSize="12" fontWeight="700" fill="#2D3A8C">단계를 올리며 연습</text>
            <text x="150" y="118" fontSize="12" fill="currentColor" className="text-muted-foreground">같은 연습만 반복</text>
            <text x="24" y="148" fontSize="11" fill="currentColor" className="text-muted-foreground">첫날</text>
            <text x="292" y="148" fontSize="11" textAnchor="end" fill="currentColor" className="text-muted-foreground">2주 뒤</text>
          </svg>
          <figcaption className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            세로축은 쉬고 난 뒤 첫 녹음이에요. 연구 결과를 그린 그림이고, MyTone 측정 결과가 아니에요. 근거: Soderstrom과 Bjork(2015), 학습과 수행의 구분.
          </figcaption>
        </figure>

        <section className="mt-4 rounded-[28px] bg-white border border-border p-5">
          <p className="eyebrow">내 계획</p>
          <dl className="mt-3 space-y-2.5 text-[15px]">
            {[
              ['상황', SCENE_LABELS[answers.scene].label],
              ['고민', answers.selfConcern ? `${TRACKS[answers.selfConcern].label}, 진단으로 확인해요` : '진단으로 정해요'],
              ['횟수', answers.weeklyGoal === 7 ? '매일' : `주 ${answers.weeklyGoal}회`],
              ['시간', timeText(answers.time)],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <dt className="w-10 shrink-0 text-muted-foreground">{k}</dt>
                <dd className="font-semibold text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={downloadIcs} className="mt-4 w-full h-11 rounded-full border border-border flex items-center justify-center gap-2 text-[14px] font-semibold active:bg-secondary">
            <CalendarPlus size={17} /> 캘린더에 연습 전화 추가
          </button>
        </section>
      </OnboardingShell>
    )
  }

  // step 5 — 로그인 전 사용자
  return (
    <OnboardingShell step={QUESTION_STEPS - 1} total={QUESTION_STEPS} onBack={() => setStep(4)} footer={
      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        로그인하면 만 14세 이상이며 <Link href="/terms" className="underline underline-offset-2">이용약관</Link>과{' '}
        <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link>에 동의한 것으로 봐요.
      </p>
    }>
      <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center" aria-hidden="true">
        <Check size={30} className="text-brand-text" />
      </div>
      <OnboardingTitle sub="진단 결과와 훈련 기록이 계정에 남아요. 다른 기기에서도 이어서 할 수 있어요.">{'계획이 준비됐어요.\n저장하려면 로그인해 주세요'}</OnboardingTitle>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => signIn('google', '/training/onboarding?resume=1', 'onboarding')}
          className="w-full h-14 flex items-center justify-center gap-3 rounded-full bg-white border border-gray-200 text-gray-800 text-[16px] font-semibold active:scale-[0.98] transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          구글로 계속하기
        </button>
        <button
          type="button"
          onClick={() => signIn('kakao', '/training/onboarding?resume=1', 'onboarding')}
          className="w-full h-14 flex items-center justify-center gap-3 rounded-full bg-[#FEE500] text-[#191919] text-[16px] font-semibold active:scale-[0.98] transition-transform"
        >
          <svg width="18" height="17" viewBox="0 0 18 17" fill="none" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.029 0 0 3.054 0 6.818c0 2.388 1.525 4.488 3.831 5.744L2.88 16.06a.25.25 0 0 0 .373.287L7.91 13.47A10.59 10.59 0 0 0 9 13.636c4.971 0 9-3.054 9-6.818C18 3.054 13.971 0 9 0z" fill="#191919"/>
          </svg>
          카카오로 계속하기
        </button>
      </div>
    </OnboardingShell>
  )
}
