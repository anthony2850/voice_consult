'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { savePendingGuestData } from '@/lib/guest-migration'

function signIn(provider: 'google' | 'kakao') {
  savePendingGuestData()
  getSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export default function LoginRequired({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'guest' | 'authed'>('loading')

  useEffect(() => {
    const supabase = getSupabase()

    // 현재 세션 즉시 확인
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'authed' : 'guest')
    })

    // 세션 변화 실시간 감지 (로그인/로그아웃 즉시 반영)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setStatus(session ? 'authed' : 'guest')
    })

    return () => subscription.unsubscribe()
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-84px)]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (status === 'guest') {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)] px-5 pb-8">
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-12 pb-8 -mx-5 mb-6 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-black text-white mb-2">로그인이 필요해요</h1>
            <p className="text-white/70 text-sm">
              분석 기록 저장, 맞춤 훈련, 마이페이지는<br />로그인 후 이용할 수 있어요
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="glass rounded-3xl p-5 mb-4 space-y-3">
          {[
            { emoji: '📊', text: '분석 결과 영구 저장' },
            { emoji: '💪', text: '내 목소리 맞춤 훈련 플랜' },
            { emoji: '📈', text: '성장 기록 & 히스토리' },
          ].map(({ emoji, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-xl">{emoji}</span>
              <span className="text-sm text-foreground font-medium">{text}</span>
            </div>
          ))}
        </div>

        {/* Login buttons */}
        <div className="space-y-3">
          <button
            onClick={() => signIn('google')}
            className="w-full h-13 flex items-center justify-center gap-3 rounded-2xl bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            구글로 로그인하기
          </button>

          <button
            onClick={() => signIn('kakao')}
            className="w-full h-13 flex items-center justify-center gap-3 rounded-2xl bg-[#FEE500] text-[#191919] text-sm font-semibold hover:bg-[#FDD800] active:scale-95 transition-all shadow-sm"
          >
            <svg width="18" height="17" viewBox="0 0 18 17" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.029 0 0 3.054 0 6.818c0 2.388 1.525 4.488 3.831 5.744L2.88 16.06a.25.25 0 0 0 .373.287L7.91 13.47A10.59 10.59 0 0 0 9 13.636c4.971 0 9-3.054 9-6.818C18 3.054 13.971 0 9 0z" fill="#191919"/>
            </svg>
            카카오로 로그인하기
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          무료 · 언제든 탈퇴 가능
        </p>
      </div>
    )
  }

  return <>{children}</>
}
