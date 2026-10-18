'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTrack } from '@/hooks/useTrack'
import {
  CONCERN_LABELS, CONCERN_ORDER, DIAGNOSIS_LEVELS, SCENE_LABELS, SCENE_ORDER, TRACKS, getRung,
  type ConcernSlug, type RungLevel, type Scene,
} from '@/lib/curriculum'
import {
  startRungFromBoundary, suggestConcernsFromDiagnosis, type DiagnosisSuggestion, type Measure,
} from '@/lib/trainingCycle'
import { measureBlob } from '@/lib/trainingMeasure'
import RecordStep from '@/components/training/RecordStep'
import { trackEvent } from '@/lib/analytics'

type Phase = 'intro' | 'climb' | 'choose' | 'saving'

export default function DiagnoseClient() {
  const router = useRouter()
  const params = useSearchParams()
  const { loading, profile, startTrack, insertSession } = useTrack()
  // 트랙 전환에서 왔으면 바꾸려는 상황·고민이 쿼리로 온다. 진단을 마쳐야 트랙이 바뀐다.
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

  // 장면이 없으면 새 트랙 화면에서 고르게 한다.
  useEffect(() => {
    if (!loading && !targetScene) router.replace('/training/start')
  }, [loading, targetScene, router])

  const suggestions = useMemo<DiagnosisSuggestion[]>(
    () => (phase === 'choose' || phase === 'saving' ? suggestConcernsFromDiagnosis(measures) : []),
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
      const m = await measureBlob(blob, level)
      if (!m) {
        setFailNote('소리가 잘 잡히지 않았어요. 마이크에 조금 더 가까이에서 다시 녹음해 주세요.')
        return
      }
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

  async function handleConfirm() {
    if (!picked) return
    setPhase('saving')
    const s = suggestions.find((x) => x.concern === picked)
    const track = TRACKS[picked]
    const startRung: RungLevel = track.metric === 'self' ? 4 : startRungFromBoundary(s?.boundary ?? null)
    const baseline = measures.find((m) => m.level === 4) ?? null
    const ok = await startTrack({ concern: picked, rung: startRung, baseline, scene })
    if (ok) {
      await insertSession({
        kind: 'diagnosis', concern: picked, scene, rung: startRung, session_index: 0,
        voice_use: null, variation_id: null, retention: null, performance: null,
        rung_measures: measures, effort: null, pain: false, met_criterion: null, next_rung: startRung,
      })
      trackEvent('diagnosis_completed', { concern: picked, start_rung: startRung, boundary: s?.boundary ?? 'none' })
      router.replace('/training/track')
    } else {
      setPhase('choose')
    }
  }

  return (
    <div className="min-h-[calc(100vh-84px)]">
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <p className="text-white/80 text-xs mb-1">진단</p>
          <h1 className="text-xl font-black text-white">어디서부터 어려워지는지 찾아요</h1>
          <p className="text-white/80 text-xs mt-2 leading-relaxed">
            쉬운 소리부터 실제 문장까지 4번 녹음해요. 점수는 보여주지 않고, 끝나면 연습할 고민을 추천해요.
          </p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/training')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} />나가기
          </button>
          {phase === 'climb' && (
            <p className="text-xs font-semibold text-muted-foreground tabular-nums">{levelIdx + 1} / {DIAGNOSIS_LEVELS.length}</p>
          )}
        </div>

        {phase === 'intro' && (
          <div className="glass rounded-3xl p-6 space-y-4">
            <p className="text-base font-bold text-foreground">4번 녹음해요. 점점 실제 말하기에 가까워져요</p>
            <ol className="space-y-1.5">
              {DIAGNOSIS_LEVELS.map((l) => {
                const r = getRung(l)
                return <li key={l} className="text-sm text-foreground">• {l}단계 {r.title} <span className="text-muted-foreground">— {r.adds}</span></li>
              })}
            </ol>
            <p className="text-xs text-foreground">
              {SCENE_LABELS[scene].emoji} <span className="font-semibold">{SCENE_LABELS[scene].label}</span> 문장으로 재요.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              잘하려고 애쓰지 않아도 돼요. 평소 그대로가 가장 정확한 진단이에요. 조용한 곳에서, 마이크에서 한 뼘 정도 떨어져 주세요.
            </p>
            <button
              onClick={() => { trackEvent('diagnosis_started', { scene }); setPhase('climb') }}
              className="w-full h-12 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform"
            >
              시작
            </button>
          </div>
        )}

        {phase === 'climb' && (
          <>
            {failNote && <p className="text-xs text-red-500 px-1">{failNote}</p>}
            <RecordStep
              key={rung.id}
              eyebrow={`${level}단계`}
              title={rung.title}
              instructions={rung.instructions}
              script={rung.script(scene, 0)}
              scriptLabel={rung.scriptLabel}
              maxSec={rung.maxSec}
              targetSec={rung.targetSec}
              analyzing={analyzing}
              onRecorded={handleRecorded}
              doneLabel={levelIdx + 1 < DIAGNOSIS_LEVELS.length ? '다음 녹음' : '진단 결과 보기'}
              silentNote="점수는 보여주지 않아요"
            />
          </>
        )}

        {(phase === 'choose' || phase === 'saving') && (
          <div className="space-y-4">
            <div className="glass rounded-3xl p-5 space-y-1">
              <p className="text-sm font-bold text-foreground">이 트랙에서 집중할 고민을 하나 골라요</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                녹음에서 먼저 드러난 순서로 놓았어요. 한 번에 하나만 집중해서 연습해요. 나중에 다른 고민으로 바꿀 수 있어요.
              </p>
            </div>
            <div className="space-y-2">
              {suggestions.map((s, i) => {
                const t = TRACKS[s.concern]
                const sel = picked === s.concern
                return (
                  <button
                    key={s.concern}
                    disabled={phase === 'saving'}
                    onClick={() => setPicked(s.concern)}
                    className={`w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98] ${
                      sel ? 'bg-primary/15 border border-primary/50' : 'glass'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{t.emoji}</span>
                      <p className="text-sm font-bold text-foreground">{CONCERN_LABELS[s.concern]}</p>
                      {i === 0 && s.boundary !== null && (
                        <span className="ml-auto text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">제안</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
                    {s.boundary !== null && (
                      <p className="text-[11px] text-foreground mt-1">여기서 시작해요: {s.boundary}단계 {getRung(s.boundary).title}</p>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              disabled={!picked || phase === 'saving'}
              onClick={handleConfirm}
              className="w-full h-12 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
            >
              {phase === 'saving' ? '저장 중…' : '이 고민으로 트랙 시작'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
