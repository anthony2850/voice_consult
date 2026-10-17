'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTrack } from '@/hooks/useTrack'
import { SCENE_SCRIPTS, TRACKS, getRung, type RungLevel } from '@/lib/curriculum'
import {
  METRIC_INFO, allowStrongVariations, meetsCriterion, metricValue, nextRung, performanceCopy,
  pickVariation, retentionCopy, retentionVerdict, sessionRungs, type Measure, type VoiceUse,
} from '@/lib/trainingCycle'
import { measureBlob } from '@/lib/trainingMeasure'
import RecordStep from '@/components/training/RecordStep'
import { trackEvent } from '@/lib/analytics'

type Step = 'status' | 'retention' | 'exerciseA' | 'exerciseB' | 'performance' | 'selfJudge' | 'cost' | 'result' | 'saved'

const STEP_ORDER: Step[] = ['status', 'retention', 'exerciseA', 'exerciseB', 'performance', 'selfJudge', 'cost', 'result']

const VOICE_USE_OPTIONS: { value: VoiceUse; label: string; hint: string }[] = [
  { value: 'low', label: '거의 안 썼어요', hint: '조용한 하루' },
  { value: 'normal', label: '보통이에요', hint: '평소만큼' },
  { value: 'high', label: '많이 썼어요', hint: '회의·강의·노래' },
]

function fmt(metric: keyof typeof METRIC_INFO, m: Measure | null): string {
  if (!m) return '—'
  const v = metricValue(metric, m)
  return metric === 'jitter' ? v.toFixed(2) : v.toFixed(1)
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
  const current: RungLevel = profile.trackRung ?? 1
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
      trackEvent('training_session_completed', {
        concern: track!.concern, rung: current, next_rung: next, met: met ?? 'na', effort, pain, verdict,
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
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <p className="text-white/80 text-xs mb-1">{track.emoji} {track.label} 트랙 · {sessionIndex + 1}번째 세션</p>
          <h1 className="text-xl font-black text-white">{current}단계 · {getRung(current).title}</h1>
          <p className="text-white/80 text-xs mt-2">{track.keyInfo}</p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/training')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} />나가기
          </button>
          {step !== 'saved' && (
            <p className="text-xs font-semibold text-muted-foreground tabular-nums">{stepNo} / {stepTotal}</p>
          )}
        </div>
        {failNote && <p className="text-xs text-red-500 px-1">{failNote}</p>}

        {step === 'status' && (
          <div className="glass rounded-3xl p-6 space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">오늘 상태</p>
              <p className="text-base font-bold text-foreground">오늘 목을 얼마나 썼나요?</p>
              <p className="text-xs text-muted-foreground mt-1">결과를 읽을 때 같이 봐요. 피곤한 날의 낮은 값은 학습 실패가 아니에요.</p>
            </div>
            <div className="space-y-2">
              {VOICE_USE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => { setVoiceUse(o.value); trackEvent('training_session_started', { concern: track.concern, rung: current, voice_use: o.value }); advance('status') }}
                  className="w-full flex items-center justify-between rounded-2xl bg-secondary/60 hover:bg-secondary px-4 py-3 text-left active:scale-[0.98] transition-all"
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
            title={sessionIndex === 0 ? '기준 문장을 평소대로 한 번' : '지난 세션의 문장을 그대로 한 번'}
            instructions={['연습 전에 평소처럼 한 번만 읽어요.', '지난번 마무리 녹음과 비교해서, 연습한 게 남아 있는지 봐요.']}
            script={baseScript}
            maxSec={12}
            analyzing={analyzing}
            onRecorded={(b) => measureOrRetry(b, 4, (m) => { setRetention(m); advance('retention') })}
            silentNote="점수는 보여주지 않아요"
          />
        )}

        {step === 'exerciseA' && (() => {
          const r = getRung(rungs.a)
          return (
            <RecordStep
              key={`a-${r.id}`}
              eyebrow={`연습 1 · ${rungs.a}단계 (몸 풀기)`}
              title={r.title}
              keyInfo={track.keyInfo}
              instructions={r.instructions}
              variation={variation}
              script={r.script(scene, sessionIndex)}
              scriptLabel={r.scriptLabel}
              lastWord={track.lastWord}
              maxSec={r.maxSec}
              targetSec={r.targetSec}
              prepSec={r.prepSec}
              analyzing={analyzing}
              onRecorded={(b) => measureOrRetry(b, rungs.a, (m) => { setRungMeasures((x) => [...x, m]); advance('exerciseA') })}
              doneLabel="저장하고 다음"
            />
          )
        })()}

        {step === 'exerciseB' && (() => {
          const r = getRung(rungs.b)
          return (
            <RecordStep
              key={`b-${r.id}`}
              eyebrow={`연습 2 · ${rungs.b}단계 (도전)`}
              title={r.title}
              keyInfo={track.keyInfo}
              instructions={r.instructions}
              variation={variation}
              script={r.script(scene, sessionIndex)}
              scriptLabel={r.scriptLabel}
              lastWord={track.lastWord}
              maxSec={r.maxSec}
              targetSec={r.targetSec}
              prepSec={r.prepSec}
              analyzing={analyzing}
              onRecorded={(b) => measureOrRetry(b, rungs.b, (m) => { setRungMeasures((x) => [...x, m]); advance('exerciseB') })}
              doneLabel="저장하고 다음"
            />
          )
        })()}

        {step === 'performance' && (
          <RecordStep
            eyebrow="마무리 녹음"
            title="기준 문장을 다시 한 번"
            keyInfo={track.keyInfo}
            instructions={['시작 녹음과 같은 문장이에요.', '연습한 뒤의 목소리를 기록해요. 다음 세션 시작 녹음과 비교할 거예요.']}
            script={baseScript}
            lastWord={track.lastWord}
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
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">직접 들어 보기</p>
              <p className="text-base font-bold text-foreground">{track.keyInfo}</p>
              <p className="text-xs text-muted-foreground mt-1">발음은 앱이 잴 수 없어서 직접 들어 보고 판단해요.</p>
            </div>
            {performanceUrl && <audio controls src={performanceUrl} className="w-full h-10" />}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setSelfOk(true); advance('selfJudge') }} className="h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-sm font-bold text-emerald-600">네, 다 들렸어요</button>
              <button onClick={() => { setSelfOk(false); advance('selfJudge') }} className="h-12 rounded-2xl bg-secondary/60 text-sm font-bold text-foreground">아니요, 뭉개진 데가 있어요</button>
            </div>
          </div>
        )}

        {step === 'cost' && (
          <div className="glass rounded-3xl p-6 space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">목 상태</p>
              <p className="text-base font-bold text-foreground">방금 말할 때 목이 얼마나 힘들었나요?</p>
              <p className="text-xs text-muted-foreground mt-1">소리가 좋았어도 목이 힘들었다면 다음 단계로 올라가지 않아요.</p>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setEffort(n)}
                  className={`h-12 rounded-xl text-sm font-bold transition-all ${effort === n ? 'gradient-primary text-white' : 'bg-secondary/60 text-foreground'}`}
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
              className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 text-left ${pain ? 'bg-red-500/10 border border-red-500/40' : 'bg-secondary/60'}`}
            >
              <span className="text-sm font-semibold text-foreground">목에 통증이나 따끔함이 있었어요</span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pain ? 'border-red-500 bg-red-500' : 'border-border'}`}>
                {pain && <span className="text-white text-[10px]">✓</span>}
              </span>
            </button>
            <button
              disabled={!effort}
              onClick={() => advance('cost')}
              className="w-full h-12 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
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
                    <div key={label} className="rounded-2xl bg-secondary/60 px-2 py-3">
                      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                      <p className="text-lg font-black tabular-nums text-foreground">{fmt(metric, m)}</p>
                      <p className="text-[10px] text-muted-foreground">{METRIC_INFO[metric].unit}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {metric === 'jitter' ? '1.00 이하면 떨림이 괜찮은 범위예요. 낮을수록 고른 목소리예요.' : metric === 'pace' ? '2.5~5.5가 듣기 편한 빠르기예요.' : '진단 때보다 2dB 넘게 작아지지 않았으면 유지한 거예요.'}
                  {' '}오늘 마무리가 좋아진 건 방금 연습한 효과일 수 있어요. 진짜 실력은 다음 세션의 시작 녹음에서 보여요.
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
              {pain && <p className="text-xs text-red-500">통증이 있었어요. 오늘은 여기까지 하고, 내일도 아프면 쉬어 가세요.</p>}
            </div>

            {step === 'result' ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-70"
              >
                {saving ? '저장 중…' : '기록하고 마치기'}
              </button>
            ) : (
              <button
                onClick={() => router.push('/training')}
                className="w-full h-12 rounded-2xl bg-secondary text-foreground text-sm font-bold active:scale-95 transition-transform"
              >
                훈련 홈으로
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
