'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AudioWaveform, Gauge, MessageCircle, Volume1, type LucideIcon } from 'lucide-react'
import { useTrack } from '@/hooks/useTrack'
import {
  CONCERN_LABELS, CONCERN_ORDER, DIAGNOSIS_LEVELS, SCENE_LABELS, SCENE_ORDER, TRACKS, getRung,
  type ConcernSlug, type RungLevel, type Scene,
} from '@/lib/curriculum'
import {
  CLARITY_MIN, JITTER_LIMIT, PACE_RANGE, diagnosisSteps, dictionStartRung, startRungFromBoundary, suggestConcernsFromDiagnosis, type DiagnosisSuggestion, type Measure,
} from '@/lib/trainingCycle'
import { PRACTICE_TIME } from '@/lib/plan'
import { Checklist, Display, Eyebrow, MetricRow, OptionCard, PageHeader, Pill, PrimaryButton, ProgressBar, SpecialButton, SurfaceCard } from '@/components/ds'
import { measureBlob } from '@/lib/trainingMeasure'
import { clarityPct, transcribe } from '@/lib/clarity'
import RecordStep from '@/components/training/RecordStep'
import DiagnosisLadder from '@/components/training/DiagnosisLadder'
import { trackEvent } from '@/lib/analytics'
import { iGa } from '@/lib/voiceScene'

type Phase = 'intro' | 'climb' | 'choose' | 'planning'

const CONCERN_ICON: Record<ConcernSlug, LucideIcon> = { trembling: AudioWaveform, small_voice: Volume1, fast: Gauge, diction: MessageCircle }

export default function DiagnoseClient() {
  const router = useRouter()
  const params = useSearchParams()
  const { loading, profile, plan, startTrack, insertSession } = useTrack()
  // 트랙 전환에서 왔으면 바꾸려는 상황, 고민이 쿼리로 온다. 진단을 마쳐야 트랙이 바뀐다.
  const qScene = params.get('scene')
  const qConcern = params.get('concern')
  const targetScene: Scene | null = SCENE_ORDER.includes(qScene as Scene) ? (qScene as Scene) : profile.scene
  const targetConcern: ConcernSlug | null = CONCERN_ORDER.includes(qConcern as ConcernSlug) ? (qConcern as ConcernSlug) : null
  const [phase, setPhase] = useState<Phase>('intro')
  const [levelIdx, setLevelIdx] = useState(0)
  const [measures, setMeasures] = useState<Measure[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [failNote, setFailNote] = useState<string | null>(null)
  const [picked, setPicked] = useState<ConcernSlug | null>(targetConcern)
  // 계획 만드는 중: 실제로 끝난 단계 수
  const [planDone, setPlanDone] = useState(0)
  const [planned, setPlanned] = useState<{ concern: ConcernSlug; rung: RungLevel } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // 장면이 없으면 새 트랙 화면에서 고르게 한다.
  useEffect(() => {
    if (!loading && !targetScene) router.replace('/training/start')
  }, [loading, targetScene, router])

  const suggestions = useMemo<DiagnosisSuggestion[]>(
    () => (phase === 'choose' || phase === 'planning' ? suggestConcernsFromDiagnosis(measures) : []),
    [phase, measures],
  )

  if (loading || !targetScene) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-84px)]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }
  const scene = targetScene
  const level = DIAGNOSIS_LEVELS[levelIdx]
  const rung = getRung(level)

  async function handleRecorded(blob: Blob) {
    setAnalyzing(true)
    setFailNote(null)
    try {
      // 3, 4단계는 글자로 바꿔 알아들은 비율도 잰다(발음). 고민은 진단이 끝나야 고르니 모두에게 잰다.
      const script = level >= 3 ? rung.script(scene, 0) : null
      const [m, heard] = await Promise.all([measureBlob(blob, level), script ? transcribe(blob) : Promise.resolve(null)])
      if (!m) {
        setFailNote('소리가 잘 잡히지 않았어요. 마이크에 조금 더 가까이에서 다시 녹음해 주세요.')
        return
      }
      if (script && heard != null) m.clarity_pct = clarityPct(script, heard)
      const next = [...measures.filter((x) => x.level !== level), m]
      setMeasures(next)
      trackEvent('diagnosis_rung_recorded', { level, jitter_source: m.jitter_source })
      if (levelIdx + 1 < DIAGNOSIS_LEVELS.length) {
        setLevelIdx(levelIdx + 1)
      } else {
        setPhase('choose')
      }
    } finally {
      setAnalyzing(false)
    }
  }

  function startRungFor(concern: ConcernSlug): RungLevel {
    if (TRACKS[concern].metric === 'clarity') return dictionStartRung(measures)
    return startRungFromBoundary(suggestions.find((x) => x.concern === concern)?.boundary ?? null)
  }

  async function handleConfirm() {
    if (!picked) return
    setSaveError(null)
    const s = suggestions.find((x) => x.concern === picked)
    const startRung = startRungFor(picked)
    const baseline = measures.find((m) => m.level === 4) ?? null
    setPlanned({ concern: picked, rung: startRung })
    setPlanDone(0)
    setPhase('planning')
    const ok = await startTrack({ concern: picked, rung: startRung, baseline, scene })
    if (!ok) {
      setSaveError('저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.')
      setPhase('choose')
      return
    }
    await insertSession({
      kind: 'diagnosis', concern: picked, scene, rung: startRung, session_index: 0,
      voice_use: null, variation_id: null, retention: null, performance: null,
      rung_measures: measures, effort: null, pain: false, met_criterion: null, next_rung: startRung,
    })
    trackEvent('diagnosis_completed', { concern: picked, start_rung: startRung, boundary: s?.boundary ?? 'none' })
    // 저장이 끝난 뒤에만 첫 체크를 켠다. 나머지는 이미 정해진 내용이라 차례로 보여 주기만 한다.
    setPlanDone(1)
    timers.current = [2, 3, 4].map((n, i) => setTimeout(() => setPlanDone(n), 650 * (i + 1)))
  }

  // ── 1일차 기준점 / 계획 만드는 중 ───────────────────────────────────────────
  if (phase === 'choose' || phase === 'planning') {
    const sustained = measures.find((m) => m.level === 1) ?? null
    const speech = measures.find((m) => m.level === 4) ?? measures[measures.length - 1] ?? null
    const jitterOk = sustained ? sustained.jitter_rel_pct <= JITTER_LIMIT[sustained.jitter_source] : null
    const pace = speech?.onsets_per_second ?? null
    const paceTone = pace == null ? null : pace > PACE_RANGE.max ? 'fast' : pace < PACE_RANGE.min ? 'slow' : 'ok'

    if (phase === 'planning' && planned) {
      const items = [
        '1일차 기준점을 저장했어요',
        `${TRACKS[planned.concern].label} 트랙, ${planned.rung}단계 ${getRung(planned.rung).title}부터 시작해요`,
        `${SCENE_LABELS[scene].label} 문장으로 연습해요`,
        plan
          ? `${plan.weeklyGoal === 7 ? '매일' : `주 ${plan.weeklyGoal}회`}, ${PRACTICE_TIME[plan.time].label}에 연습해요`
          : '주 3회 연습을 목표로 해요',
      ]
      const ready = planDone >= items.length
      return (
        <div className="fixed inset-0 z-[60] mx-auto w-full max-w-[480px] bg-background flex flex-col">
          <div className="flex-1 overflow-y-auto px-5 pt-16 pb-6 space-y-7">
            <div className="text-center space-y-2">
              <Eyebrow>내 계획</Eyebrow>
              <Display>{'연습 계획을\n만들고 있어요'}</Display>
            </div>
            <ProgressBar value={planDone / items.length} label="계획 만드는 중" />
            <SurfaceCard><Checklist items={items} done={planDone} /></SurfaceCard>
          </div>
          <div className="shrink-0 px-5 pt-2 pb-[max(env(safe-area-inset-bottom),20px)]">
            <SpecialButton disabled={!ready} onClick={() => router.replace('/training/track')}>
              {ready ? '내 훈련 시작' : '만드는 중…'}
            </SpecialButton>
          </div>
        </div>
      )
    }

    return (
      <div className="fixed inset-0 z-[60] mx-auto w-full max-w-[480px] bg-background flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 pt-14 pb-6 space-y-6">
          <div className="text-center space-y-2">
            <Eyebrow>1일차 기준점</Eyebrow>
            <Display sub="앞으로 이 값과 비교해요.">{'오늘이 당신의\n1일차예요'}</Display>
          </div>

          <SurfaceCard className="py-2">
            {sustained && (
              <MetricRow
                label="목소리 떨림" value={sustained.jitter_rel_pct.toFixed(2)} unit="%" hint={`"음~" 허밍에서, 기준 ${JITTER_LIMIT[sustained.jitter_source]}% 이하`}
                pill={jitterOk ? <Pill tone="good">기준 안</Pill> : <Pill tone="caution">기준 넘음</Pill>}
              />
            )}
            {pace != null && (
              <MetricRow
                label="말 빠르기" value={pace.toFixed(1)} unit="글자/초" hint={`실제 첫 문장에서, 기준 ${PACE_RANGE.max}글자 이하`}
                pill={paceTone === 'fast' ? <Pill tone="caution">기준 넘음</Pill> : <Pill tone="good">기준 안</Pill>}
              />
            )}
            {speech?.clarity_pct != null && (
              <MetricRow
                label="발음 또렷함" value={String(Math.round(speech.clarity_pct))} unit="%" hint={`실제 첫 문장에서 알아들은 글자, 기준 ${CLARITY_MIN}% 이상`}
                pill={speech.clarity_pct >= CLARITY_MIN ? <Pill tone="good">기준 안</Pill> : <Pill tone="caution">기준 미만</Pill>}
              />
            )}
            {speech && <MetricRow label="목소리 크기" value={speech.db_mean.toFixed(0)} unit="dB" pill={<Pill>첫 기록</Pill>} />}
          </SurfaceCard>

          {/* 스스로 고른 고민과 측정에서 먼저 드러난 고민 — 측정이 우리 차별점이 드러나는 순간 */}
          {plan?.selfConcern && suggestions[0] && (() => {
            const self = TRACKS[plan.selfConcern].label
            const top = TRACKS[suggestions[0].concern].label
            const same = suggestions[0].concern === plan.selfConcern
            // 측정에서 실제로 걸린 고민이 있을 때만 "먼저 눈에 띈다"고 말한다. 모두 괜찮으면 목록 첫 항목은 의미가 없다.
            const measuredIssue = suggestions[0].boundary !== null
            const line = !measuredIssue
              ? `${self}${iGa(self)} 고민이라고 하셨는데, 이번 녹음에서는 모두 기준 안이었어요. 고르신 고민부터 연습해 볼까요?`
              : same
                ? `고르신 ${self}${iGa(self)} 측정에서도 가장 먼저 보여요.`
                : `${self}${iGa(self)} 고민이라고 하셨는데, 재 보니 ${top}${iGa(top)} 먼저 눈에 띄어요.`
            return (
              <div className="rounded-[28px] border-2 border-accent/15 p-5 space-y-1" role="status">
                <Eyebrow>고르신 고민과 측정 결과</Eyebrow>
                <p className="text-[16px] font-bold text-foreground leading-relaxed">{line}</p>
              </div>
            )
          })()}

          <div className="space-y-3">
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-foreground">어떤 고민부터 연습할까요?</h2>
            <p className="-mt-1 text-[13px] text-muted-foreground leading-relaxed">나중에 바꿀 수 있어요.</p>
            <div className="space-y-3" role="radiogroup" aria-label="연습할 고민">
              {suggestions.map((s, i) => (
                <OptionCard
                  key={s.concern}
                  icon={CONCERN_ICON[s.concern]}
                  title={CONCERN_LABELS[s.concern]}
                  sub={s.reason}
                  badge={i === 0 && s.boundary !== null ? '제안' : undefined}
                  selected={picked === s.concern}
                  onSelect={() => setPicked(s.concern)}
                />
              ))}
            </div>
          </div>
          {picked && (() => {
            const steps = diagnosisSteps(picked, measures)
            return steps && <DiagnosisLadder label={CONCERN_LABELS[picked]} steps={steps} start={startRungFor(picked)} />
          })()}
          {saveError && <p className="text-[13px] text-destructive" role="alert">{saveError}</p>}
        </div>
        <div className="shrink-0 px-5 pt-2 pb-[max(env(safe-area-inset-bottom),20px)]">
          <PrimaryButton disabled={!picked} onClick={handleConfirm}>이 고민으로 시작</PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-84px)]">
      <PageHeader
        back={{ label: '나가기', onClick: () => router.push('/training') }}
        eyebrow={`진단, ${SCENE_LABELS[scene].label} 상황`}
        title="어디서부터 어려워지는지 찾아요"
        chips={phase === 'climb' && <Pill tone="data">{levelIdx + 1} / {DIAGNOSIS_LEVELS.length}</Pill>}
      />

      <div className="px-5 pt-4 pb-8 space-y-4">
        {phase === 'intro' && (
          <section className="rounded-[28px] bg-secondary p-6 space-y-5">
            <div className="space-y-1.5">
              <p className="text-[17px] font-black text-foreground">말을 나눠서, 하나씩 얹어 봐요</p>
              <p className="text-[14px] text-foreground leading-relaxed">
                말은 소리, 높낮이, 자음이 겹쳐서 완성돼요. 하나씩 얹으며 어디서 흔들리는지 찾아요.
              </p>
            </div>
            <ol className="space-y-3">
              {DIAGNOSIS_LEVELS.map((l) => {
                const r = getRung(l)
                return (
                  <li key={l} className="flex gap-3">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-primary text-primary-foreground text-[13px] font-black flex items-center justify-center tabular-nums">{l}</span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-foreground">{r.title}</span>
                      <span className="block text-[13px] text-muted-foreground">{l === 1 ? '소리만' : `+ ${r.adds}`}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              평소처럼 하면 돼요. 조용한 곳에서 해 주세요.
            </p>
            <PrimaryButton onClick={() => { trackEvent('diagnosis_started', { scene }); setPhase('climb') }}>시작</PrimaryButton>
          </section>
        )}

        {phase === 'climb' && (
          <>
            {failNote && <p className="text-[13px] text-caution px-1">{failNote}</p>}
            <RecordStep
              key={rung.id}
              eyebrow={`${level}단계`}
              title={rung.title}
              instructions={[rung.diagnoseHint ?? rung.instructions[0]]}
              script={rung.script(scene, 0)}
              scriptLabel={rung.scriptLabel}
              maxSec={rung.maxSec}
              analyzing={analyzing}
              onRecorded={handleRecorded}
              doneLabel={levelIdx + 1 < DIAGNOSIS_LEVELS.length ? '다음 녹음' : '진단 결과 보기'}
            />
          </>
        )}

      </div>
    </div>
  )
}
