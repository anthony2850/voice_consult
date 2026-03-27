'use client'

import { useEffect, useRef } from 'react'

interface WaveformOptions {
  analyser: AnalyserNode | null
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** color of the bars — defaults to a violet-to-pink gradient */
  active: boolean
}

export function useWaveform({ analyser, canvasRef, active }: WaveformOptions) {
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Resize canvas to its CSS size
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const BAR_COUNT = 48
    const BAR_GAP = 3
    const MIN_HEIGHT = 3
    const IDLE_HEIGHT = 4

    // Idle gentle breathing animation (no analyser)
    let phase = 0

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      const barWidth = (w - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT

      // gradient
      const grad = ctx.createLinearGradient(0, 0, w, 0)
      grad.addColorStop(0, active ? '#7c3aed' : '#3d2a6b')
      grad.addColorStop(0.5, active ? '#a855f7' : '#4a3080')
      grad.addColorStop(1, active ? '#ec4899' : '#3d2a6b')

      ctx.fillStyle = grad

      if (analyser && active) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)

        for (let i = 0; i < BAR_COUNT; i++) {
          const dataIndex = Math.floor((i / BAR_COUNT) * data.length)
          const value = data[dataIndex] / 255
          const barHeight = Math.max(MIN_HEIGHT, value * (h * 0.85))
          const x = i * (barWidth + BAR_GAP)
          const y = (h - barHeight) / 2
          roundRect(ctx, x, y, barWidth, barHeight, barWidth / 2)
          ctx.fill()
        }
      } else {
        // Idle: breathing sine wave
        phase += 0.04
        for (let i = 0; i < BAR_COUNT; i++) {
          const wave = Math.sin(phase + (i / BAR_COUNT) * Math.PI * 2) * 0.5 + 0.5
          const barHeight = IDLE_HEIGHT + wave * 10
          const x = i * (barWidth + BAR_GAP)
          const y = (h - barHeight) / 2
          roundRect(ctx, x, y, barWidth, barHeight, barWidth / 2)
          ctx.fill()
        }
      }
    }

    draw()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [analyser, canvasRef, active])
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
