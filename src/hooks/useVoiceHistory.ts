'use client'

import { useState, useCallback } from 'react'
import {
  saveVoiceRecord,
  getBeforeAndAfter,
  getAllRecords,
  deleteRecord,
  VoiceRecord,
  VoiceAnalysisData,
} from '@/lib/voiceDB'

/**
 * IndexedDB 음성 기록 CRUD를 React에서 사용하기 위한 훅.
 *
 * 사용 예시:
 * ```tsx
 * const { save, fetchBeforeAndAfter, loading } = useVoiceHistory()
 * await save(audioBlob, analysisData)
 * const { before, after } = await fetchBeforeAndAfter()
 * ```
 */
export function useVoiceHistory() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | null> => {
      setLoading(true)
      setError(null)
      try {
        return await fn()
      } catch (e) {
        console.error('[useVoiceHistory]', e)
        setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요')
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /** 음성 + 분석 결과를 IndexedDB에 저장 */
  const save = useCallback(
    (audioBlob: Blob, analysisData: VoiceAnalysisData) =>
      withLoading(() => saveVoiceRecord(audioBlob, analysisData)),
    [withLoading],
  )

  /** 첫 번째(Before) + 최근(After) 기록 조회 */
  const fetchBeforeAndAfter = useCallback(
    () =>
      withLoading(() => getBeforeAndAfter()) as Promise<{
        before: VoiceRecord | null
        after: VoiceRecord | null
      } | null>,
    [withLoading],
  )

  /** 전체 기록 조회 (최신순) */
  const fetchAll = useCallback(
    () => withLoading(() => getAllRecords()) as Promise<VoiceRecord[] | null>,
    [withLoading],
  )

  /** 특정 기록 삭제 */
  const remove = useCallback(
    (id: number) => withLoading(() => deleteRecord(id)),
    [withLoading],
  )

  return { save, fetchBeforeAndAfter, fetchAll, remove, loading, error }
}
