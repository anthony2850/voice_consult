'use client'

import { Check, Lock } from 'lucide-react'
import { LADDER, getRung, type RungLevel } from '@/lib/curriculum'
import { PrimaryButton } from '@/components/ds'

/** 받침이 있으면 '을', 없으면 '를' */
function eulReul(word: string): string {
  const c = word.replace(/[^가-힣]/g, '').slice(-1)
  if (!c) return '를'
  return (c.charCodeAt(0) - 0xac00) % 28 === 0 ? '를' : '을'
}

/** 단계를 마치고 다음 단계로 올라갈 때 보여 주는 완료 화면. 축하보다 어디까지 왔는지를 알린다. */
export default function RungComplete({ from, to, onClose }: { from: RungLevel; to: RungLevel; onClose: () => void }) {
  const nextTitle = getRung(to).title
  return (
    <div className="fixed inset-0 z-[60] mx-auto w-full max-w-[480px] bg-background flex flex-col" role="dialog" aria-modal="true" aria-labelledby="rung-done-title">
      <div className="flex-1 overflow-y-auto px-5 pt-16 pb-6">
        <span className="mx-auto w-20 h-20 rounded-full bg-accent flex items-center justify-center" aria-hidden="true">
          <Check size={38} strokeWidth={3} className="text-accent-foreground" />
        </span>
        <h2 id="rung-done-title" className="mt-5 text-center text-[26px] font-black tracking-[-0.02em] text-foreground">{from}단계 완료</h2>
        <p className="mt-1.5 text-center text-[15px] leading-relaxed text-muted-foreground">
          다음 연습부터 {to}단계 {nextTitle}{eulReul(nextTitle)} 해요.
        </p>

        <ol className="mt-8 rounded-[24px] border border-border divide-y divide-border">
          {LADDER.map((r) => {
            const state = r.level <= from ? 'done' : r.level === to ? 'next' : 'later'
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-black tabular-nums ${
                  state === 'done' ? 'bg-accent text-accent-foreground' : state === 'next' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/50'
                }`}>
                  {state === 'done' ? <Check size={15} strokeWidth={3} aria-label="완료" /> : state === 'later' ? <Lock size={16} aria-label="아직" /> : r.level}
                </span>
                <span className={`flex-1 min-w-0 text-[15px] font-semibold ${state === 'later' ? 'text-muted-foreground/60' : 'text-foreground'}`}>
                  {r.level}단계 {r.title}
                </span>
                {state === 'done' && <span className="shrink-0 text-[13px] font-bold text-accent">완료</span>}
                {state === 'next' && <span className="shrink-0 text-[13px] font-bold text-brand-text">다음 연습</span>}
              </li>
            )
          })}
        </ol>
      </div>
      <div className="shrink-0 px-5 pt-2 pb-[max(env(safe-area-inset-bottom),24px)]">
        <PrimaryButton onClick={onClose}>확인</PrimaryButton>
      </div>
    </div>
  )
}
