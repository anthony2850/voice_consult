'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, LogOut, ChevronRight, Dumbbell, Archive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getSupabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function MyPageClient() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
  }, [])

  async function handleSignOut() {
    await getSupabase().auth.signOut()
    router.replace('/')
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const fullName = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자') as string
  const email = user?.email ?? ''
  const provider = user?.app_metadata?.provider
  const providerLabel = provider === 'google' ? '구글' : provider === 'kakao' ? '카카오' : ''

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
          <p className="text-white/70 text-sm">내 계정 정보와 활동을 확인하세요</p>
        </div>
      </div>

      <div className="mt-4 px-4 space-y-4">
        {/* Profile card */}
        <div className="glass rounded-3xl p-6 flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <User size={28} className="text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground truncate">{fullName}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>
            {providerLabel && (
              <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {providerLabel} 로그인
              </span>
            )}
          </div>
        </div>

        {/* Menu items */}
        <div className="glass rounded-3xl overflow-hidden">
          <button
            onClick={() => router.push('/archive')}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 active:bg-white/10 transition-colors border-b border-border/40"
          >
            <Archive size={18} className="text-primary" />
            <span className="flex-1 text-sm font-medium text-left">분석 기록 보기</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => router.push('/training')}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            <Dumbbell size={18} className="text-primary" />
            <span className="flex-1 text-sm font-medium text-left">훈련 플랜</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Coming soon */}
        <div className="glass rounded-3xl p-5 border border-border/60 text-center">
          <p className="text-xs text-muted-foreground">🚀 구매 내역, 설정 등<br />더 많은 기능이 곧 추가될 예정이에요</p>
        </div>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm text-muted-foreground hover:text-red-500 hover:bg-red-500/5 active:scale-95 transition-all"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </div>
  )
}
