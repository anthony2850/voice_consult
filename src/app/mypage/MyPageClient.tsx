'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, LogOut, ChevronRight, Dumbbell, Archive } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { LegalLinks } from '@/components/legal/LegalPage'
import { PageHeader, Pill } from '@/components/ds'
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
      <PageHeader title="마이페이지" sub="내 계정과 기록을 확인해요." />

      <div className="mt-4 px-5 space-y-4">
        {/* Profile card */}
        <section className="rounded-[28px] bg-secondary p-6 flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center flex-shrink-0">
              <User size={28} className="text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-black text-foreground truncate">{fullName}</p>
            <p className="text-[13px] text-muted-foreground truncate mt-0.5">{email}</p>
            {providerLabel && <span className="inline-block mt-2"><Pill>{providerLabel} 로그인</Pill></span>}
          </div>
        </section>

        {/* Menu items */}
        <section className="rounded-[28px] bg-secondary p-2">
          {[
            { href: '/archive', icon: Archive, label: '훈련 기록 보기' },
            { href: '/training', icon: Dumbbell, label: '내 훈련' },
          ].map(({ href, icon: Icon, label }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl active:bg-card transition-colors"
            >
              <Icon size={20} className="text-accent" aria-hidden="true" />
              <span className="flex-1 text-[15px] font-semibold text-left text-foreground">{label}</span>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          ))}
        </section>

        <p className="text-[13px] text-muted-foreground text-center leading-relaxed">구독 관리와 설정은 곧 추가될 예정이에요.</p>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 h-14 rounded-full border-2 border-border text-[15px] font-semibold text-muted-foreground active:bg-secondary transition-colors"
        >
          <LogOut size={17} />
          로그아웃
        </button>

        <LegalLinks />
      </div>
    </div>
  )
}
