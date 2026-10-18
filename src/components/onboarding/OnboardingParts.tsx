'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, type LucideIcon } from 'lucide-react'

/** 온보딩 한 장. 하단 메뉴 위를 덮는 전체 화면, 위쪽 뒤로가기와 점 진행 표시, 아래쪽 버튼. */
export function OnboardingShell({ step, total, onBack, children, footer, align = 'center' }: {
  step: number
  total: number
  onBack: () => void
  children: React.ReactNode
  footer: React.ReactNode
  /** 'center' = 질문 화면, 'top' = 긴 설명 화면 */
  align?: 'center' | 'top'
}) {
  return (
    <div className="fixed inset-0 z-[60] mx-auto w-full max-w-[480px] bg-background flex flex-col">
      <header className="flex items-center h-14 px-3 shrink-0">
        <button type="button" onClick={onBack} aria-label="뒤로" className="w-11 h-11 flex items-center justify-center rounded-full active:bg-secondary">
          <ChevronLeft size={26} />
        </button>
        <div className="flex-1 flex items-center justify-center gap-1.5 pr-11" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary' : 'w-1.5 bg-border'}`}
            />
          ))}
        </div>
      </header>
      <div className={`flex-1 overflow-y-auto px-5 flex flex-col ${align === 'center' ? 'justify-center' : 'pt-4'}`}>
        <div className="pb-6">{children}</div>
      </div>
      <footer className="shrink-0 px-5 pt-2 pb-[max(env(safe-area-inset-bottom),20px)]">{footer}</footer>
    </div>
  )
}

export function OnboardingTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-[28px] leading-[1.25] font-extrabold tracking-tight text-foreground whitespace-pre-line">{children}</h1>
      {sub && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** 고르기 카드. 고른 카드만 흰 바탕과 색 테두리. */
export function OptionCard({ icon: Icon, title, sub, badge, selected, onSelect }: {
  icon: LucideIcon
  title: string
  sub?: string
  badge?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full flex items-center gap-4 rounded-[20px] px-5 py-4 text-left border-2 transition-colors ${
        selected ? 'bg-white border-primary shadow-[0_2px_12px_rgba(0,0,0,0.04)]' : 'bg-secondary/70 border-transparent active:bg-secondary'
      }`}
    >
      <Icon size={24} strokeWidth={1.8} className={selected ? 'text-foreground' : 'text-foreground/60'} aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold text-foreground leading-snug">{title}</span>
        {sub && <span className="block text-[13px] text-muted-foreground mt-0.5 leading-snug">{sub}</span>}
      </span>
      {badge && <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary text-gray-900">{badge}</span>}
      <span
        aria-hidden="true"
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected ? 'border-primary bg-primary' : 'border-border'}`}
      >
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-gray-900" />}
      </span>
    </button>
  )
}

export function PrimaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full h-14 rounded-full bg-primary text-gray-900 text-[17px] font-bold active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
    >
      {children}
    </button>
  )
}

/** 꾹 눌러야 시작되는 버튼 (다짐의 의식). 키보드는 Enter, Space로 바로 시작. */
export function HoldButton({ children, onDone, holdMs = 900, disabled }: {
  children: React.ReactNode
  onDone: () => void
  holdMs?: number
  disabled?: boolean
}) {
  const [progress, setProgress] = useState(0)
  const raf = useRef<number | null>(null)
  const done = useRef(false)

  const cancel = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    if (!done.current) setProgress(0)
  }, [])

  const begin = useCallback(() => {
    if (disabled || done.current) return
    const t0 = performance.now()
    const loop = () => {
      const p = Math.min(1, (performance.now() - t0) / holdMs)
      setProgress(p)
      if (p >= 1) {
        done.current = true
        raf.current = null
        navigator.vibrate?.(20)
        onDone()
        return
      }
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }, [disabled, holdMs, onDone])

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !done.current) { e.preventDefault(); done.current = true; onDone() }
      }}
      className="relative w-full h-14 rounded-full overflow-hidden bg-primary/25 text-gray-900 text-[17px] font-bold select-none touch-none disabled:opacity-40"
    >
      <span aria-hidden="true" className="absolute inset-0 bg-primary origin-left" style={{ transform: `scaleX(${progress})` }} />
      <span className="relative">{children}</span>
    </button>
  )
}
