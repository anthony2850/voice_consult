'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, CheckCircle, RotateCcw } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { markStageComplete, getTodayCompleted } from '@/lib/trainingProgress'
import StreakPopup from '@/components/StreakPopup'

// ─── Music constants ───────────────────────────────────────────────────────────
const SEMITONE = Math.pow(2, 1 / 12)

// Do-Mi-Sol-Mi-Do in semitones from root
const PATTERN = [0, 4, 7, 4, 0]
const LABELS  = ['도', '미', '솔', '미', '도']

// 3 rounds: C4 → D4 → E4
const ROUNDS = [
  { label: 'C (도)', baseFreq: 261.63 },
  { label: 'D (레)', baseFreq: 293.66 },
  { label: 'E (미)', baseFreq: 329.63 },
]

// ─── Timing ────────────────────────────────────────────────────────────────────
const NOTE_ON       = 0.9   // seconds a note sounds
const NOTE_INTERVAL = 1.2   // seconds between note onsets
const ROUND_GAP     = 1.8   // extra gap between rounds
const LEAD_IN       = 0.6   // silence before first note

// ─── Canvas layout ─────────────────────────────────────────────────────────────
const CANVAS_H    = 170
const LINE_GAP    = 15          // px between staff lines
const STAFF_TOP   = 30          // y of top staff line
const STAFF_BOT   = STAFF_TOP + 4 * LINE_GAP  // = 90  (bottom line = E4 in treble clef)
const CLEF_W      = 52          // width reserved for treble clef

// Y positions on treble clef staff:
//   bottom line = E4    y = STAFF_BOT
//   2nd line    = G4    y = STAFF_BOT - LINE_GAP*2
//   C4 (Do)  = 1 ledger line below  y = STAFF_BOT + LINE_GAP
const NOTE_Y: Record<number, number> = {
  0: STAFF_BOT + LINE_GAP,          // C4  Do
  4: STAFF_BOT,                     // E4  Mi
  7: STAFF_BOT - LINE_GAP * 2,      // G4  Sol
}

// Compute schedule at module level
const SCHEDULE = (() => {
  const items: { round: number; noteIdx: number; freq: number; t: number }[] = []
  let t = LEAD_IN
  for (let r = 0; r < ROUNDS.length; r++) {
    for (let i = 0; i < PATTERN.length; i++) {
      items.push({ round: r, noteIdx: i, freq: ROUNDS[r].baseFreq * Math.pow(SEMITONE, PATTERN[i]), t })
      t += NOTE_INTERVAL
    }
    if (r < ROUNDS.length - 1) t += ROUND_GAP - NOTE_INTERVAL
  }
  return items
})()
const TOTAL_DURATION = SCHEDULE[SCHEDULE.length - 1].t + NOTE_ON + 0.8

// ─── Audio helper ──────────────────────────────────────────────────────────────
function scheduleNote(actx: AudioContext, freq: number, when: number) {
  const osc  = actx.createOscillator()
  const gain = actx.createGain()
  osc.connect(gain)
  gain.connect(actx.destination)
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(0.38, when + 0.05)
  gain.gain.setValueAtTime(0.38, when + NOTE_ON - 0.07)
  gain.gain.linearRampToValueAtTime(0, when + NOTE_ON)
  osc.start(when)
  osc.stop(when + NOTE_ON + 0.02)
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function noteXs(W: number): number[] {
  const available = W - CLEF_W - 24
  return PATTERN.map((_, i) => CLEF_W + 20 + Math.round((i / (PATTERN.length - 1)) * available))
}

function drawStaff(
  ctx: CanvasRenderingContext2D,
  W: number,
  activeNoteIdx: number,   // -1 = none
  roundIdx: number,
) {
  ctx.clearRect(0, 0, W, CANVAS_H)

  // Background
  ctx.fillStyle = '#f9f6f0'
  ctx.fillRect(0, 0, W, CANVAS_H)

  const INK = '#1a1a2e'
  const xs = noteXs(W)

  // ── Staff lines ──
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const y = STAFF_TOP + i * LINE_GAP
    ctx.beginPath()
    ctx.moveTo(CLEF_W - 4, y)
    ctx.lineTo(W - 12, y)
    ctx.stroke()
  }

  // Bar line at right end
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W - 12, STAFF_TOP)
  ctx.lineTo(W - 12, STAFF_BOT)
  ctx.stroke()

  // ── Treble clef (Unicode glyph) ──
  ctx.fillStyle = INK
  ctx.font = `${LINE_GAP * 5.8}px 'Times New Roman', Georgia, serif`
  ctx.textBaseline = 'bottom'
  ctx.fillText('𝄞', 2, STAFF_BOT + LINE_GAP * 1.6)
  ctx.textBaseline = 'alphabetic'

  // ── Round label ──
  if (roundIdx >= 0) {
    ctx.fillStyle = '#0093BA'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${roundIdx + 1}라운드 · ${ROUNDS[roundIdx].label}`, CLEF_W + 2, 18)
  }

  // ── Notes ──
  xs.forEach((x, i) => {
    const semitone = PATTERN[i]
    const ny       = NOTE_Y[semitone]
    const isActive = i === activeNoteIdx
    const noteColor = isActive ? '#e85d04' : INK

    // Ledger line for C4
    if (semitone === 0) {
      ctx.strokeStyle = noteColor
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(x - 11, ny)
      ctx.lineTo(x + 11, ny)
      ctx.stroke()
    }

    // Note head (filled ellipse, slight tilt)
    ctx.save()
    ctx.translate(x, ny)
    ctx.rotate(-Math.PI / 9)
    ctx.beginPath()
    ctx.ellipse(0, 0, 8, 5.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = noteColor
    ctx.fill()
    ctx.restore()

    // Stem (upward)
    ctx.strokeStyle = noteColor
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x + 7, ny - 3)
    ctx.lineTo(x + 7, ny - LINE_GAP * 3.5)
    ctx.stroke()

    // Active pulse ring
    if (isActive) {
      ctx.beginPath()
      ctx.arc(x, ny, 13, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(232,93,4,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Solfege label below staff
    ctx.fillStyle = isActive ? '#e85d04' : '#777'
    ctx.font = `${isActive ? 'bold ' : ''}11px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(LABELS[i], x, CANVAS_H - 8)
  })

  ctx.textAlign = 'left'
}

// ─── Date / streak helpers ─────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function calcStreak(dates: string[]) {
  const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const today = toDateStr(new Date())
  let count = 0, expected = today
  for (const date of unique) {
    if (date === expected) {
      count++
      const d = new Date(expected)
      d.setDate(d.getDate() - 1)
      expected = toDateStr(d)
    } else if (date < expected) break
  }
  return count
}

// ─── Component ────────────────────────────────────────────────────────────────
type PageState = 'instruction' | 'playing' | 'done'

export default function Stage7Training() {
  const todayStr = toDateStr(new Date())

  const [pageState,    setPageState]    = useState<PageState>('instruction')
  const [activeNote,   setActiveNote]   = useState(-1)
  const [activeRound,  setActiveRound]  = useState(0)
  const [saving,       setSaving]       = useState(false)
  const [alreadyDone,  setAlreadyDone]  = useState(false)
  const [showStreak,   setShowStreak]   = useState(false)
  const [streakCount,  setStreakCount]  = useState(0)
  const [allLogDates,  setAllLogDates]  = useState<string[]>([])

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const canvasW      = useRef(360)
  const rafRef       = useRef<number | null>(null)
  const audioCtxRef  = useRef<AudioContext | null>(null)
  const startPerfRef = useRef(0)

  // Check completion
  useEffect(() => {
    async function checkDone() {
      const supabase = getSupabase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs').select('stage_num, log_date').eq('user_id', user.id)
      if (data) {
        setAlreadyDone(data.some((r: { stage_num: number; log_date: string }) =>
          r.stage_num === 7 && r.log_date === todayStr))
        setAllLogDates(data.map((r: { log_date: string }) => r.log_date))
      }
    }
    checkDone()
  }, [todayStr])

  // Init canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.parentElement?.clientWidth ?? 360
    canvasW.current = cssW
    canvas.width  = cssW * dpr
    canvas.height = CANVAS_H * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) { ctx.scale(dpr, dpr); drawStaff(ctx, cssW, -1, 0) }
  }, [])

  function getCtx() {
    const canvas = canvasRef.current
    return canvas?.getContext('2d') ?? null
  }

  async function handleStart() {
    // Unlock AudioContext on user gesture
    const actx = new AudioContext()
    audioCtxRef.current = actx

    // Schedule all tones
    const now = actx.currentTime
    SCHEDULE.forEach(({ freq, t }) => scheduleNote(actx, freq, now + t))

    startPerfRef.current = performance.now()
    setPageState('playing')

    function tick() {
      const elapsed = (performance.now() - startPerfRef.current) / 1000

      let curNote  = -1
      let curRound = activeRound
      for (const ev of SCHEDULE) {
        if (elapsed >= ev.t && elapsed < ev.t + NOTE_ON) {
          curNote  = ev.noteIdx
          curRound = ev.round
          break
        }
      }
      // Update state only when changed (avoids excess re-renders)
      setActiveNote(prev  => prev  !== curNote  ? curNote  : prev)
      setActiveRound(prev => prev  !== curRound ? curRound : prev)

      const ctx = getCtx()
      if (ctx) drawStaff(ctx, canvasW.current, curNote, curRound)

      if (elapsed < TOTAL_DURATION) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setActiveNote(-1)
        setPageState('done')
        if (ctx) drawStaff(ctx, canvasW.current, -1, ROUNDS.length - 1)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function handleRetry() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    setPageState('instruction')
    setActiveNote(-1)
    setActiveRound(0)
    const ctx = getCtx()
    if (ctx) drawStaff(ctx, canvasW.current, -1, 0)
  }

  async function handleComplete() {
    const isFirstToday = getTodayCompleted().length === 0
    markStageComplete(7)
    setSaving(true)
    try {
      const supabase = getSupabase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('user_training_logs').insert({
        user_id: user.id, log_date: todayStr, theme: 'accuracy', score: 100, stage_num: 7,
      })
      if (error && error.code !== '23505') console.error('[stage7]', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs').select('log_date').eq('user_id', user.id)
      const dates: string[] = [...new Set([...(data?.map((r: { log_date: string }) => r.log_date) ?? []), todayStr])]
      setAllLogDates(dates)
      setStreakCount(calcStreak(dates))
      setAlreadyDone(true)
      if (isFirstToday) setShowStreak(true)
      else window.location.replace('/training')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    audioCtxRef.current?.close()
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
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

        {/* Staff */}
        <div className="rounded-3xl overflow-hidden border border-border/30 shadow-sm">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: `${CANVAS_H}px`, display: 'block' }}
          />
        </div>

        {/* Instruction */}
        {pageState === 'instruction' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-semibold text-foreground">음계를 들으며 '아—' 소리 내기</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              버튼을 누르면 <span className="text-primary font-semibold">도·미·솔·미·도</span> 순서로 음이 들려요.<br />
              빨간 음표를 보면서 그 높낮이에 맞게<br />
              <span className="text-primary font-semibold">'아——'</span> 하고 따라 소리 내보세요.<br />
              C → D → E 3개 음계를 순서대로 진행해요.
            </p>
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-8 py-3 rounded-2xl gradient-primary text-white font-bold shadow-lg shadow-primary/30 active:scale-95 transition-transform"
            >
              <Play size={18} className="fill-white" />
              시작하기
            </button>
            <p className="text-[11px] text-muted-foreground">소리가 잘 들리도록 볼륨을 높여두세요 🔊</p>
          </div>
        )}

        {/* Playing */}
        {pageState === 'playing' && (
          <div className="glass rounded-3xl px-5 py-4 flex flex-col items-center gap-2 text-center">
            <p className="text-base font-black text-primary">
              {activeNote >= 0 ? `'${LABELS[activeNote]}' — 아——` : '···'}
            </p>
            <p className="text-xs text-muted-foreground">빨간 음표의 높낮이에 맞춰 '아—' 소리를 내주세요</p>
            <button
              onClick={handleRetry}
              className="mt-1 text-xs text-muted-foreground underline underline-offset-2"
            >
              처음부터 다시
            </button>
          </div>
        )}

        {/* Done */}
        {pageState === 'done' && (
          <div className="space-y-3">
            <div className="glass rounded-3xl p-5 text-center">
              <p className="text-xl font-black mb-1">🎉 훈련 완료!</p>
              <p className="text-xs text-muted-foreground">
                도·미·솔·미·도 음계 발성을 3개 키로 마쳤어요
              </p>
            </div>
            <button
              onClick={handleComplete}
              disabled={saving}
              className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-95 transition-transform disabled:opacity-70"
            >
              {saving
                ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <><CheckCircle size={20} />훈련 완료하기</>}
            </button>
            <button
              onClick={handleRetry}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary/60 text-sm text-muted-foreground active:scale-95 transition-all"
            >
              <RotateCcw size={14} />
              다시 하기
            </button>
          </div>
        )}
      </div>
    </>
  )
}
