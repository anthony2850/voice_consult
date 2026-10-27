'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTrack, type TrainingSessionRow } from '@/hooks/useTrack'
import { SCENE_LABELS, SCENE_SCRIPTS, TRACKS, getRung, type RungLevel } from '@/lib/curriculum'
import {
  METRIC_INFO, allowStrongVariations, judgeStep, metricValue, nextRung, performanceCopy,
  CLARITY_MIN, JITTER_LIMIT, LOUDNESS_TOLERANCE_DB, PACE_RANGE, SMALL_VOICE_DROP_DB, pickVariation, retentionCopy, retentionVerdict, rungReason, sessionRungs, type Measure,
} from '@/lib/trainingCycle'
import { measureBlob } from '@/lib/trainingMeasure'
import { clarityPct, transcribe } from '@/lib/clarity'
import RecordStep from '@/components/training/RecordStep'
import RungComplete from '@/components/training/RungComplete'
import { trackEvent } from '@/lib/analytics'
import { PageHeader, Pill } from '@/components/ds'

type Step = 'retention' | 'exerciseA' | 'exerciseB' | 'performance' | 'selfJudge' | 'cost' | 'result' | 'saved'

const STEP_ORDER: Step[] = ['retention', 'exerciseA', 'exerciseB', 'performance', 'selfJudge', 'cost', 'result']

function fmt(metric: keyof typeof METRIC_INFO, m: Measure | null): string {
  if (!m) return '—'
  // 떨림은 기준과 같은 단위(%)로 보여 준다. metricValue는 기준으로 나눈 비율이다.
  if (metric === 'jitter') return m.jitter_rel_pct.toFixed(1)
  if (metric === 'clarity') return m.clarity_pct == null ? '—' : String(Math.round(m.clarity_pct))
  return metricValue(metric, m).toFixed(1)
}

export default function SessionClient() {
  const router = useRouter()
  const { loading, profile, sessions, trackSessions, insertSession, setTrackRung } = useTrack()

  const [step, setStep] = useState<Step>('retention')
  const [retention, setRetention] = useState<Measure | null>(null)
  const [rungMeasures, setRungMeasures] = useState<Measure[]>([])
  const [performance, setPerformance] = useState<Measure | null>(null)
  // 발음 트랙: 도전 녹음을 직접 듣고 판단한다
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null)
  const [selfOk, setSelfOk] = useState<boolean | null>(null)
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [pain, setPain] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [failNote, setFailNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // 저장을 다시 누를 때 같은 연습을 두 번 넣지 않는다
  const inserted = useRef(false)

  useEffect(() => {
    if (!loading && !profile.trackConcern) router.replace('/training')
  }, [loading, profile.trackConcern, router])

  useEffect(() => () => { if (challengeUrl) URL.revokeObjectURL(challengeUrl) }, [challengeUrl])

  // 연습 시작 기록. 예전에는 "오늘 목을 얼마나 썼나요?"에 답할 때 보냈다.
  const started = useRef(false)
  useEffect(() => {
    if (loading || !profile.trackConcern || started.current) return
    started.current = true
    trackEvent('training_session_started', { concern: profile.trackConcern, rung: profile.trackRung ?? 1 })
  }, [loading, profile.trackConcern, profile.trackRung])

  const track = profile.trackConcern ? TRACKS[profile.trackConcern] : null
  // 세션을 시작한 단계로 고정한다. 저장하면서 트랙 단계가 올라가도 이 세션의 결과 문구와 제목은 그대로여야 한다.
  const startRung = useRef<RungLevel | null>(null)
  if (!loading && startRung.current == null && profile.trackRung != null) startRung.current = profile.trackRung
  const current: RungLevel = startRung.current ?? profile.trackRung ?? 1
  const [rungDone, setRungDone] = useState<{ from: RungLevel; to: RungLevel } | null>(null)
  const scene = profile.scene ?? 'daily'
  // 지난 연습과 회차도 시작할 때 값으로 고정한다. 저장하면 방금 한 연습이 목록 맨 앞에 들어와서,
  // 고정하지 않으면 결과 카드가 오늘 녹음끼리 비교하게 된다.
  const pinned = useRef<{ last: TrainingSessionRow | null; index: number } | null>(null)
  if (!loading && pinned.current == null && profile.trackConcern) pinned.current = { last: trackSessions[0] ?? null, index: trackSessions.length }
  const sessionIndex = pinned.current?.index ?? trackSessions.length
  const lastSession = pinned.current ? pinned.current.last : (trackSessions[0] ?? null)
  const rungs = useMemo(() => sessionRungs(current), [current])
  const variation = useMemo(
    () => (track ? pickVariation(track, sessionIndex, allowStrongVariations(profile.baseline)) : null),
    [track, sessionIndex, profile.baseline],
  )

  if (loading || !track || !variation) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-84px)]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const metric = track.metric
  const baseScript = SCENE_SCRIPTS[scene].short

  function advance(from: Step) {
    let i = STEP_ORDER.indexOf(from) + 1
    if (STEP_ORDER[i] === 'selfJudge' && metric !== 'clarity') i += 1
    setStep(STEP_ORDER[i])
  }

  /**
   * @param script 발음 트랙에서 알아들은 글자 비율을 잴 문장. 글자로 말하는 녹음에만 준다
   *   (1단계 허밍, 2단계 "아~"는 글자가 없어 주지 않는다).
   */
  async function measureOrRetry(blob: Blob, level: RungLevel | undefined, onOk: (m: Measure) => void, script?: string | null) {
    setAnalyzing(true)
    setFailNote(null)
    try {
      const [m, heard] = await Promise.all([
        measureBlob(blob, level),
        metric === 'clarity' && script ? transcribe(blob) : Promise.resolve(null),
      ])
      if (!m) {
        setFailNote('소리가 잘 잡히지 않았어요. 마이크에 조금 더 가까이에서 다시 녹음해 주세요.')
        return
      }
      // 인식에 실패하면 비율 없이 넘어가고, 그 녹음은 직접 듣고 고른 답으로 판정한다
      if (metric === 'clarity' && script && heard != null) m.clarity_pct = clarityPct(script, heard)
      onOk(m)
    } finally {
      setAnalyzing(false)
    }
  }

  // ── 판정 (result 단계에서 계산) ─────────────────────────────────────────────
  // 단계 판정은 도전 녹음으로 한다. 마무리 녹음은 다음 연습 시작 녹음과 비교(파지)하는 데 쓴다.
  const challenge = rungMeasures.length >= 2 ? rungMeasures[rungMeasures.length - 1] : null
  const diagnosisMeasures = sessions.find((s) => s.kind === 'diagnosis' && s.scene === scene && s.rung_measures?.length)?.rung_measures ?? null
  const judged = judgeStep({ metric, rung: rungs.b, challenge, final: performance, diagnosis: diagnosisMeasures, baseline: profile.baseline, selfOk })
  const met = performance ? judged.met : null
  const judgedLabel = judged.on === 'challenge' ? `오늘 도전(${rungs.b}단계)` : '오늘 마무리 녹음'
  const next = effort ? nextRung(current, { met, effort, pain }) : current
  const verdict = retentionVerdict(metric, lastSession?.performance ?? null, retention)

  async function handleSave() {
    if (!effort) return
    setSaving(true)
    setSaveError(null)
    try {
      if (!inserted.current) {
        const ok = await insertSession({
          kind: 'session', concern: track!.concern, scene, rung: current, session_index: sessionIndex + 1,
          voice_use: null, variation_id: variation!.id,
          retention, performance, rung_measures: rungMeasures,
          effort, pain, met_criterion: met, next_rung: next,
        })
        if (!ok) { setSaveError('저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.'); return }
        inserted.current = true
      }
      if (next !== current && !(await setTrackRung(next))) {
        setSaveError('다음 단계를 저장하지 못했어요. 다시 눌러 주세요.')
        return
      }
      if (next > current) setRungDone({ from: current, to: next })
      // 힘든 정도와 통증은 건강 관련 자가 응답이라 분석 도구(GA, Meta)로 보내지 않는다. DB에만 저장.
      // 다음 단계도 보내지 않는다. 단계가 내려가면 통증이나 힘든 정도 5라는 뜻이라 답이 드러난다.
      trackEvent('training_session_completed', {
        concern: track!.concern, rung: current, met: met ?? 'na', verdict,
      })
      setStep('saved')
    } finally {
      setSaving(false)
    }
  }

  const stepNo = Math.max(1, STEP_ORDER.indexOf(step) + 1 - (metric !== 'clarity' && STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf('selfJudge') ? 1 : 0))
  const stepTotal = metric === 'clarity' ? 7 : 6

  return (
    <div className="min-h-[calc(100vh-84px)]">
      <PageHeader
        back={{ label: '나가기', onClick: () => router.push('/training/track') }}
        eyebrow={`${SCENE_LABELS[scene].label} ${track.label} 트랙, ${sessionIndex + 1}번째 연습`}
        title={`오늘은 ${current}단계에 도전해요`}
        chips={step !== 'saved' && <Pill tone="data">{stepNo} / {stepTotal}</Pill>}
      />

      {rungDone && <RungComplete from={rungDone.from} to={rungDone.to} onClose={() => setRungDone(null)} />}

      <div className="px-5 pt-4 pb-8 space-y-4">
        {failNote && <p className="text-[13px] text-caution px-1">{failNote}</p>}

        {step === 'retention' && (
          <p className="rounded-2xl border-2 border-accent/15 px-4 py-3 text-[14px] font-semibold text-foreground leading-relaxed" role="status">
            {rungReason(track.concern, current, lastSession, diagnosisMeasures)}
          </p>
        )}

        {step === 'retention' && (
          <RecordStep
            eyebrow="시작 녹음"
            title="평소대로 한 번 읽어요"
            instructions={[]}
            script={baseScript}
            maxSec={12}
            analyzing={analyzing}
            onRecorded={(b) => measureOrRetry(b, 4, (m) => { setRetention(m); advance('retention') }, baseScript)}
          />
        )}

        {step === 'exerciseA' && (() => {
          const r = getRung(rungs.a)
          return (
            <RecordStep
              key={`a-${r.id}`}
              badge={{ label: '몸 풀기', tone: 'warm' }}
              title={`${rungs.a}단계 ${r.title}`}
              reason={rungs.a < rungs.b ? `${rungs.b}단계에 도전하기 전에, 이미 되는 ${rungs.a}단계로 목을 풀어요.` : '목을 풀며 오늘 단계를 한 번 먼저 해 봐요.'}
              keyInfo={track.keyInfo}
              instructions={r.practiceHint ? [r.practiceHint] : []}
              script={r.script(scene, sessionIndex)}
              scriptLabel={r.scriptLabel}
              maxSec={r.maxSec}
              targetSec={r.targetSec}
              prepSec={r.prepSec}
              analyzing={analyzing}
              onRecorded={(b) => measureOrRetry(b, rungs.a, (m) => { setRungMeasures((x) => [...x, m]); advance('exerciseA') })}
              doneLabel="저장하고 다음"
              voiceLine
              voiceLineMode={r.level === 1 ? 'sustained' : 'speech'}
            />
          )
        })()}

        {step === 'exerciseB' && (() => {
          const r = getRung(rungs.b)
          return (
            <RecordStep
              key={`b-${r.id}`}
              badge={{ label: '도전', tone: 'challenge' }}
              title={`${rungs.b}단계 ${r.title}`}
              reason="오늘 연습의 핵심이에요. 잘 안 돼도 괜찮아요." 
              keyInfo={track.keyInfo}
              instructions={r.practiceHint ? [r.practiceHint] : []}
              variation={variation}
              script={r.script(scene, sessionIndex)}
              scriptLabel={r.scriptLabel}
              maxSec={r.maxSec}
              targetSec={r.targetSec}
              prepSec={r.prepSec}
              analyzing={analyzing}
              onRecorded={(b) => {
                if (metric === 'clarity') setChallengeUrl(URL.createObjectURL(b))
                measureOrRetry(b, rungs.b, (m) => { setRungMeasures((x) => [...x, m]); advance('exerciseB') }, rungs.b >= 3 ? r.script(scene, sessionIndex) : null)
              }}
              doneLabel="저장하고 다음"
              voiceLine
              voiceLineMode={r.level === 1 ? 'sustained' : 'speech'}
            />
          )
        })()}

        {step === 'performance' && (
          <RecordStep
            eyebrow="마무리 녹음"
            title="연습한 느낌 그대로 한 번 더"
            instructions={[]}
            script={baseScript}
            maxSec={12}
            analyzing={analyzing}
            onRecorded={(b) => measureOrRetry(b, 4, (m) => { setPerformance(m); advance('performance') }, baseScript)}
            doneLabel="저장하고 다음"
          />
        )}

        {step === 'selfJudge' && (
          <div className="glass rounded-3xl p-6 space-y-4">
            <div>
              <p className="eyebrow">직접 들어 보기</p>
              <p className="text-base font-bold text-foreground">{track.keyInfo}</p>
              <p className="text-xs text-muted-foreground mt-1">도전 녹음을 듣고 골라 주세요.</p>
            </div>
            {challengeUrl && <audio controls src={challengeUrl} className="w-full h-10" />}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setSelfOk(true); advance('selfJudge') }} className="h-12 rounded-2xl bg-good-tint border border-good/40 text-sm font-bold text-good">네, 다 들렸어요</button>
              <button onClick={() => { setSelfOk(false); advance('selfJudge') }} className="h-12 rounded-2xl bg-card text-sm font-bold text-foreground">아니요, 뭉개진 데가 있어요</button>
            </div>
          </div>
        )}

        {step === 'cost' && (
          <div className="glass rounded-3xl p-6 space-y-4">
            <div>
              <p className="eyebrow">목 상태</p>
              <p className="text-base font-bold text-foreground">방금 말할 때 목이 얼마나 힘들었나요?</p>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setEffort(n)}
                  className={`h-12 rounded-xl text-sm font-bold transition-all ${effort === n ? 'gradient-primary text-primary-foreground' : 'bg-card text-foreground'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground px-1">
              <span>편했어요</span><span>아주 힘들었어요</span>
            </div>
            <button
              onClick={() => setPain((p) => !p)}
              className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 text-left ${pain ? 'bg-caution-tint border border-caution/40' : 'bg-card'}`}
            >
              <span className="text-sm font-semibold text-foreground">목에 통증이나 따끔함이 있었어요</span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pain ? 'border-caution bg-caution' : 'border-border'}`}>
                {pain && <span className="text-white text-[10px]">✓</span>}
              </span>
            </button>
            <button
              disabled={!effort}
              onClick={() => advance('cost')}
              className="w-full h-14 rounded-full bg-primary text-primary-foreground text-[16px] font-bold active:scale-95 transition-transform disabled:opacity-50"
            >
              결과 보기
            </button>
          </div>
        )}

        {(step === 'result' || step === 'saved') && (
          <div className="space-y-4">
            {(
              <div className="glass rounded-3xl p-5 space-y-3">
                <p className="text-sm font-bold text-foreground">{METRIC_INFO[metric].name}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: '지난번 마무리', m: lastSession?.performance ?? null },
                    { label: '오늘 시작', m: retention },
                    { label: '오늘 마무리', m: performance },
                  ].map(({ label, m }) => (
                    <div key={label} className="rounded-2xl bg-card px-2 py-3">
                      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                      <p className="text-lg font-black tabular-nums text-foreground">{fmt(metric, m)}</p>
                      <p className="text-[10px] text-muted-foreground">{metric === 'jitter' ? '%' : METRIC_INFO[metric].unit}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {metric === 'jitter'
                    ? `기준 ${JITTER_LIMIT[performance?.jitter_source ?? retention?.jitter_source ?? 'praat']}% 이하`
                    : metric === 'pace'
                      ? `기준 1초에 ${PACE_RANGE.min}~${PACE_RANGE.max}글자`
                      : metric === 'clarity'
                        ? `기준 알아들은 글자 ${CLARITY_MIN}% 이상`
                        : diagnosisMeasures?.some((d) => d.level === 1)
                          ? `기준: 진단 때 허밍보다 ${SMALL_VOICE_DROP_DB}dB 넘게 작아지지 않기`
                          : `기준: 진단 때보다 ${LOUDNESS_TOLERANCE_DB}dB 넘게 작아지지 않기`}
                </p>
              </div>
            )}

            <div className="glass rounded-3xl p-5 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground">지난번 연습 효과가 오늘도 이어졌나</p>
              <p className="text-sm text-foreground leading-relaxed">{retentionCopy(verdict)}</p>
            </div>

            <div className="glass rounded-3xl p-5 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground">오늘 결과와 다음 단계</p>
              <p className="text-sm text-foreground leading-relaxed">{performanceCopy(met, next, current, judgedLabel)}</p>
              {judged.measure && (metric !== 'clarity' || judged.measure.clarity_pct != null) && (
                <p className="text-[12px] text-muted-foreground tabular-nums">
                  {judged.on === 'challenge' ? `도전 ${rungs.b}단계` : '마무리 녹음'}: {fmt(metric, judged.measure)}{metric === 'jitter' ? '%' : ` ${METRIC_INFO[metric].unit}`}
                  {judged.on === 'final' && metric === 'pace' ? ' (1, 2단계는 글자가 없어 마무리 녹음으로 판정해요)' : ''}
                </p>
              )}
              {pain && <p className="text-[13px] text-caution">통증이 있었어요. 오늘은 여기까지 하고, 내일도 아프면 쉬어 가세요.</p>}
            </div>

            {saveError && <p className="text-[13px] text-destructive" role="alert">{saveError}</p>}
            {step === 'result' ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-14 rounded-full bg-primary text-primary-foreground text-[16px] font-bold active:scale-95 transition-transform disabled:opacity-70"
              >
                {saving ? '저장 중…' : '기록하고 마치기'}
              </button>
            ) : (
              <button
                onClick={() => router.push('/training/track')}
                className="w-full h-14 rounded-full border-2 border-border bg-card text-foreground text-[16px] font-bold active:scale-95 transition-transform"
              >
                트랙으로 돌아가기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
