'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTrack } from '@/hooks/useTrack'
import { SCENE_LABELS, SCENE_SCRIPTS, TRACKS, getRung, type RungLevel } from '@/lib/curriculum'
import {
  METRIC_INFO, allowStrongVariations, meetsCriterion, metricValue, nextRung, performanceCopy,
  JITTER_LIMIT, LOUDNESS_TOLERANCE_DB, PACE_RANGE, pickVariation, retentionCopy, retentionVerdict, rungReason, sessionRungs, type Measure, type VoiceUse,
} from '@/lib/trainingCycle'
import { measureBlob } from '@/lib/trainingMeasure'
import RecordStep from '@/components/training/RecordStep'
import RungComplete from '@/components/training/RungComplete'
import { trackEvent } from '@/lib/analytics'
import { PageHeader, Pill } from '@/components/ds'

type Step = 'status' | 'retention' | 'exerciseA' | 'exerciseB' | 'performance' | 'selfJudge' | 'cost' | 'result' | 'saved'

const STEP_ORDER: Step[] = ['status', 'retention', 'exerciseA', 'exerciseB', 'performance', 'selfJudge', 'cost', 'result']

const VOICE_USE_OPTIONS: { value: VoiceUse; label: string; hint: string }[] = [
  { value: 'low', label: '거의 안 썼어요', hint: '조용한 하루' },
  { value: 'normal', label: '보통이에요', hint: '평소만큼' },
  { value: 'high', label: '많이 썼어요', hint: '회의, 강의, 노래' },
]

function fmt(metric: keyof typeof METRIC_INFO, m: Measure | null): string {
  if (!m) return '—'
  // 떨림은 기준과 같은 단위(%)로 보여 준다. metricValue는 기준으로 나눈 비율이다.
  if (metric === 'jitter') return m.jitter_rel_pct.toFixed(1)
  return metricValue(metric, m).toFixed(1)
}

export default function SessionClient() {
  const router = useRouter()
  const { loading, profile, trackSessions, insertSession, setTrackRung } = useTrack()

  const [step, setStep] = useState<Step>('status')
  const [voiceUse, setVoiceUse] = useState<VoiceUse | null>(null)
  const [retention, setRetention] = useState<Measure | null>(null)
  const [rungMeasures, setRungMeasures] = useState<Measure[]>([])
  const [performance, setPerformance] = useState<Measure | null>(null)
  const [performanceUrl, setPerformanceUrl] = useState<string | null>(null)
  const [selfOk, setSelfOk] = useState<boolean | null>(null)
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [pain, setPain] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [failNote, setFailNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !profile.trackConcern) router.replace('/training')
  }, [loading, profile.trackConcern, router])

  useEffect(() => () => { if (performanceUrl) URL.revokeObjectURL(performanceUrl) }, [performanceUrl])

  const track = profile.trackConcern ? TRACKS[profile.trackConcern] : null
  // 세션을 시작한 단계로 고정한다. 저장하면서 트랙 단계가 올라가도 이 세션의 결과 문구와 제목은 그대로여야 한다.
  const startRung = useRef<RungLevel | null>(null)
  if (!loading && startRung.current == null && profile.trackRung != null) startRung.current = profile.trackRung
  const current: RungLevel = startRung.current ?? profile.trackRung ?? 1
  const [rungDone, setRungDone] = useState<{ from: RungLevel; to: RungLevel } | null>(null)
  const scene = profile.scene ?? 'daily'
  const sessionIndex = trackSessions.length
  const lastSession = trackSessions[0] ?? null
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
    if (STEP_ORDER[i] === 'selfJudge' && metric !== 'self') i += 1
    setStep(STEP_ORDER[i])
  }

  async function measureOrRetry(blob: Blob, level: RungLevel | undefined, onOk: (m: Measure) => void) {
    setAnalyzing(true)
    setFailNote(null)
    try {
      const m = await measureBlob(blob, level)
      if (!m) {
        setFailNote('소리가 잘 잡히지 않았어요. 마이크에 조금 더 가까이에서 다시 녹음해 주세요.')
        return
      }
      onOk(m)
    } finally {
      setAnalyzing(false)
    }
  }

  // ── 판정 (result 단계에서 계산) ─────────────────────────────────────────────
  const met = performance ? meetsCriterion(metric, performance, profile.baseline, selfOk) : null
  const next = effort ? nextRung(current, { met, effort, pain }) : current
  const verdict = retentionVerdict(metric, lastSession?.performance ?? null, retention)

  async function handleSave() {
    if (!effort) return
    setSaving(true)
    try {
      const ok = await insertSession({
        kind: 'session', concern: track!.concern, scene, rung: current, session_index: sessionIndex + 1,
        voice_use: voiceUse, variation_id: variation!.id,
        retention, performance, rung_measures: rungMeasures,
        effort, pain, met_criterion: met, next_rung: next,
      })
      if (ok && next !== current) await setTrackRung(next)
      if (ok && next > current) setRungDone({ from: current, to: next })
      // 힘든 정도와 통증은 건강 관련 자가 응답이라 분석 도구(GA, Meta)로 보내지 않는다. DB에만 저장.
      trackEvent('training_session_completed', {
        concern: track!.concern, rung: current, next_rung: next, met: met ?? 'na', verdict,
      })
      setStep('saved')
    } finally {
      setSaving(false)
    }
  }

  const stepNo = Math.max(1, STEP_ORDER.indexOf(step) + 1 - (metric !== 'self' && STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf('selfJudge') ? 1 : 0))
  const stepTotal = metric === 'self' ? 8 : 7

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

        {step === 'status' && (
          <p className="rounded-2xl border-2 border-accent/15 px-4 py-3 text-[14px] font-semibold text-foreground leading-relaxed" role="status">
            {rungReason(track.concern, current, lastSession)}
          </p>
        )}

        {step === 'status' && (
          <div className="glass rounded-3xl p-6 space-y-4">
            <div>
              <p className="eyebrow">오늘 상태</p>
              <p className="text-base font-bold text-foreground">오늘 목을 얼마나 썼나요?</p>
            </div>
            <div className="space-y-2">
              {VOICE_USE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => { setVoiceUse(o.value); trackEvent('training_session_started', { concern: track.concern, rung: current, voice_use: o.value }); advance('status') }}
                  className="w-full flex items-center justify-between rounded-2xl bg-card hover:bg-card/80 px-4 py-3 text-left active:scale-[0.98] transition-all"
                >
                  <span className="text-sm font-semibold text-foreground">{o.label}</span>
                  <span className="text-[11px] text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'retention' && (
          <RecordStep
            eyebrow="시작 녹음"
            title="평소대로 한 번 읽어요"
            instructions={[]}
            script={baseScript}
            maxSec={12}
            analyzing={analyzing}
            onRecorded={(b) => measureOrRetry(b, 4, (m) => { setRetention(m); advance('retention') })}
          />
        )}

        {step === 'exerciseA' && (() => {
          const r = getRung(rungs.a)
          return (
            <RecordStep
              key={`a-${r.id}`}
              eyebrow={`몸 풀기, ${rungs.a}단계`}
              title={r.title}
              keyInfo={track.keyInfo}
              instructions={r.practiceHint ? [r.practiceHint] : []}
              variation={variation}
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
              eyebrow={`도전, ${rungs.b}단계`}
              title={r.title}
              keyInfo={track.keyInfo}
              instructions={r.practiceHint ? [r.practiceHint] : []}
              variation={variation}
              script={r.script(scene, sessionIndex)}
              scriptLabel={r.scriptLabel}
              maxSec={r.maxSec}
              targetSec={r.targetSec}
              prepSec={r.prepSec}
              analyzing={analyzing}
              onRecorded={(b) => measureOrRetry(b, rungs.b, (m) => { setRungMeasures((x) => [...x, m]); advance('exerciseB') })}
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
            onRecorded={(b) => {
              if (metric === 'self') setPerformanceUrl(URL.createObjectURL(b))
              measureOrRetry(b, 4, (m) => { setPerformance(m); advance('performance') })
            }}
            doneLabel="저장하고 다음"
          />
        )}

        {step === 'selfJudge' && (
          <div className="glass rounded-3xl p-6 space-y-4">
            <div>
              <p className="eyebrow">직접 들어 보기</p>
              <p className="text-base font-bold text-foreground">{track.keyInfo}</p>
              <p className="text-xs text-muted-foreground mt-1">녹음을 듣고 골라 주세요.</p>
            </div>
            {performanceUrl && <audio controls src={performanceUrl} className="w-full h-10" />}
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
            {metric !== 'self' && (
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
                      : `기준: 진단 때보다 ${LOUDNESS_TOLERANCE_DB}dB 넘게 작아지지 않기`}
                </p>
              </div>
            )}

            <div className="glass rounded-3xl p-5 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground">지난번 연습이 남아 있었나</p>
              <p className="text-sm text-foreground leading-relaxed">{retentionCopy(verdict, voiceUse ?? 'normal')}</p>
            </div>

            <div className="glass rounded-3xl p-5 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground">오늘 결과와 다음 단계</p>
              <p className="text-sm text-foreground leading-relaxed">{performanceCopy(met, next, current)}</p>
              {pain && <p className="text-[13px] text-caution">통증이 있었어요. 오늘은 여기까지 하고, 내일도 아프면 쉬어 가세요.</p>}
            </div>

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
