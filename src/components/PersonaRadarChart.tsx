'use client'

import { useEffect, useRef } from 'react'

const EMOTION_KO: Record<string, string> = {
  'Admiration': '감탄',
  'Adoration': '경애',
  'Aesthetic Appreciation': '미적 감상',
  'Amusement': '즐거움',
  'Awe': '경외감',
  'Awkwardness': '어색함',
  'Calmness': '차분함',
  'Concentration': '집중',
  'Contemplation': '사색',
  'Contentment': '만족감',
  'Craving': '갈망',
  'Determination': '결단력',
  'Disappointment': '실망',
  'Doubt': '의심',
  'Ecstasy': '황홀감',
  'Empathic Pain': '공감·아픔',
  'Enthusiasm': '열정',
  'Excitement': '흥분',
  'Interest': '호기심',
  'Joy': '기쁨',
  'Love': '사랑',
  'Nostalgia': '향수',
  'Pain': '아파함',
  'Pride': '자부심',
  'Realization': '깨달음',
  'Relief': '안도감',
  'Romance': '설렘',
  'Sympathy': '공감·위로',
  'Triumph': '승리감',
  'Surprise (positive)': '긍정 놀람',
}

interface RadarChartProps {
  /** Ordered list of axis names */
  axes: string[]
  /** Target scores 0–100 (optional — omit to hide target polygon) */
  targetScores?: Record<string, number>
  /** User actual scores 0–100 */
  userScores: Record<string, number>
  /** Whether to animate (mount trigger) */
  animate: boolean
}

export default function PersonaRadarChart({
  axes,
  targetScores,
  userScores,
  animate,
}: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const progressRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const size = canvas.offsetWidth
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    const n = axes.length
    const cx = size / 2
    const cy = size / 2
    const maxR = size * 0.34
    const labelR = size * 0.46

    function getPoint(angle: number, value: number, max: number) {
      const r = (value / max) * maxR
      return {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      }
    }

    function draw(progress: number) {
      ctx.clearRect(0, 0, size, size)

      // ── Grid rings ──────────────────────────────────────
      const gridLevels = 4
      for (let l = 1; l <= gridLevels; l++) {
        const r = (l / gridLevels) * maxR
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const angle = (2 * Math.PI * i) / n - Math.PI / 2
          const x = cx + r * Math.cos(angle)
          const y = cy + r * Math.sin(angle)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.strokeStyle = 'rgba(150,150,180,0.18)'
        ctx.lineWidth = 1
        ctx.stroke()
        if (l === gridLevels) {
          ctx.fillStyle = 'rgba(139,92,246,0.04)'
          ctx.fill()
        }
      }

      // ── Axis lines ──────────────────────────────────────
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle))
        ctx.strokeStyle = 'rgba(150,150,180,0.25)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // ── Target polygon (only when targetScores provided) ──
      if (targetScores && Object.keys(targetScores).length > 0) {
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const angle = (2 * Math.PI * i) / n - Math.PI / 2
          const val = targetScores[axes[i]] ?? 0
          const p = getPoint(angle, val, 100)
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.closePath()
        ctx.fillStyle = 'rgba(139,92,246,0.12)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(139,92,246,0.50)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // ── User polygon (animated) ─────────────────────────
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2
        const val = (userScores[axes[i]] ?? 0) * progress
        const p = getPoint(angle, val, 100)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()
      ctx.fillStyle = 'rgba(16,185,129,0.20)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(16,185,129,0.80)'
      ctx.lineWidth = 2
      ctx.stroke()

      // ── User dots ───────────────────────────────────────
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2
        const val = (userScores[axes[i]] ?? 0) * progress
        const p = getPoint(angle, val, 100)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.5, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgb(16,185,129)'
        ctx.fill()
      }

      // ── Labels ──────────────────────────────────────────
      ctx.font = `bold ${Math.round(size * 0.033)}px -apple-system, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2
        const lx = cx + labelR * Math.cos(angle)
        const ly = cy + labelR * Math.sin(angle)
        const label = EMOTION_KO[axes[i]] ?? axes[i]
        ctx.fillStyle = 'rgba(220,220,240,0.9)'
        ctx.fillText(label, lx, ly)
      }
    }

    if (!animate) {
      draw(0)
      return
    }

    // animate 0 → 1 over ~700ms
    const duration = 700
    let startTime: number | null = null

    function frame(ts: number) {
      if (!startTime) startTime = ts
      const elapsed = ts - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      progressRef.current = eased
      draw(eased)
      if (t < 1) {
        animRef.current = requestAnimationFrame(frame)
      }
    }

    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', aspectRatio: '1 / 1', display: 'block' }}
    />
  )
}
