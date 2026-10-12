'use client'

import Link from 'next/link'
import { Mic, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'

export default function StartRecordButton() {
  return (
    <Link
      href="/record"
      className="w-full max-w-[360px]"
      onClick={() => trackEvent('click_start_record', { source: 'button' })}
    >
      <Button
        size="lg"
        className="w-full h-14 text-base font-bold rounded-2xl gradient-primary border-0 shadow-2xl shadow-primary/40 active:scale-95 transition-transform"
      >
        <Mic size={20} className="mr-2" />
        내 목소리 분석하기
        <ChevronRight size={18} className="ml-1 opacity-70" />
      </Button>
    </Link>
  )
}

// The hero mic looks tappable, so users tap it expecting to start recording —
// honour that instead of ignoring the tap (Postel's law).
export function StartRecordMic() {
  return (
    <Link
      href="/record"
      aria-label="내 목소리 분석 시작하기"
      className="relative flex items-center justify-center mb-8 active:scale-95 transition-transform"
      onClick={() => trackEvent('click_start_record', { source: 'mic' })}
    >
      {/* pulse rings */}
      <span className="absolute w-36 h-36 rounded-full gradient-primary opacity-10 animate-ping" />
      <span className="absolute w-28 h-28 rounded-full gradient-primary opacity-15 animate-ping [animation-delay:0.3s]" />
      <span className="relative z-10 w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-2xl shadow-primary/40">
        <Mic size={34} className="text-white" strokeWidth={2} />
      </span>
    </Link>
  )
}
