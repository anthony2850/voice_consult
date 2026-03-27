'use client'

import { useRouter } from 'next/navigation'
import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MatchPage() {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-84px)] px-5 text-center gap-4">
      <span className="text-5xl">💞</span>
      <h1 className="text-xl font-bold text-foreground">목소리 궁합</h1>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        곧 두 사람의 목소리 감정 패턴을 비교하는 기능이 출시됩니다
      </p>
      <Button
        size="lg"
        onClick={() => router.push('/record')}
        className="h-12 rounded-2xl gradient-primary border-0 shadow-xl shadow-primary/30 gap-2"
      >
        <Mic size={16} />
        내 목소리 분석하기
      </Button>
    </div>
  )
}
