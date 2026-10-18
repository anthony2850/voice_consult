'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Archive, Dumbbell, TrendingUp } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { savePendingGuestData } from '@/lib/guest-migration'
import { trackEvent } from '@/lib/analytics'
import { setPostLoginPath } from '@/lib/postLogin'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/** OAuth 로그인. 끝나면 nextPath(기본: 지금 화면)로 돌아온다. */
export function signIn(provider: 'google' | 'kakao', nextPath?: string, source = 'login_required') {
  trackEvent('login_clicked', { method: provider, source })
  savePendingGuestData()
  setPostLoginPath(nextPath ?? `${window.location.pathname}${window.location.search}`)
  getSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export default function LoginRequired({ children, guestRedirect }: {
  children: React.ReactNode
  /** 있으면 로그인 화면 대신 이 경로로 보낸다 (예: 훈련 탭 → 온보딩) */
  guestRedirect?: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'guest' | 'authed'>('loading')
  useEffect(() => {
    if (status === 'guest' && guestRedirect) router.replace(guestRedirect)
  }, [status, guestRedirect, router])

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

  if (status === 'loading' || (status === 'guest' && guestRedirect)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-84px)]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (status === 'guest') {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)] px-5 pt-14 pb-8">
        <div className="text-center">
          <Image src="/logo.png" alt="MyTone" width={108} height={36} className="mx-auto object-contain mb-6" />
          <h1 className="text-[30px] leading-[1.2] font-black tracking-[-0.03em] text-foreground">로그인이 필요해요</h1>
          <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
            기록 저장, 맞춤 훈련, 마이페이지는<br />로그인 후 이용할 수 있어요
          </p>
        </div>

        <section className="mt-8 rounded-[28px] bg-secondary p-6 space-y-4">
          {[
            { icon: Archive, text: '분석과 훈련 기록이 계정에 남아요' },
            { icon: Dumbbell, text: '내 목소리에 맞춘 훈련 계획' },
            { icon: TrendingUp, text: '쉬고 난 뒤에도 남은 실력을 추이로 확인' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-card flex items-center justify-center"><Icon size={18} className="text-accent" aria-hidden="true" /></span>
              <span className="text-[15px] font-semibold text-foreground">{text}</span>
            </div>
          ))}
        </section>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => signIn('google')}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-full bg-white border border-gray-200 text-gray-800 text-[16px] font-semibold active:scale-[0.98] transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            구글로 로그인하기
          </button>
          <button
            onClick={() => signIn('kakao')}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-full bg-[#FEE500] text-[#191919] text-[16px] font-semibold active:scale-[0.98] transition-transform"
          >
            <svg width="18" height="17" viewBox="0 0 18 17" fill="none" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.029 0 0 3.054 0 6.818c0 2.388 1.525 4.488 3.831 5.744L2.88 16.06a.25.25 0 0 0 .373.287L7.91 13.47A10.59 10.59 0 0 0 9 13.636c4.971 0 9-3.054 9-6.818C18 3.054 13.971 0 9 0z" fill="#191919"/>
            </svg>
            카카오로 로그인하기
          </button>
        </div>

        <p className="text-[12px] text-muted-foreground text-center mt-5 leading-relaxed">
          로그인하면 만 14세 이상이며{' '}
          <Link href="/terms" className="underline underline-offset-2">이용약관</Link>과{' '}
          <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link>에<br />동의한 것으로 봐요.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
