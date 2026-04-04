'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getSupabase } from '@/lib/supabase'
import { migrateGuestData } from '@/lib/guest-migration'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'migrating' | 'done' | 'error'>('loading')

  useEffect(() => {
    const supabase = getSupabase()

    async function handleCallback() {
      const code = searchParams.get('code')

      if (code) {
        // PKCE flow: ?code=xxx
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error || !data.session) {
          console.error('[auth callback] PKCE exchange failed:', error)
          setStatus('error')
          setTimeout(() => router.replace('/result'), 1500)
          return
        }
        setStatus('migrating')
        await migrateGuestData(data.session.user.id)
      } else {
        // Implicit flow: #access_token=xxx (hash in URL)
        // Supabase client auto-parses the hash on getSession()
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          setStatus('migrating')
          await migrateGuestData(data.session.user.id)
        }
      }

      setStatus('done')
      router.replace('/result')
    }

    handleCallback()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">
        {status === 'loading' && '로그인 처리 중...'}
        {status === 'migrating' && '분석 데이터 저장 중...'}
        {status === 'done' && '완료! 이동 중...'}
        {status === 'error' && '로그인 중 오류가 발생했어요'}
      </p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  )
}
