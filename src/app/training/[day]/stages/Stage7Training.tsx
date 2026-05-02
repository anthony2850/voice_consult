'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Mic, CheckCircle, RotateCcw } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { markStageComplete } from '@/lib/trainingProgress'
import { usePitchDetector, autoCorrelate } from '@/hooks/usePitchDetector'
import StreakPopup from '@/components/StreakPopup'

// ─── Music constants ───────────────────────────────────────────────────────────
const SEMITONE = Math.pow(2, 1 / 12)
// Do-Mi-Sol-Mi-Do in semitones from root
const PATTERN_SEMITONES = [0, 4, 7, 4, 0]
const PATTERN_LABELS = ['도', '미', '솔', '미', '도']
// 3 rounds, each a whole tone (2 semitones) up
const ROUND_BASES = [
  { label: '1라운드 · C (도)', freq: 261.63 },
  { label: '2라운드 · D (레)', freq: 293.66 },
  { label: '3라운드 · E (미)', freq: 329.63 },
]

// ─── Timing (seconds) ─────────────────────────────────────────────────────────
const NOTE_DURATION = 1.6
const NOTE_GAP = 0.35
const ROUND_GAP = 2.2
const LEAD_IN = 2.0   // pause before first note (in "scroll time" before anything reaches indicator)

// ─── Canvas layout ────────────────────────────────────────────────────────────
const CANVAS_H = 220
const INDICATOR_X = 88  // where the dashed "sing now" line is (logical px)
const SCROLL_SPEED = 85 // logical px per second

// ─── Frequency display range ──────────────────────────────────────────────────
const FREQ_MIN = 120
const FREQ_MAX = 700

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScheduledNote {
  freq: number
  label: string
  startTime: number
  endTime: number
  round: number
}

type PageState = 'instruction' | 'countdown' | 'playing' | 'result'

// ─── Build note schedule ───────────────────────────────────────────────────────
function buildSchedule(): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  // offset so first note arrives at indicator exactly at LEAD_IN seconds
  // note left edge is at INDICATOR_X when elapsed == startTime
  // so at elapsed=0, note left edge = INDICATOR_X + startTime * SCROLL_SPEED
  // we want that to be at canvas right edge or just off: startTime = (canvasW - INDICATOR_X) / SCROLL_SPEED + LEAD_IN
  // We'll use a logical canvas width of 360 for scheduling
  const arrivalOffset = (360 - INDICATOR_X) / SCROLL_SPEED + LEAD_IN

  let t = arrivalOffset
  for (let r = 0; r < ROUND_BASES.length; r++) {
    for (let i = 0; i < PATTERN_SEMITONES.length; i++) {
      const freq = ROUND_BASES[r].freq * Math.pow(SEMITONE, PATTERN_SEMITONES[i])
      notes.push({ freq, label: PATTERN_LABELS[i], startTime: t, endTime: t + NOTE_DURATION, round: r })
      t += NOTE_DURATION + (i < PATTERN_SEMITONES.length - 1 ? NOTE_GAP : 0)
    }
    if (r < ROUND_BASES.length - 1) t += ROUND_GAP
  }
  return notes
}

const SCHEDULE = buildSchedule()
const TOTAL_DURATION = SCHEDULE[SCHEDULE.length - 1].endTime + 1.8
const PASS_COUNT = Math.ceil(SCHEDULE.length * 0.6) // 9 of 15

// ─── Helpers ──────────────────────────────────────────────────────────────────
function freqToY(hz: number, h: number): number {
  const lo = Math.log2(FREQ_MIN), hi = Math.log2(FREQ_MAX)
  const v = Math.log2(Math.max(hz, FREQ_MIN))
  return h * (1 - (v - lo) / (hi - lo))
}

function hzToSemitones(hz: number) { return 12 * Math.log2(hz / 27.5) }

function isOnTarget(userHz: number, targetHz: number) {
  if (userHz <= 0) return false
  return Math.abs(hzToSemitones(userHz) - hzToSemitones(targetHz)) <= 2.0
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function calcStreak(dates: string[]) {
  const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const today = toDateStr(new Date())
  let count = 0, expected = today
  for (const date of unique) {
    if (date === expected) { count++; const d = new Date(expected); d.setDate(d.getDate() - 1); expected = toDateStr(d) }
    else if (date < expected) break
  }
  return count
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stage7Training() {
  const todayStr = toDateStr(new Date())
  const [pageState, setPageState] = useState<PageState>('instruction')
  const [countdown, setCountdown] = useState(3)
  const [hitCount, setHitCount] = useState(0)
  const [currentRound, setCurrentRound] = useState(0)
  const [saving, setSaving] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [showStreak, setShowStreak] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [allLogDates, setAllLogDates] = useState<string[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasW = useRef(360)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const hitFrames = useRef(Array(SCHEDULE.length).fill(0))
  const totalFrames = useRef(Array(SCHEDULE.length).fill(0))
  const pitchHistory = useRef<number[]>([])

  const { analyserRef, start: startMic, stop: stopMic } = usePitchDetector()

  // Check completion status
  useEffect(() => {
    async function checkDone() {
      const supabase = getSupabase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('user_training_logs').select('stage_num, log_date').eq('user_id', user.id)
      if (data) {
        setAlreadyDone(data.some((r: { stage_num: number; log_date: string }) => r.stage_num === 7 && r.log_date === todayStr))
        setAllLogDates(data.map((r: { log_date: string }) => r.log_date))
      }
    }
    checkDone()
  }, [todayStr])

  // Set canvas resolution on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const parent = canvas.parentElement
    const cssW = parent?.clientWidth ?? 360
    canvasW.current = cssW
    canvas.width = cssW * dpr
    canvas.height = CANVAS_H * dpr
    const ctx = canvas.getContext('2d')
    ctx?.scale(dpr, dpr)
  }, [])

  const getSmoothedPitch = useCallback((): number => {
    const node = analyserRef.current
    if (!node) return -1
    const buf = new Float32Array(node.fftSize)
    node.getFloatTimeDomainData(buf)
    const raw = autoCorrelate(buf, node.context.sampleRate)
    if (raw > 0) {
      pitchHistory.current.push(raw)
      if (pitchHistory.current.length > 6) pitchHistory.current.shift()
      const sorted = [...pitchHistory.current].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    pitchHistory.current = []
    return -1
  }, [])

  const drawFrame = useCallback((elapsed: number, userHz: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvasW.current, H = CANVAS_H

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, W, H)

    // Reference frequency lines (right of indicator)
    const refNotes = [
      { freq: 261.63, label: 'C4 도' },
      { freq: 329.63, label: 'E4 미' },
      { freq: 392.00, label: 'G4 솔' },
      { freq: 440.00, label: 'A4 라' },
      { freq: 523.25, label: 'C5 도' },
    ]
    refNotes.forEach(({ freq, label }) => {
      const y = freqToY(freq, H)
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(INDICATOR_X, y)
      ctx.lineTo(W, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(label, INDICATOR_X + 4, y - 3)
    })

    // Note blocks
    SCHEDULE.forEach((note, idx) => {
      const noteW = NOTE_DURATION * SCROLL_SPEED
      const xLeft = INDICATOR_X + (note.startTime - elapsed) * SCROLL_SPEED
      const xRight = xLeft + noteW
      if (xRight < 0 || xLeft > W) return

      const noteY = freqToY(note.freq, H)
      const blockH = 30

      const isActive = elapsed >= note.startTime && elapsed <= note.endTime
      const hasPassed = elapsed > note.endTime

      // Track accuracy frames
      if (isActive) {
        totalFrames.current[idx]++
        if (isOnTarget(userHz, note.freq)) hitFrames.current[idx]++
      }

      const hitRatio = totalFrames.current[idx] > 0
        ? hitFrames.current[idx] / totalFrames.current[idx]
        : 0

      // Color logic
      let fillColor: string
      if (hasPassed) {
        fillColor = hitRatio >= 0.5 ? 'rgba(52,211,153,0.55)' : 'rgba(239,68,68,0.35)'
      } else if (isActive && isOnTarget(userHz, note.freq)) {
        fillColor = '#34d399'
      } else if (isActive) {
        fillColor = '#0093BA'
      } else {
        fillColor = 'rgba(0,147,186,0.55)'
      }

      // Clip to canvas bounds
      const clampedX = Math.max(INDICATOR_X, xLeft)
      const drawW = Math.min(W, xRight) - clampedX
      if (drawW <= 0) return

      drawRoundedRect(ctx, clampedX, noteY - blockH / 2, drawW, blockH, 7)
      ctx.fillStyle = fillColor
      ctx.fill()

      // Glow on active
      if (isActive) {
        ctx.shadowColor = isOnTarget(userHz, note.freq) ? '#34d399' : '#0093BA'
        ctx.shadowBlur = 12
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Label
      if (drawW > 28) {
        ctx.fillStyle = hasPassed
          ? (hitRatio >= 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)')
          : '#fff'
        ctx.font = `bold 14px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(note.label, clampedX + drawW / 2, noteY + 5)
      }
    })

    // Indicator dashed line
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(INDICATOR_X, 0)
    ctx.lineTo(INDICATOR_X, H)
    ctx.stroke()
    ctx.setLineDash([])

    // Left panel background (slightly darker)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(0, 0, INDICATOR_X, H)

    // User pitch indicator (left side)
    if (userHz > 0) {
      const pitchY = freqToY(userHz, H)
      const inView = pitchY > 5 && pitchY < H - 5

      if (inView) {
        // Horizontal beam
        const beamGrad = ctx.createLinearGradient(0, 0, INDICATOR_X, 0)
        beamGrad.addColorStop(0, 'rgba(255,215,0,0)')
        beamGrad.addColorStop(1, 'rgba(255,215,0,0.25)')
        ctx.fillStyle = beamGrad
        ctx.fillRect(0, pitchY - 12, INDICATOR_X, 24)

        // Circle
        ctx.beginPath()
        ctx.arc(INDICATOR_X - 14, pitchY, 9, 0, Math.PI * 2)
        ctx.fillStyle = '#FFD700'
        ctx.shadowColor = '#FFD700'
        ctx.shadowBlur = 14
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    // Round label overlay (top right)
    const activeNote = SCHEDULE.find(n => elapsed >= n.startTime - 0.5 && elapsed <= n.endTime + 0.5)
    if (activeNote) setCurrentRound(activeNote.round)
  }, [])

  function runLoop() {
    hitFrames.current = Array(SCHEDULE.length).fill(0)
    totalFrames.current = Array(SCHEDULE.length).fill(0)
    startTimeRef.current = performance.now()

    function tick() {
      const elapsed = (performance.now() - startTimeRef.current) / 1000
      const userHz = getSmoothedPitch()
      drawFrame(elapsed, userHz)

      if (elapsed < TOTAL_DURATION) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Compute final hit count
        let hits = 0
        SCHEDULE.forEach((_, idx) => {
          const ratio = totalFrames.current[idx] > 0
            ? hitFrames.current[idx] / totalFrames.current[idx]
            : 0
          if (ratio >= 0.5) hits++
        })
        setHitCount(hits)
        stopMic()
        setPageState('result')
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  async function handleStart() {
    await startMic()
    pitchHistory.current = []
    setPageState('countdown')
    let c = 3
    setCountdown(c)
    const iv = setInterval(() => {
      c--
      if (c <= 0) {
        clearInterval(iv)
        setPageState('playing')
        runLoop()
      } else {
        setCountdown(c)
      }
    }, 1000)
  }

  function handleRetry() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    stopMic()
    setHitCount(0)
    setCurrentRound(0)
    pitchHistory.current = []
    setPageState('instruction')
  }

  async function handleComplete() {
    const passed = hitCount >= PASS_COUNT
    if (!passed) return
    markStageComplete(7)
    setSaving(true)
    try {
      const supabase = getSupabase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('user_training_logs').insert({
        user_id: user.id, log_date: todayStr, theme: 'accuracy',
        score: Math.round((hitCount / SCHEDULE.length) * 100), stage_num: 7,
      })
      if (error && error.code !== '23505') console.error('[stage7]', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('user_training_logs').select('log_date').eq('user_id', user.id)
      const dates: string[] = [...new Set([...(data?.map((r: { log_date: string }) => r.log_date) ?? []), todayStr])]
      setAllLogDates(dates)
      setStreakCount(calcStreak(dates))
      setAlreadyDone(true)
      setShowStreak(true)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    stopMic()
  }, [stopMic])

  const passed = hitCount >= PASS_COUNT

  return (
    <>
      {showStreak && (
        <StreakPopup
          streak={streakCount}
          logDates={allLogDates}
          onClose={() => { setShowStreak(false); window.location.replace('/training') }}
        />
      )}

      <div className="px-4 pt-4 pb-8 space-y-4">
        {alreadyDone && pageState === 'instruction' && (
          <div className="flex items-center gap-3 bg-orange-400/10 border border-orange-400/30 rounded-2xl px-4 py-3">
            <span className="text-lg">🔥</span>
            <p className="text-sm font-semibold text-orange-400">이미 완료한 단계예요! 다시 연습해도 좋아요.</p>
          </div>
        )}

        {/* ── Instruction ── */}
        {pageState === 'instruction' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-5 text-center">
            <span className="text-5xl">🎵</span>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">음계 발성 훈련</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                음표 블록이 왼쪽으로 흘러와요.<br />
                <span className="text-primary font-semibold">점선에 닿는 순간</span> 그 음을 소리내어 불러보세요.<br />
                금색 점이 블록 안에 들어오면 성공이에요.
              </p>
            </div>

            <div className="w-full rounded-2xl bg-secondary/60 p-4 space-y-2 text-left">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">훈련 구성</p>
              {ROUND_BASES.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{i + 1}라운드 · {b.label.split('·')[1]?.trim()}</span>
                  <span className="text-muted-foreground">도 — 미 — 솔 — 미 — 도</span>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground pt-2">
                🎯 15개 중 <span className="text-primary font-bold">{PASS_COUNT}개 이상</span> 맞추면 통과!
              </p>
            </div>

            <button
              onClick={handleStart}
              className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-xl shadow-primary/30 active:scale-95 transition-transform"
            >
              <Mic size={26} className="text-white" />
            </button>
            <p className="text-[11px] text-muted-foreground">버튼을 누르면 3초 후 시작돼요</p>
          </div>
        )}

        {/* ── Countdown ── */}
        {pageState === 'countdown' && (
          <div className="glass rounded-3xl p-10 flex flex-col items-center gap-4">
            <p className="text-7xl font-black text-primary" style={{ animation: 'ping 0.9s ease-in-out infinite' }}>
              {countdown}
            </p>
            <p className="text-sm text-muted-foreground">준비하세요!</p>
          </div>
        )}

        {/* ── Playing ── */}
        {pageState === 'playing' && (
          <div className="space-y-3">
            <div className="glass rounded-3xl overflow-hidden">
              {/* Status bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30">
                <span className="text-[11px] font-bold text-primary animate-pulse">● 녹음 중</span>
                <span className="text-[11px] text-muted-foreground">
                  {ROUND_BASES[currentRound]?.label}
                </span>
              </div>

              {/* Canvas track */}
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: `${CANVAS_H}px`, display: 'block' }}
              />

              {/* Guide */}
              <div className="px-4 py-2.5 border-t border-border/30">
                <p className="text-[11px] text-muted-foreground text-center">
                  🔸 점선에 블록이 닿을 때 소리를 내세요 &nbsp;·&nbsp; 금색 점이 블록 안으로 들어오면 성공
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Result ── */}
        {pageState === 'result' && (
          <div className="space-y-4">
            <div className="glass rounded-3xl p-6 text-center">
              <p className="text-xl font-black mb-3">
                {passed ? '🎉 통과!' : '🎵 한 번 더 도전해보세요'}
              </p>
              <p className="text-5xl font-black text-primary mb-1">{hitCount}<span className="text-2xl text-muted-foreground">/{SCHEDULE.length}</span></p>
              <p className="text-xs text-muted-foreground mb-4">음 맞힘</p>

              <div className="h-3 bg-secondary/60 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${passed ? 'bg-emerald-400' : 'bg-orange-400'}`}
                  style={{ width: `${(hitCount / SCHEDULE.length) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">통과 기준: {PASS_COUNT}/{SCHEDULE.length}</p>
            </div>

            {/* Round breakdown */}
            <div className="glass rounded-2xl p-4 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground">라운드별 결과</p>
              {ROUND_BASES.map((b, r) => {
                const roundNotes = SCHEDULE.filter(n => n.round === r)
                const roundHits = roundNotes.filter((_, localIdx) => {
                  const globalIdx = r * PATTERN_SEMITONES.length + localIdx
                  return totalFrames.current[globalIdx] > 0 &&
                    hitFrames.current[globalIdx] / totalFrames.current[globalIdx] >= 0.5
                }).length
                return (
                  <div key={r} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{b.label}</span>
                    <span className={roundHits >= 3 ? 'text-emerald-400 font-bold' : 'text-orange-400'}>
                      {roundHits}/{roundNotes.length}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="space-y-3">
              {passed && (
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-95 transition-transform disabled:opacity-70"
                >
                  {saving
                    ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <><CheckCircle size={20} />훈련 완료하기</>}
                </button>
              )}
              <button
                onClick={handleRetry}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary/60 text-sm text-muted-foreground active:scale-95 transition-all"
              >
                <RotateCcw size={14} />
                다시 도전하기
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
