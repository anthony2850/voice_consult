'use client'

import { useRouter } from 'next/navigation'
import { LogIn, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function MyPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            마이페이지
          </Badge>
          <h1 className="text-3xl font-black text-white mb-2">My Profile</h1>
          <p className="text-white/70 text-sm">로그인하면 모든 기록을 저장할 수 있어요</p>
        </div>
      </div>

      <div className="mt-4 px-4 space-y-4">
        {/* Profile placeholder */}
        <div className="glass rounded-3xl p-6 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <User size={28} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">로그인이 필요해요</p>
            <p className="text-xs text-muted-foreground mt-1">
              분석 결과·리포트·훈련 기록을 저장하고<br />어디서든 확인하세요
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => router.push('/api/auth/signin')}
            className="w-full h-12 rounded-2xl bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] border-0 font-bold active:scale-95 transition-transform gap-2 mt-1"
          >
            <LogIn size={16} />
            카카오로 시작하기
          </Button>
        </div>

        {/* Coming soon */}
        <div className="glass rounded-3xl p-5 border border-border/60 text-center">
          <p className="text-xs text-muted-foreground">🚀 회원 정보, 구매 내역, 설정 등<br />더 많은 기능이 곧 추가될 예정이에요</p>
        </div>
      </div>
    </div>
  )
}
