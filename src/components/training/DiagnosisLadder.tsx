'use client'

import { Check, Minus } from 'lucide-react'
import { getRung, type RungLevel } from '@/lib/curriculum'
import type { DiagnosisStep } from '@/lib/trainingCycle'
import { Eyebrow, Pill } from '@/components/ds'

/**
 * 진단 결과를 단계별로 보여 준다. 어디까지 괜찮았고 어디서 흔들렸는지,
 * 그래서 몇 단계부터 시작하는지를 한눈에 잇는다.
 */
export default function DiagnosisLadder({ label, steps, start }: { label: string; steps: DiagnosisStep[]; start: RungLevel }) {
  const lastLevel = steps[steps.length - 1]?.level ?? 4
  return (
    <section className="rounded-[28px] bg-secondary p-5 space-y-3" aria-label={`${label} 단계별 결과`}>
      <Eyebrow>{label}, 단계별 결과</Eyebrow>
      <ol className="space-y-2">
        {steps.map((s) => {
          const isStart = s.level === start
          return (
            <li
              key={s.level}
              className={`flex items-center gap-3 rounded-2xl bg-card px-4 py-3 border-2 ${isStart ? 'border-accent' : 'border-transparent'}`}
            >
              <span
                className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-black tabular-nums ${
                  s.state === 'ok' ? 'bg-accent text-accent-foreground'
                  : s.state === 'off' ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground'
                }`}
              >
                {s.state === 'ok' ? <Check size={15} strokeWidth={3} aria-label="괜찮음" />
                  : s.state === 'skip' ? <Minus size={14} strokeWidth={3} aria-label="재지 않음" />
                  : s.level}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] font-bold ${s.state === 'skip' ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {s.level}단계 {getRung(s.level).title}
                </p>
                <p className="text-[12px] text-muted-foreground">{s.note}</p>
              </div>
              {isStart && <Pill tone="brand">여기서 시작</Pill>}
            </li>
          )
        })}
      </ol>
      <p className="px-1 text-[13px] text-foreground leading-relaxed">
        {start > lastLevel
          ? `${lastLevel}단계까지 기준 안이었어요. ${start}단계 ${getRung(start).title}부터 시작해요.`
          : `처음 기준을 넘은 ${start}단계부터 시작해요.`}
      </p>
    </section>
  )
}
