'use client'

import Link from 'next/link'
import { Mic, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'

export default function StartRecordButton() {
  return (
    <Link
      href="/persona"
      className="w-full max-w-[360px]"
      onClick={() => trackEvent('click_start_record')}
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
