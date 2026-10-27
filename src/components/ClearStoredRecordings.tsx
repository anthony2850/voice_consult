'use client'

import { useEffect } from 'react'
import { clearStoredRecordings } from '@/lib/voiceDB'

/** 예전에 기기에 쌓인 원본 녹음을 한 번 지운다 (voiceDB.ts 참고). 화면에는 아무것도 그리지 않는다. */
export default function ClearStoredRecordings() {
  useEffect(() => { clearStoredRecordings() }, [])
  return null
}
