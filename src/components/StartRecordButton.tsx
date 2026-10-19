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
      onClick={() => trackEvent('click_start_record', { from: 'button' })}
    >
      <Button
        size="lg"
        className="w-full h-14 text-[16px] font-bold rounded-full bg-primary text-primary-foreground hover:bg-primary border-0 active:scale-95 transition-transform"
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
      onClick={() => trackEvent('click_start_record', { from: 'mic' })}
    >
      {/* pulse rings */}
      <span className="absolute w-28 h-28 rounded-full bg-primary/25 animate-ping [animation-duration:2.4s]" />
      <span className="absolute w-24 h-24 rounded-full bg-primary/30" />
      <span className="relative z-10 w-20 h-20 rounded-full bg-primary flex items-center justify-center">
        <Mic size={34} className="text-primary-foreground" strokeWidth={2} />
      </span>
    </Link>
  )
}
