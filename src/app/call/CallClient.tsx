'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Phone, PhoneOff } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { getSupabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'
import { speechOnsetSec, syllableRate } from '@/lib/syllableRate'
import { ANSWER_MAX_SEC, ANSWER_MIN_SEC, onsetFeedback, paceFeedback, pickCallQuestion, type Tone } from '@/lib/callPractice'
import { Display, Eyebrow, MetricRow, Pill, PrimaryButton, SurfaceCard } from '@/components/ds'

type Phase = 'ringing' | 'speaking' | 'listening' | 'analyzing' | 'done' | 'declined'

/** 벨소리 — 파일 없이 Web Audio로 합성한다. 두 음 차임을 1.2초 울리고 1.8초 쉰다. */
function startRingtone(ctx: AudioContext): () => void {
  const ring = () => {
    const t0 = ctx.currentTime
    ;[[659.25, 0], [523.25, 0.18], [659.25, 0.36], [523.25, 0.54]].forEach(([f, dt]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0, t0 + dt)
      g.gain.linearRampToValueAtTime(0.18, t0 + dt + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.16)
      o.connect(g).connect(ctx.destination)
      o.start(t0 + dt)
      o.stop(t0 + dt + 0.18)
    })
  }
  ring()
  const id = window.setInterval(ring, 3000)
  const vib = window.setInterval(() => navigator.vibrate?.([700, 300, 700]), 3000)
  navigator.vibrate?.([700, 300, 700])
  return () => { window.clearInterval(id); window.clearInterval(vib); navigator.vibrate?.(0) }
}

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

const TONE_PILL: Record<Tone, 'good' | 'caution' | 'neutral'> = { good: 'good', caution: 'caution', neutral: 'neutral' }

export default function CallClient() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') ?? 'direct'
  const [phase, setPhase] = useState<Phase>('ringing')
  const [question] = useState(() => pickCallQuestion())
  const [authed, setAuthed] = useState(false)
  const [result, setResult] = useState<{ onset: number | null; rate: number | null; sec: number } | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const stopRing = useRef<(() => void) | null>(null)
  const recorder = useAudioRecorder(ANSWER_MAX_SEC)
  const startedAt = useRef(0)
  const [callSec, setCallSec] = useState(0)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => setAuthed(!!data.session))
  }, [])

  // 벨소리. 아이폰은 화면을 한 번 누르기 전에는 소리를 낼 수 없어, 누르면 그때 울린다.
  const ensureRing = useCallback(() => {
    if (phase !== 'ringing' || stopRing.current) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = window.AudioContext || (window as any).webkitAudioContext
      const ctx = audioCtx.current ?? new AC()
      audioCtx.current = ctx
      if (ctx.state === 'suspended') void ctx.resume()
      stopRing.current = startRingtone(ctx)
    } catch { /* 소리 없이도 화면은 울린다 */ }
  }, [phase])

  useEffect(() => {
    trackEvent('call_ringing', { from })
    ensureRing()
    return () => { stopRing.current?.(); stopRing.current = null }
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hangUpRing = () => { stopRing.current?.(); stopRing.current = null }

  // 통화 시간
  useEffect(() => {
    if (phase !== 'speaking' && phase !== 'listening') return
    const id = window.setInterval(() => setCallSec(Math.floor((performance.now() - startedAt.current) / 1000)), 500)
    return () => window.clearInterval(id)
  }, [phase])

  const accept = () => {
    hangUpRing()
    trackEvent('call_accepted', { from })
    startedAt.current = performance.now()
    setPhase('speaking')
    const startListening = () => { setPhase('listening'); void recorder.start() }
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) { window.setTimeout(startListening, 3500); return }
    const u = new SpeechSynthesisUtterance(question)
    u.lang = 'ko-KR'
    u.rate = 0.95
    const ko = synth.getVoices().find((v) => v.lang?.startsWith('ko'))
    if (ko) u.voice = ko
    let done = false
    const finish = () => { if (!done) { done = true; startListening() } }
    u.onend = finish
    u.onerror = finish
    // 음성이 안 나오는 기기를 위해 일정 시간이 지나면 그냥 듣기로 넘어간다
    window.setTimeout(finish, Math.max(4000, question.length * 220))
    synth.cancel()
    synth.speak(u)
  }

  const decline = () => {
    hangUpRing()
    trackEvent('call_declined', { from })
    setPhase('declined')
  }

  const endCall = () => {
    if (recorder.state === 'recording') recorder.stop()
  }

  // 녹음이 끝나면 기기 안에서 분석
  useEffect(() => {
    if (recorder.state !== 'recorded' || !recorder.audioBlob || phase !== 'listening') return
    const blob = recorder.audioBlob
    setPhase('analyzing')
    ;(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AC = window.AudioContext || (window as any).webkitAudioContext
        const ctx = new AC()
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
        void ctx.close()
        const x = buf.getChannelData(0)
        const onset = speechOnsetSec(x, buf.sampleRate)
        const rate = syllableRate(x, buf.sampleRate).articulationRate
        setResult({ onset, rate: rate > 0 ? rate : null, sec: Math.round(buf.duration) })
        trackEvent('call_completed', { from, onset: onset == null ? 'none' : onset <= 1.5 ? 'fast' : onset <= 3 ? 'ok' : 'slow' })
      } catch {
        setResult({ onset: null, rate: null, sec: recorder.duration })
      }
      setPhase('done')
    })()
  }, [recorder.state, recorder.audioBlob, recorder.duration, phase, from])

  // ── 끝난 뒤: 흰 화면 ─────────────────────────────────────
  if (phase === 'done' && result) {
    const o = onsetFeedback(result.onset)
    const p = paceFeedback(result.rate)
    const tooShort = result.sec < ANSWER_MIN_SEC
    return (
      <div className="fixed inset-0 z-[60] mx-auto w-full max-w-[480px] bg-background flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 pt-16 pb-6 space-y-6">
          <div className="text-center space-y-2">
            <Eyebrow>통화 끝</Eyebrow>
            <Display sub={`${result.sec}초 동안 대답했어요. 녹음은 이 휴대폰 안에서만 분석했어요.`}>{'전화 연습,\n수고했어요'}</Display>
          </div>
          <SurfaceCard className="py-2">
            <MetricRow label="첫마디까지" value={result.onset == null ? '-' : result.onset.toFixed(1)} unit="초" pill={<Pill tone={TONE_PILL[o.tone]}>{o.label}</Pill>} />
            <MetricRow label="말 빠르기" value={result.rate == null ? '-' : result.rate.toFixed(1)} unit="글자/초" pill={<Pill tone={TONE_PILL[p.tone]}>{p.label}</Pill>} />
          </SurfaceCard>
          <p className="px-1 text-[15px] leading-relaxed text-foreground">{tooShort ? '대답이 너무 짧아서 정확하지 않을 수 있어요. 다음엔 몇 문장 더 말해 봐요.' : o.line}</p>
        </div>
        <div className="shrink-0 px-5 pt-2 pb-[max(env(safe-area-inset-bottom),20px)] space-y-3">
          {authed ? (
            <PrimaryButton onClick={() => router.push('/training')}>오늘 세션 이어서 하기</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => router.push('/record')}>내 목소리 페르소나 알아보기</PrimaryButton>
          )}
          <button type="button" onClick={() => window.location.reload()} className="w-full h-14 rounded-full border-2 border-border text-[16px] font-bold text-foreground active:bg-secondary">
            한 번 더 받아 보기
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'declined') {
    return (
      <div className="fixed inset-0 z-[60] mx-auto w-full max-w-[480px] bg-background flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-5 text-center">
          <Display sub="시간 될 때 다시 받아 봐요. 20초면 끝나요.">{'괜찮아요,\n다음에 받아요'}</Display>
        </div>
        <div className="shrink-0 px-5 pt-2 pb-[max(env(safe-area-inset-bottom),20px)] space-y-3">
          <PrimaryButton onClick={() => window.location.reload()}>지금 받아 보기</PrimaryButton>
          <button type="button" onClick={() => router.push('/')} className="w-full h-14 rounded-full border-2 border-border text-[16px] font-bold text-foreground active:bg-secondary">홈으로</button>
        </div>
      </div>
    )
  }

  // ── 전화 화면: 남색 전체 화면 ───────────────────────────────
  const inCall = phase === 'speaking' || phase === 'listening' || phase === 'analyzing'
  return (
    <div
      className="fixed inset-0 z-[60] mx-auto w-full max-w-[480px] bg-foreground text-white flex flex-col"
      onPointerDown={phase === 'ringing' ? ensureRing : undefined}
    >
      <div className="flex-1 flex flex-col items-center px-6 pt-20 text-center">
        <p className="text-[14px] text-white/70">{inCall ? (phase === 'analyzing' ? '통화 정리 중' : fmt(callSec)) : 'MyTone 연습 전화'}</p>
        <h1 className="mt-2 text-[34px] font-black tracking-[-0.02em]">MyTone 코치</h1>
        <div className="relative mt-10 w-32 h-32 flex items-center justify-center" aria-hidden="true">
          {phase === 'ringing' && <span className="absolute inset-0 rounded-full bg-white/15 animate-ping [animation-duration:1.6s]" />}
          <span className="relative w-28 h-28 rounded-full bg-white flex items-center justify-center">
            <Image src="/logo.png" alt="" width={80} height={28} className="object-contain" />
          </span>
        </div>

        {inCall && (
          <div className="mt-10 w-full rounded-[28px] bg-white/10 px-5 py-5 text-left" aria-live="polite">
            <p className="text-[12px] font-bold text-primary">{phase === 'speaking' ? '코치가 말하는 중' : phase === 'listening' ? '말씀하세요' : '잠시만요'}</p>
            <p className="mt-1.5 text-[17px] leading-relaxed font-semibold">{question}</p>
          </div>
        )}
        {phase === 'ringing' && (
          <p className="mt-8 text-[14px] text-white/60">받으면 코치가 질문해요. 20초만 대답하면 돼요.</p>
        )}
        {recorder.error && <p className="mt-6 text-[14px] text-primary" role="alert">{recorder.error}</p>}
      </div>

      <div className="shrink-0 px-10 pb-[max(env(safe-area-inset-bottom),40px)]">
        {phase === 'ringing' ? (
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={decline} aria-label="거절" className="w-[72px] h-[72px] rounded-full bg-[#FF3B30] flex items-center justify-center active:scale-95 transition-transform">
                <PhoneOff size={30} />
              </button>
              <span className="text-[13px] text-white/80">거절</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={accept} aria-label="받기" className="w-[72px] h-[72px] rounded-full bg-[#34C759] flex items-center justify-center active:scale-95 transition-transform">
                <Phone size={30} />
              </button>
              <span className="text-[13px] text-white/80">받기</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={endCall}
              disabled={phase !== 'listening' || recorder.duration < ANSWER_MIN_SEC}
              aria-label="통화 종료"
              className="w-[72px] h-[72px] rounded-full bg-[#FF3B30] flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
            >
              <PhoneOff size={30} />
            </button>
            <span className="text-[13px] text-white/80">
              {phase === 'listening' && recorder.duration < ANSWER_MIN_SEC ? `${ANSWER_MIN_SEC - recorder.duration}초 뒤 끊을 수 있어요` : '통화 종료'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
