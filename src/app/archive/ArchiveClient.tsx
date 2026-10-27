'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, ChevronLeft, Dumbbell, Mic, Search, TrendingUp } from 'lucide-react'
import { PageHeader, Pill, PrimaryButton } from '@/components/ds'
import { useTrack, type TrainingSessionRow } from '@/hooks/useTrack'
import { SCENE_LABELS, TRACKS, getRung, type Metric } from '@/lib/curriculum'
import { loudnessFloor } from '@/lib/trainingCycle'
import {
  TREND_MIN_SESSIONS, JITTER_NOTE, formatMetric, targetBand, trendCopy, trendVerdict, weeklyTrend,
  type WeekPoint,
} from '@/lib/trainingTrend'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Returns [월~일] date strings for the week containing referenceDate */
function getWeekDates(referenceDate: Date): string[] {
  const dow = referenceDate.getDay()
  const monday = new Date(referenceDate)
  monday.setDate(referenceDate.getDate() + (dow === 0 ? -6 : 1 - dow))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toDateStr(d)
  })
}

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']

const METRIC_LABEL: Record<Metric, { title: string; unit: string; band: string }> = {
  jitter: { title: '목소리 떨림', unit: '', band: '1.00 이하가 목표' },
  pace: { title: '말 빠르기', unit: '글자/초', band: '2.5~5.5가 목표' },
  loudness: { title: '목소리 크기', unit: 'dB', band: '진단 때 허밍 −4dB 이상이 목표' },
  clarity: { title: '알아들은 글자 비율', unit: '%', band: '95% 이상이 목표' },
}

// ─── Trend chart ──────────────────────────────────────────────────────────────
const CW = 320, CH = 150
const PAD = { l: 34, r: 10, t: 12, b: 26 }
const PW = CW - PAD.l - PAD.r
const PH = CH - PAD.t - PAD.b

function TrendChart({ metric, points, loudFloor }: { metric: Metric; points: WeekPoint[]; loudFloor: number }) {
  const values = points.flatMap((p) => [p.start, p.end]).filter((v): v is number => v != null)
  const [bandLo, bandHi] = targetBand(metric, loudFloor)
  const finiteBand = [bandLo, bandHi].filter((v) => Number.isFinite(v))
  const lo0 = Math.min(...values, ...finiteBand)
  const hi0 = Math.max(...values, ...finiteBand)
  const padY = (hi0 - lo0) * 0.15 || 1
  const yMin = metric === 'clarity' || metric === 'jitter' ? Math.max(0, lo0 - padY) : lo0 - padY
  const yMax = metric === 'clarity' ? Math.min(100, hi0 + padY) : hi0 + padY
  const yPos = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin || 1)) * PH
  const xPos = (i: number) => PAD.l + (points.length === 1 ? PW / 2 : (i / (points.length - 1)) * PW)
  const bandTop = yPos(Math.min(bandHi, yMax))
  const bandBottom = yPos(Math.max(bandLo, yMin))

  const startPts = points.map((p, i) => (p.start == null ? null : [xPos(i), yPos(p.start)] as const))
  const line = startPts.filter(Boolean).map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt![0].toFixed(1)} ${pt![1].toFixed(1)}`).join(' ')
  const ticks = [yMin, (yMin + yMax) / 2, yMax]

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ height: CH }} role="img" aria-label="주별 시작 녹음 추이">
      {/* target band */}
      <rect x={PAD.l} y={bandTop} width={PW} height={Math.max(0, bandBottom - bandTop)} fill="#2F7D55" fillOpacity={0.1} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} y1={yPos(v)} x2={CW - PAD.r} y2={yPos(v)} stroke="#888" strokeOpacity={0.12} />
          <text x={PAD.l - 4} y={yPos(v) + 3} textAnchor="end" fontSize={8} fill="#888">{formatMetric(metric, v)}</text>
        </g>
      ))}
      {/* end recordings — practice-effect, shown quietly */}
      {points.map((p, i) => p.end == null ? null : (
        <circle key={`e${i}`} cx={xPos(i)} cy={yPos(p.end)} r={3} fill="#9ca3af" fillOpacity={0.6} />
      ))}
      {/* start recordings — the trend */}
      {line && <path d={line} fill="none" stroke="#2D3A8C" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      {startPts.map((pt, i) => pt && (
        <circle
          key={`s${i}`} cx={pt[0]} cy={pt[1]} r={4}
          fill="#2D3A8C" stroke="#2D3A8C" strokeWidth={2}
        />
      ))}
      {points.map((p, i) => (
        <text
          key={`x${i}`} x={xPos(i)} y={CH - 6} fontSize={8} fill="#888"
          textAnchor={points.length > 1 && i === 0 ? 'start' : points.length > 1 && i === points.length - 1 ? 'end' : 'middle'}
        >
          {p.week.slice(5).replace('-', '/')}주
        </text>
      ))}
    </svg>
  )
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
interface CalendarProps {
  trainingDates: Set<string>
  selectedDate: string | null
  onSelectDate: (d: string) => void
  currentMonth: Date
  onPrevMonth: () => void
  onNextMonth: () => void
}

function TrainingCalendar({ trainingDates, selectedDate, onSelectDate, currentMonth, onPrevMonth, onNextMonth }: CalendarProps) {
  const todayStr = toDateStr(new Date())
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="rounded-[28px] bg-secondary p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrevMonth} aria-label="이전 달" className="w-9 h-9 rounded-full bg-card flex items-center justify-center active:scale-90 transition-transform">
          <ChevronLeft size={16} className="text-muted-foreground" />
        </button>
        <p className="text-[16px] font-black text-foreground tabular-nums">{year}년 {month + 1}월</p>
        <button onClick={onNextMonth} aria-label="다음 달" className="w-9 h-9 rounded-full bg-card flex items-center justify-center active:scale-90 transition-transform">
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <p key={d} className="text-center text-[11px] font-semibold text-muted-foreground">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const hasTraining = trainingDates.has(dateStr)
          const isSelected = selectedDate === dateStr
          const isToday = dateStr === todayStr
          return (
            <button key={i} onClick={() => onSelectDate(isSelected ? '' : dateStr)}
              className={`relative flex flex-col items-center justify-center h-9 rounded-xl transition-all active:scale-95 ${isSelected ? 'bg-accent' : ''}`}>
              <span className={`text-xs font-semibold leading-none ${isSelected ? 'text-accent-foreground' : isToday ? 'text-accent font-black' : hasTraining ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                {day}
              </span>
              {hasTraining && <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-primary' : 'bg-accent'}`} />}
                          </button>
          )
        })}
      </div>
    </div>
  )
}

function sessionLine(s: TrainingSessionRow): { title: string; sub: string } {
  const track = s.concern ? TRACKS[s.concern] : null
  const scene = s.scene ? SCENE_LABELS[s.scene].label : ''
  if (s.kind === 'diagnosis') return { title: `${scene} 진단`, sub: track ? `${track.label} 트랙 시작` : '진단 완료' }
  const rung = s.rung ? `${s.rung}단계: ${getRung(s.rung).title}` : ''
  const result = s.met_criterion === true ? '목표 안' : s.met_criterion === false ? '목표에 조금 못 미침' : '직접 판단'
  return { title: `${scene} ${track?.label ?? '훈련'}`, sub: [rung, result].filter(Boolean).join(', ') }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ArchiveClient() {
  const router = useRouter()
  const { loading, profile, sessions, trackSessions } = useTrack()
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toDateStr(today), [today])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)

  const track = profile.trackConcern ? TRACKS[profile.trackConcern] : null
  const metric = track?.metric ?? null
  const scene = profile.scene ? SCENE_LABELS[profile.scene] : null

  // 오래된 세션 → 최근 세션
  const ordered = useMemo(() => [...trackSessions].reverse(), [trackSessions])
  const points = useMemo(() => (metric ? weeklyTrend(metric, ordered) : []), [metric, ordered])
  // 크기 목표는 세션 성공 기준과 같은 값(진단 허밍 기준)
  const diagnosisMeasures = sessions.find((s) => s.kind === 'diagnosis' && s.scene === profile.scene && s.rung_measures?.length)?.rung_measures ?? null
  const loudFloor = loudnessFloor(diagnosisMeasures, profile.baseline)
  const verdict = metric ? trendVerdict(metric, points, ordered.length, loudFloor) : 'too-few'

  const trainingDates = useMemo(() => new Set(sessions.map((s) => s.session_date)), [sessions])
  const weekDates = useMemo(() => getWeekDates(today), [today])
  const weekTrainedCount = weekDates.filter((d) => trainingDates.has(d)).length
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const monthCount = useMemo(
    () => new Set(sessions.filter((s) => s.session_date.startsWith(monthPrefix)).map((s) => s.session_date)).size,
    [sessions, monthPrefix],
  )
  const selectedSessions = useMemo(
    () => (selectedDate ? sessions.filter((s) => s.session_date === selectedDate).reverse() : []),
    [sessions, selectedDate],
  )

  function prevMonth() { setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setSelectedDate(null) }
  function nextMonth() { setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setSelectedDate(null) }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-84px)]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <PageHeader
        eyebrow={`${today.getFullYear()}년 ${today.getMonth() + 1}월 아카이브`}
        title={track && scene ? `${scene.label} ${track.label} 트랙` : '훈련 기록'}
        sub={`이번 달 ${monthCount}일 훈련했어요`}
      />

      {/* 이번 주 일곱 칸 */}
      <div className="px-5 pt-2 flex items-end gap-1.5">
        {weekDates.map((dateStr, i) => {
          const isToday = dateStr === todayStr
          const isTrained = trainingDates.has(dateStr)
          return (
            <div key={dateStr} className="flex flex-col items-center gap-1.5">
              <span className={`text-[11px] font-semibold ${isToday ? 'text-foreground' : 'text-muted-foreground'}`}>{DOW_LABELS[i]}</span>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isTrained ? 'bg-accent text-accent-foreground' : isToday ? 'border-2 border-accent' : 'bg-secondary'
              }`}>
                {isTrained && <Check size={15} strokeWidth={3} aria-label="훈련함" />}
              </span>
            </div>
          )
        })}
        <span className="ml-auto whitespace-nowrap"><Pill tone="data">이번 주 {weekTrainedCount}일</Pill></span>
      </div>

      <div className="px-5 pt-5 space-y-4">
        {/* ── 개선 추이 ── */}
        <section className="rounded-[28px] bg-secondary p-6 space-y-3">
          <div>
            <p className="text-[18px] font-black text-foreground">개선 추이</p>
            {metric ? (
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                {METRIC_LABEL[metric].title}: 매 연습의 <span className="font-semibold text-foreground">시작 녹음</span>을 주 단위로 묶었어요
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">훈련을 시작하면 트랙의 지표 하나만 여기서 추이로 보여 드려요.</p>
            )}
          </div>

          {metric && verdict !== 'too-few' && (
            <div className="rounded-2xl bg-card p-3 space-y-2">
              <TrendChart metric={metric} points={points} loudFloor={loudFloor} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-accent" />시작 녹음 (남아 있는 것)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400/60" />마무리 녹음 (연습 직후)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-good/20" />{METRIC_LABEL[metric].band}</span>
              </div>
              {metric === 'jitter' && <p className="text-[11px] text-muted-foreground">{JITTER_NOTE}</p>}
            </div>
          )}

          {metric && verdict === 'too-few' && (
            <div className="rounded-2xl bg-card px-4 py-6 flex flex-col items-center gap-3 text-center">
              <TrendingUp size={26} className="text-muted-foreground/60" aria-hidden="true" />
              <div className="flex gap-1.5">
                {Array.from({ length: TREND_MIN_SESSIONS }, (_, i) => (
                  <span key={i} className={`w-3 h-3 rounded-full ${i < ordered.length ? 'bg-accent' : 'bg-border'}`} />
                ))}
              </div>
            </div>
          )}

          {metric && <p className="text-[15px] text-foreground leading-relaxed">{trendCopy(verdict, ordered.length)}</p>}

          {!track && <PrimaryButton onClick={() => router.push('/training')}>훈련 시작하기</PrimaryButton>}
        </section>

        {/* ── Calendar ── */}
        <div>
          <p className="eyebrow mb-2 px-1">훈련 캘린더</p>
          <TrainingCalendar
            trainingDates={trainingDates}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d || null)}
            currentMonth={currentMonth}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
        </div>

        {selectedDate && (
          <section className="rounded-[28px] bg-secondary p-6 space-y-3">
            <p className="text-[15px] font-black text-foreground tabular-nums">{selectedDate.replace(/-/g, '.')} 훈련 기록</p>
            {selectedSessions.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">이 날은 훈련 기록이 없어요</p>
            ) : selectedSessions.map((s) => {
              const line = sessionLine(s)
              const Icon = s.kind === 'diagnosis' ? Search : Mic
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
                  <Icon size={18} className="text-accent shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-foreground truncate">{line.title}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{line.sub}</p>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ── Quick actions ── */}
        <section className="rounded-[28px] bg-secondary p-5 space-y-2">
          <p className="text-[16px] font-black text-foreground mb-1 px-1">바로가기</p>
          {[
            { href: '/training', icon: Dumbbell, iconBox: 'bg-primary text-primary-foreground', title: '오늘 연습', sub: '약 5분, 시작 녹음부터' },
            { href: '/record', icon: Mic, iconBox: 'bg-accent text-accent-foreground', title: '목소리 다시 분석', sub: '페르소나와 목소리 진단을 새로 받아요' },
          ].map(({ href, icon: Icon, iconBox, title, sub }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card active:scale-[0.98] transition-transform"
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBox}`}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-bold text-foreground">{title}</p>
                <p className="text-[12px] text-muted-foreground">{sub}</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          ))}
        </section>
      </div>
    </div>
  )
}
