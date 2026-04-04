'use client'

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { savePendingGuestData } from '@/lib/guest-migration'

function signIn(provider: 'google' | 'kakao') {
  savePendingGuestData()
  const supabase = getSupabase()
  supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}

export default function LoginCTA() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session)
    })
  }, [])

  // 세션 확인 전 or 이미 로그인된 경우 숨김
  if (isLoggedIn === null || isLoggedIn === true) return null

  return (
    <div className="relative mx-4 mb-6 rounded-3xl overflow-hidden">
      {/* 블러 처리된 훈련 미리보기 */}
      <div className="blur-sm select-none pointer-events-none px-5 py-4 bg-secondary/60 space-y-2">
        <p className="text-xs font-bold text-foreground">맞춤 훈련 플랜</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">안정감 훈련</span>
          <span className="text-xs font-bold text-primary">74점 → 89점 가능</span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div className="h-full w-[74%] bg-primary/40 rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">발성 에너지</span>
          <span className="text-xs font-bold text-primary">61점 → 80점 가능</span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div className="h-full w-[61%] bg-primary/40 rounded-full" />
        </div>
      </div>

      {/* 그라디언트 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />

      {/* CTA 카드 */}
      <div className="relative bg-background/95 border border-border/60 rounded-3xl mx-0 px-5 py-6 -mt-4 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center shrink-0">
            <Lock size={13} className="text-white" />
          </div>
          <p className="text-xs font-semibold text-primary">로그인하면 잠금 해제</p>
        </div>

        <h3 className="text-base font-black text-foreground leading-snug mb-1">
          내 목소리의 단점 확인하고<br />
          <span className="gradient-text">맞춤 훈련 시작하기</span>
        </h3>
        <p className="text-xs text-muted-foreground mb-5">
          분석 결과 영구 저장 · 개인 훈련 플랜 · 성장 기록
        </p>

        <div className="space-y-2.5">
          {/* Google */}
          <button
            onClick={() => signIn('google')}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-2xl bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            구글로 3초 만에 시작하기
          </button>

          {/* Kakao */}
          <button
            onClick={() => signIn('kakao')}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-2xl bg-[#FEE500] text-[#191919] text-sm font-semibold hover:bg-[#FDD800] active:scale-95 transition-all shadow-sm"
          >
            <svg width="18" height="17" viewBox="0 0 18 17" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.029 0 0 3.054 0 6.818c0 2.388 1.525 4.488 3.831 5.744L2.88 16.06a.25.25 0 0 0 .373.287L7.91 13.47A10.59 10.59 0 0 0 9 13.636c4.971 0 9-3.054 9-6.818C18 3.054 13.971 0 9 0z" fill="#191919"/>
            </svg>
            카카오로 3초 만에 시작하기
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-3">
          무료 · 분석 결과 영구 저장 · 언제든 탈퇴 가능
        </p>
      </div>
    </div>
  )
}
