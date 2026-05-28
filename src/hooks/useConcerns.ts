'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { ConcernSlug } from '@/lib/curriculum'

interface UseConcernsResult {
  concerns: ConcernSlug[]
  loading: boolean
  save: (next: ConcernSlug[]) => Promise<void>
  refresh: () => Promise<void>
}

export function useConcerns(): UseConcernsResult {
  const [concerns, setConcerns] = useState<ConcernSlug[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setConcerns([])
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_profiles')
        .select('concerns')
        .eq('user_id', user.id)
        .maybeSingle()
      setConcerns((data?.concerns ?? []) as ConcernSlug[])
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (next: ConcernSlug[]) => {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        concerns: next,
        concerns_set_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    if (error) {
      console.error('[useConcerns] save failed:', error)
      return
    }
    setConcerns(next)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { concerns, loading, save, refresh }
}
