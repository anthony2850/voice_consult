'use client'

import { useEffect, useState, useRef } from 'react'
import { Play, Pause, ArrowDown, Mic, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getBeforeAndAfter, VoiceRecord, VoiceEmotion } from '@/lib/voiceDB'

// ── 감정 한국어 레이블 ──────────────────────────────────────
const EMOTION_KO: Record<string, string> = {
  Admiration: '감탄', Adoration: '경애', 'Aesthetic Appreciation': '미적 감상',
  Amusement: '즐거움', Anger: '분노', Anxiety: '불안', Awe: '경외감',
  Awkwardness: '어색함', Boredom: '지루함', Calmness: '차분함',
  Concentration: '집중', Confusion: '혼란', Contemplation: '사색',
  Contempt: '경멸', Contentment: '만족감', Craving: '갈망', Desire: '욕망',
  Determination: '결단력', Disappointment: '실망', Disgust: '혐오',
  Distress: '고통', Doubt: '의심', Ecstasy: '황홀감', Embarrassment: '당혹감',
  'Empathic Pain': '공감적 아픔', Enthusiasm: '열정', Entrancement: '매혹',
  Envy: '질투', Excitement: '흥분', Fear: '두려움', Guilt: '죄책감',
  Horror: '공포', Interest: '호기심', Joy: '기쁨', Love: '사랑',
  Nostalgia: '향수', Pain: '통증', Pride: '자부심', Realization: '깨달음',
  Relief: '안도', Romance: '낭만', Sadness: '슬픔', Satisfaction: '성취감',
  Shame: '수치심', 'Surprise (negative)': '놀람 (부정)',
  'Surprise (positive)': '놀람 (긍정)', Sympathy: '공감',
  Tiredness: '피로감', Triumph: '승리감',
}

// ── 오디오 플레이어 ─────────────────────────────────────────
function AudioPlayer({ blob, label }: { blob: Blob; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
    }
    const onEnd = () => { setPlaying(false); setProgress(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnd)
    }
  }, [url])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }

  return (
    <div className="flex items-center gap-2.5">
      {url && <audio ref={audioRef} src={url} preload="metadata" className="hidden" />}
      <button
        onClick={toggle}
        aria-label={playing ? '일시정지' : `${label} 듣기`}
        className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30 active:scale-90 transition-transform"
      >
        {playing
          ? <Pause size={14} className="text-white fill-white" />
          : <Play size={14} className="text-white fill-white ml-0.5" />
        }
      </button>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full gradient-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── 감정 미니 바 ────────────────────────────────────────────
function EmotionMiniBar({ emotion, maxScore }: { emotion: VoiceEmotion; maxScore: number }) {
  const pct = Math.round((emotion.score / maxScore) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-14 shrink-0 truncate">
        {EMOTION_KO[emotion.name] ?? emotion.name}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full gradient-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-primary tabular-nums w-8 text-right">
        {(emotion.score * 100).toFixed(0)}%
      </span>
    </div>
  )
}

// ── 수치 변화 아이콘 ────────────────────────────────────────
function DeltaIcon({ delta }: { delta: number; higherIsBetter?: boolean }) {
  if (Math.abs(delta) < 0.01) return <Minus size={10} className="text-muted-foreground" />
  return delta > 0
    ? <TrendingUp size={10} className="text-emerald-600" />
    : <TrendingDown size={10} className="text-rose-600" />
}

// ── 변화 수치 뱃지 ───────────────────────────────────────────
function DeltaBadge({ before, after, unit = '', digits = 1 }: {
  before: number
  after: number
  unit?: string
  digits?: number
}) {
  const delta = after - before
  const sign = delta > 0 ? '+' : ''
  const color = Math.abs(delta) < 0.01 ? 'text-muted-foreground' : delta > 0 ? 'text-emerald-600' : 'text-rose-600'
  return (
    <span className={`text-[10px] font-semibold tabular-nums ${color}`}>
      {sign}{delta.toFixed(digits)}{unit}
    </span>
  )
}

// ── 단일 기록 카드 ──────────────────────────────────────────
function RecordCard({
  record,
  label,
  accent,
}: {
  record: VoiceRecord
  label: '첫 번째 목소리' | '최근 목소리'
  accent: 'violet' | 'indigo'
}) {
  const emotions = record.analysisData.emotions ?? []
  const features = record.analysisData.audioFeatures
  const maxScore = emotions[0]?.score ?? 1

  const accentClass = accent === 'violet'
    ? 'bg-violet-100 text-violet-700 border-violet-300'
    : 'bg-indigo-100 text-indigo-700 border-indigo-300'

  return (
    <div className="glass rounded-3xl overflow-hidden">
      {/* 카드 헤더 */}
      <div className={`px-4 pt-4 pb-3 border-b border-border/50 ${accent === 'violet' ? 'bg-violet-50' : 'bg-indigo-50'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${accentClass}`}>
            {label}
          </span>
        </div>
        <p className="text-sm font-bold text-foreground">{record.date}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* 오디오 플레이어 */}
        <AudioPlayer blob={record.audioBlob} label={label} />

        {/* 감정 Top 3 */}
        {emotions.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2">감정 Top 3</p>
            <div className="space-y-1.5">
              {emotions.slice(0, 3).map((e) => (
                <EmotionMiniBar key={e.name} emotion={e} maxScore={maxScore} />
              ))}
            </div>
          </div>
        )}

        {/* 음성 주요 지표 */}
        {features && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2">음성 지표</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: '평균 피치', value: features.pitch.mean_hz.toFixed(0), unit: 'Hz' },
                { label: '평균 음량', value: features.energy.db_mean.toFixed(1), unit: 'dB' },
                { label: 'Jitter', value: features.voice_quality.jitter_rel_pct.toFixed(2), unit: '%' },
                { label: 'Shimmer', value: features.voice_quality.shimmer_rel_pct.toFixed(2), unit: '%' },
                { label: '발화 속도', value: features.rhythm.onsets_per_second.toFixed(1), unit: '/초' },
                { label: '리듬 (BPM)', value: features.rhythm.tempo_bpm.toFixed(0), unit: '' },
              ].map(({ label, value, unit }) => (
                <div key={label} className="bg-secondary/50 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                  <p className="text-xs font-bold text-foreground tabular-nums">
                    {value}<span className="text-[9px] font-normal text-muted-foreground ml-0.5">{unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 변화 비교 테이블 ────────────────────────────────────────
function ChangeSummary({ before, after }: { before: VoiceRecord; after: VoiceRecord }) {
  const bf = before.analysisData.audioFeatures
  const af = after.analysisData.audioFeatures
  if (!bf || !af) return null

  const rows = [
    { label: '평균 피치', b: bf.pitch.mean_hz, a: af.pitch.mean_hz, unit: 'Hz', digits: 0 },
    { label: '평균 음량', b: bf.energy.db_mean, a: af.energy.db_mean, unit: 'dB', digits: 1 },
    { label: 'Jitter', b: bf.voice_quality.jitter_rel_pct, a: af.voice_quality.jitter_rel_pct, unit: '%', digits: 2 },
    { label: 'Shimmer', b: bf.voice_quality.shimmer_rel_pct, a: af.voice_quality.shimmer_rel_pct, unit: '%', digits: 2 },
    { label: '발화 속도', b: bf.rhythm.onsets_per_second, a: af.rhythm.onsets_per_second, unit: '/초', digits: 1 },
  ]

  return (
    <div className="glass rounded-3xl p-4">
      <p className="text-xs font-bold text-foreground mb-3">지표 변화 요약</p>
      <div className="space-y-0">
        {rows.map(({ label, b, a, unit, digits }) => (
          <div key={label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {b.toFixed(digits)}{unit}
              </span>
              <DeltaIcon delta={a - b} />
              <DeltaBadge before={b} after={a} unit={unit} digits={digits} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 빈 상태 ─────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-secondary/60 flex items-center justify-center mx-auto mb-4">
        <Mic size={24} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-bold text-foreground mb-1">아직 저장된 목소리가 없어요</p>
      <p className="text-xs text-muted-foreground">
        목소리를 분석하면 이곳에서 변화를 비교할 수 있어요
      </p>
    </div>
  )
}

// ── 단일 기록 상태 ──────────────────────────────────────────
function SingleRecordState({ record }: { record: VoiceRecord }) {
  return (
    <div className="space-y-4">
      <RecordCard record={record} label="첫 번째 목소리" accent="violet" />
      <div className="glass rounded-3xl p-4 text-center border border-dashed border-border">
        <p className="text-xs text-muted-foreground">
          다음 분석 후 <span className="text-primary font-semibold">Before vs After</span> 비교가 가능해요
        </p>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ───────────────────────────────────────────
/**
 * IndexedDB에서 첫 번째 기록(Before)과 최근 기록(After)을 불러와
 * 나란히 비교하는 대시보드 컴포넌트.
 *
 * 회원가입 없이 브라우저 로컬(IndexedDB)만으로 동작합니다.
 */
export default function VoiceCompare() {
  const [before, setBefore] = useState<VoiceRecord | null>(null)
  const [after, setAfter] = useState<VoiceRecord | null>(null)
  const [status, setStatus] = useState<'loading' | 'empty' | 'single' | 'compare'>('loading')

  useEffect(() => {
    getBeforeAndAfter().then(({ before: b, after: a }) => {
      setBefore(b)
      setAfter(a)
      if (!b) setStatus('empty')
      else if (!a) setStatus('single')
      else setStatus('compare')
    })
  }, [])

  return (
    <div className="space-y-4">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shrink-0">
          <Mic size={14} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">목소리 변화 비교</h2>
          {status === 'compare' && before && after && (
            <p className="text-[10px] text-muted-foreground">
              {before.date} → {after.date}
            </p>
          )}
        </div>
      </div>

      {/* 로딩 */}
      {status === 'loading' && (
        <div className="glass rounded-3xl p-8 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground mt-3">불러오는 중...</p>
        </div>
      )}

      {/* 기록 없음 */}
      {status === 'empty' && <EmptyState />}

      {/* 기록 1개 */}
      {status === 'single' && before && <SingleRecordState record={before} />}

      {/* Before vs After 비교 */}
      {status === 'compare' && before && after && (
        <>
          {/* Before 카드 */}
          <RecordCard record={before} label="첫 번째 목소리" accent="violet" />

          {/* VS 구분자 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <div className="flex flex-col items-center gap-0.5">
              <ArrowDown size={16} className="text-primary" />
              <span className="text-[10px] font-bold text-primary">변화</span>
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* After 카드 */}
          <RecordCard record={after} label="최근 목소리" accent="indigo" />

          {/* 변화 요약 테이블 */}
          <ChangeSummary before={before} after={after} />
        </>
      )}
    </div>
  )
}
