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
    const code = searchParams.get('code')
    if (!code) {
      router.replace('/result')
      return
    }

    const supabase = getSupabase()
    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.session) {
        console.error('[auth callback] session exchange failed:', error)
        setStatus('error')
        setTimeout(() => router.replace('/result'), 1500)
        return
      }

      setStatus('migrating')
      await migrateGuestData(data.session.user.id)

      setStatus('done')
      router.replace('/result')
    })
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
