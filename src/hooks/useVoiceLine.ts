'use client'

import { useEffect, useRef } from 'react'

/** 무음으로 보는 크기 (dBFS). 이보다 작으면 소리가 없는 것으로 본다 */
const SILENCE_DB = -50
/** 점 하나의 길이 */
const STEP_MS = 50
/** 내 평소 크기를 가운데 두고 위아래로 보여 줄 범위 (dB) */
const HALF_RANGE_DB = 20
/** 이보다 짧은 끊김(자음, 글자 사이)은 선을 잇는다. 진짜 쉼만 끊는다 */
const BRIDGE_MS = 250

/**
 * 부드럽게 하는 정도.
 * - speech: 글자마다 생기는 출렁임 대신 말의 큰 흐름이 보이게 0.2초쯤 평균 낸다.
 * - sustained: "음~"처럼 길게 내는 소리. 흔들림이 보이게 덜 부드럽게 한다.
 */
export type VoiceLineMode = 'speech' | 'sustained'
const SMOOTH_MS: Record<VoiceLineMode, number> = { speech: 200, sustained: 60 }

interface VoiceLineOptions {
  analyser: AnalyserNode | null
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 화면 너비에 해당하는 시간. 넘으면 그만큼 눌러서 다 보여 준다 */
  spanSec: number
  mode?: VoiceLineMode
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * 연습 중 목소리 크기를 시간에 따라 선으로 그린다.
 * 높이는 절대 크기가 아니라 이번 녹음의 평소 크기(중앙값)를 가운데 둔 상대 크기라,
 * 마이크 거리나 기기에 덜 휘둘린다. 녹음이 끝나면(analyser가 사라지면) 마지막 선을 남긴다.
 */
export function useVoiceLine({ analyser, canvasRef, spanSec, mode = 'speech' }: VoiceLineOptions) {
  const points = useRef<(number | null)[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    // 녹음 분석기는 창이 짧아(256) 목소리 한 주기보다 짧다. 긴 창을 따로 붙인다.
    let tap: AnalyserNode | null = null
    let buf: Float32Array<ArrayBuffer> | null = null
    if (analyser) {
      points.current = []
      tap = analyser.context.createAnalyser()
      tap.fftSize = 2048
      analyser.connect(tap)
      buf = new Float32Array(tap.fftSize)
    }

    const alpha = 1 - Math.exp(-STEP_MS / SMOOTH_MS[mode])
    const bridgeSteps = Math.round(BRIDGE_MS / STEP_MS)
    let smoothed: number | null = null
    let last = performance.now()
    let raf = 0

    const sample = () => {
      const now = performance.now()
      if (!tap || !buf || now - last < STEP_MS) return
      last = now
      tap.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9)
      if (db < SILENCE_DB) {
        // 짧은 틈 동안 값을 버리지 않아야 다시 소리가 날 때 선이 튀지 않는다
        points.current.push(null)
        return
      }
      smoothed = smoothed == null ? db : smoothed + alpha * (db - smoothed)
      points.current.push(smoothed)
    }

    const render = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)
      // 바닥선
      ctx.strokeStyle = '#E2E4EC'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h - 0.5)
      ctx.lineTo(w, h - 0.5)
      ctx.stroke()

      const pts = points.current
      const voiced = pts.filter((v): v is number => v != null)
      if (voiced.length === 0) return
      const mid = median(voiced)
      const n = Math.max(pts.length, Math.round((spanSec * 1000) / STEP_MS))
      const x = (i: number) => (i / (n - 1)) * w
      const y = (db: number) => {
        const t = Math.min(1, Math.max(0, (db - (mid - HALF_RANGE_DB)) / (2 * HALF_RANGE_DB)))
        return h - 4 - t * (h - 8)
      }
      ctx.strokeStyle = '#2D3A8C'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      let pen = false
      let gap = 0
      pts.forEach((db, i) => {
        if (db == null) { gap++; return }
        // 짧은 틈은 건너서 잇고, 긴 쉼이면 새로 시작한다
        if (pen && gap <= bridgeSteps) ctx.lineTo(x(i), y(db))
        else { ctx.moveTo(x(i), y(db)); pen = true }
        gap = 0
      })
      ctx.stroke()
    }

    // 녹음 중에는 계속 그리고, 끝나면 남은 선을 한 번만 그린다
    const loop = () => { raf = requestAnimationFrame(loop); sample(); render() }
    if (tap) loop()
    else render()
    // 크기가 바뀌면 캔버스가 지워지니 다시 그린다 (처음 붙을 때도 한 번 불린다)
    const ro = new ResizeObserver(() => { resize(); render() })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (tap) { try { analyser?.disconnect(tap) } catch { /* 이미 닫힌 경우 */ } }
    }
  }, [analyser, canvasRef, spanSec, mode])
}
