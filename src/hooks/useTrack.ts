'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { ConcernSlug, RungLevel, Scene } from '@/lib/curriculum'
import { planTrackSwitch, type Measure, type SwitchPlan, type VoiceUse } from '@/lib/trainingCycle'

export interface TrackProfile {
  scene: Scene | null
  trackConcern: ConcernSlug | null
  trackRung: RungLevel | null
  trackStartedAt: string | null
  baseline: Measure | null
}

/** training_sessions 한 행 — 관찰일지 (4교시 54, 55쪽) */
export interface TrainingSessionRow {
  id: string
  created_at: string
  session_date: string
  kind: 'diagnosis' | 'session'
  concern: ConcernSlug | null
  scene: Scene | null
  rung: RungLevel | null
  session_index: number | null
  voice_use: VoiceUse | null
  variation_id: string | null
  retention: Measure | null
  performance: Measure | null
  rung_measures: Measure[] | null
  effort: number | null
  pain: boolean
  met_criterion: boolean | null
  next_rung: RungLevel | null
}

export type NewSessionRow = Omit<TrainingSessionRow, 'id' | 'created_at' | 'session_date'>

const EMPTY_PROFILE: TrackProfile = {
  scene: null, trackConcern: null, trackRung: null, trackStartedAt: null, baseline: null,
}

export function useTrack() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<TrackProfile>(EMPTY_PROFILE)
  const [sessions, setSessions] = useState<TrainingSessionRow[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUserId(null)
        setProfile(EMPTY_PROFILE)
        setSessions([])
        return
      }
      setUserId(user.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const [{ data: p }, { data: s }] = await Promise.all([
        db.from('user_profiles')
          .select('scene, track_concern, track_rung, track_started_at, baseline')
          .eq('user_id', user.id)
          .maybeSingle(),
        db.from('training_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
      ])
      setProfile({
        scene: p?.scene ?? null,
        trackConcern: p?.track_concern ?? null,
        trackRung: p?.track_rung ?? null,
        trackStartedAt: p?.track_started_at ?? null,
        baseline: p?.baseline ?? null,
      })
      setSessions((s ?? []) as TrainingSessionRow[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const upsertProfile = useCallback(async (patch: Record<string, unknown>) => {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_profiles')
      .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' })
    if (error) {
      console.error('[useTrack] profile save failed:', error)
      return false
    }
    return true
  }, [])

  const startTrack = useCallback(async (args: {
    concern: ConcernSlug; rung: RungLevel; baseline: Measure | null; scene: Scene
  }) => {
    const startedAt = new Date().toISOString()
    const ok = await upsertProfile({
      scene: args.scene,
      track_concern: args.concern,
      track_rung: args.rung,
      track_started_at: startedAt,
      baseline: args.baseline,
    })
    if (ok) {
      setProfile({
        scene: args.scene, trackConcern: args.concern, trackRung: args.rung,
        trackStartedAt: startedAt, baseline: args.baseline,
      })
    }
    return ok
  }, [upsertProfile])

  const setTrackRung = useCallback(async (rung: RungLevel) => {
    const ok = await upsertProfile({ track_rung: rung })
    if (ok) setProfile((p) => ({ ...p, trackRung: rung }))
    return ok
  }, [upsertProfile])

  const clearTrack = useCallback(async () => {
    const ok = await upsertProfile({ track_concern: null, track_rung: null, track_started_at: null, baseline: null })
    if (ok) setProfile((p) => ({ ...p, trackConcern: null, trackRung: null, trackStartedAt: null, baseline: null }))
    return ok
  }, [upsertProfile])

  /** 관찰일지 저장 */
  const insertSession = useCallback(async (row: NewSessionRow) => {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('training_sessions').insert({ user_id: user.id, ...row }).select().single()
    if (error) {
      console.error('[useTrack] session save failed:', error)
      return false
    }
    if (data) setSessions((cur) => [data as TrainingSessionRow, ...cur])
    return true
  }, [])

  /**
   * 현재 트랙(상황 × 고민)의 세션만, 최신순. 트랙을 바꿨다 돌아와도 기록이 이어진다.
   * 상황마다 기준 문장이 달라서, 시작/마무리 녹음 비교는 같은 상황끼리만 한다.
   */
  const trackSessions = useMemo(() => {
    if (!profile.trackConcern || !profile.scene) return []
    return sessions.filter((s) => s.kind === 'session' && s.concern === profile.trackConcern && s.scene === profile.scene)
  }, [sessions, profile.trackConcern, profile.scene])

  /** 트랙을 바꿀 때 진단이 필요한지, 어느 단계에서 시작할지 */
  const planSwitch = useCallback(
    (next: { scene: Scene; concern: ConcernSlug }): SwitchPlan => planTrackSwitch(next.concern, next.scene, sessions),
    [sessions],
  )

  /** 진단 없이 트랙을 바꾼다 (resume, reuse, 또는 재진단을 건너뛴 경우) */
  const switchTrack = useCallback(async (
    next: { scene: Scene; concern: ConcernSlug }, rung: RungLevel, baseline: Measure | null,
  ) => startTrack({ concern: next.concern, rung, baseline, scene: next.scene }), [startTrack])

  return {
    loading, userId, profile, sessions, trackSessions,
    refresh, startTrack, planSwitch, switchTrack, setTrackRung, clearTrack, insertSession,
  }
}
