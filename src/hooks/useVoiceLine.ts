'use client'

import { useEffect, useRef } from 'react'

/** 무음으로 보는 크기 (dBFS). 이보다 작으면 선을 끊는다 */
const SILENCE_DB = -50
/** 화면 위아래 끝에 해당하는 크기 */
const TOP_DB = -10
/** 점 하나의 길이. 떨림(초당 4~8번)이 보일 만큼 촘촘하게 */
const STEP_MS = 50

interface VoiceLineOptions {
  analyser: AnalyserNode | null
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 화면 너비에 해당하는 시간. 넘으면 그만큼 눌러서 다 보여 준다 */
  spanSec: number
}

/**
 * 연습 중 목소리 크기를 시간에 따라 선으로 그린다.
 * 소리가 고르면 곧은 선, 흔들리면 흔들리는 선, 끊기면 끊긴 선이 된다.
 * 녹음이 끝나면(analyser가 사라지면) 마지막 선을 그대로 남겨 둔다.
 */
export function useVoiceLine({ analyser, canvasRef, spanSec }: VoiceLineOptions) {
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

    let smoothed: number | null = null
    let last = performance.now()
    let raf = 0

    const sample = () => {
      const now = performance.now()
      if (tap && buf && now - last >= STEP_MS) {
        last = now
        tap.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9)
        if (db < SILENCE_DB) {
          smoothed = null
          points.current.push(null)
        } else {
          smoothed = smoothed == null ? db : smoothed * 0.4 + db * 0.6
          points.current.push(smoothed)
        }
      }
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
      const n = Math.max(pts.length, Math.round((spanSec * 1000) / STEP_MS))
      const x = (i: number) => (i / (n - 1)) * w
      const y = (db: number) => {
        const t = Math.min(1, Math.max(0, (db - SILENCE_DB) / (TOP_DB - SILENCE_DB)))
        return h - 4 - t * (h - 8)
      }
      ctx.strokeStyle = '#2D3A8C'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      let pen = false
      pts.forEach((db, i) => {
        if (db == null) { pen = false; return }
        if (pen) ctx.lineTo(x(i), y(db))
        else { ctx.moveTo(x(i), y(db)); pen = true }
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
  }, [analyser, canvasRef, spanSec])
}
