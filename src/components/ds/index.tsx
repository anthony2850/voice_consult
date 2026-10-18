'use client'

/**
 * MyTone 디자인 시스템 부품 (2026-10-18).
 * 규칙은 src/app/globals.css 머리 주석 참고. 한 화면에 하나만 말하고, 색은 버튼과 머리말에만.
 */
import {
  AudioWaveform, Briefcase, Check, ChevronLeft, Gauge, MessageCircle, MessagesSquare, Phone, Presentation, Volume1,
  type LucideIcon,
} from 'lucide-react'
import type { ConcernSlug, Scene } from '@/lib/curriculum'

export { OptionCard, PrimaryButton, HoldButton } from '@/components/onboarding/OnboardingParts'

/** 제목 위 작은 머리말 */
export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>
}

/** 화면의 큰 제목. 아주 굵게, 줄바꿈은 \n */
export function Display({ children, sub, center = true }: { children: React.ReactNode; sub?: React.ReactNode; center?: boolean }) {
  return (
    <div className={center ? 'text-center' : ''}>
      <h1 className="text-[32px] leading-[1.18] font-black tracking-[-0.03em] text-foreground whitespace-pre-line">{children}</h1>
      {sub && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** 연회색 면 카드 */
export function SurfaceCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[28px] bg-secondary p-6 ${className}`}>{children}</div>
}

type PillTone = 'brand' | 'good' | 'caution' | 'neutral' | 'data'
const PILL: Record<PillTone, string> = {
  brand: 'bg-primary text-primary-foreground',
  good: 'bg-good-tint text-good',
  caution: 'bg-caution-tint text-caution',
  neutral: 'bg-white text-muted-foreground border border-border',
  data: 'bg-accent text-accent-foreground',
}
export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: PillTone }) {
  return <span className={`inline-flex items-center shrink-0 text-[12px] font-bold px-2.5 py-1 rounded-full ${PILL[tone]}`}>{children}</span>
}

/** 왼쪽 이름, 오른쪽 큰 숫자. 숫자는 고정폭. */
export function MetricRow({ label, value, unit, pill }: { label: string; value: string; unit?: string; pill?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-b-0">
      <span className="flex-1 min-w-0 text-[15px] font-semibold text-foreground">{label}</span>
      {pill}
      <span className="text-[24px] font-black tracking-[-0.02em] text-foreground tabular-nums">
        {value}{unit && <span className="ml-0.5 text-[13px] font-semibold text-muted-foreground">{unit}</span>}
      </span>
    </div>
  )
}

/** 굵은 진행 막대. 남색. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="h-3 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** 차례로 켜지는 체크 목록. done 개수만큼 체크, 그다음 하나는 진행 중 표시. */
export function Checklist({ items, done }: { items: string[]; done: number }) {
  return (
    <ol className="space-y-4" aria-live="polite">
      {items.map((t, i) => {
        const state = i < done ? 'done' : i === done ? 'now' : 'todo'
        return (
          <li key={t} className="flex items-start gap-3.5">
            <span aria-hidden="true" className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
              state === 'done' ? 'bg-accent text-accent-foreground' : state === 'now' ? 'border-2 border-accent border-t-transparent animate-spin' : 'border-2 border-border'
            }`}>
              {state === 'done' && <Check size={16} strokeWidth={3} />}
            </span>
            <span className={`text-[16px] leading-snug font-semibold ${state === 'todo' ? 'text-muted-foreground/60' : 'text-foreground'}`}>
              {t}
              <span className="sr-only">{state === 'done' ? ' 완료' : state === 'now' ? ' 진행 중' : ''}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** 보상의 순간에만 쓰는 버튼 (한 화면 한 곳). */
export function SpecialButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-14 rounded-full gradient-special text-primary-foreground text-[17px] font-bold active:scale-[0.98] transition-transform disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/**
 * 화면 머리 영역 — 예전 청록 그라데이션 머리를 대신한다. 흰 바탕, 왼쪽 정렬, 아주 굵은 제목.
 * 한 가지에 집중하는 화면(온보딩, 기준점)은 Display를 가운데 정렬로 쓴다.
 */
export function PageHeader({ back, eyebrow, title, sub, chips }: {
  back?: { label: string; onClick: () => void }
  eyebrow?: React.ReactNode
  title: React.ReactNode
  sub?: React.ReactNode
  chips?: React.ReactNode
}) {
  return (
    <header className="px-5 pt-6 pb-2">
      {back && (
        <button type="button" onClick={back.onClick} className="-ml-2 mb-3 h-10 px-2 flex items-center gap-0.5 rounded-full text-[14px] font-semibold text-muted-foreground active:bg-secondary">
          <ChevronLeft size={20} aria-hidden="true" />{back.label}
        </button>
      )}
      {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
      <h1 className="text-[28px] leading-[1.2] font-black tracking-[-0.03em] text-foreground">{title}</h1>
      {sub && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{sub}</p>}
      {chips && <div className="mt-4 flex flex-wrap items-center gap-2">{chips}</div>}
    </header>
  )
}

/** 상황과 고민의 선 아이콘 (이모지 대신) */
export const SCENE_ICON: Record<Scene, LucideIcon> = { interview: Briefcase, presentation: Presentation, call: Phone, daily: MessagesSquare }
export const CONCERN_ICON: Record<ConcernSlug, LucideIcon> = { trembling: AudioWaveform, small_voice: Volume1, fast: Gauge, diction: MessageCircle }
