import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createServiceClient } from '@/lib/supabase'
import { parseSceneResult } from '@/lib/voiceScene'

export async function POST(req: NextRequest) {
  let body: { emotions?: Record<string, number>; scene?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }

  const { emotions } = body
  if (!emotions || typeof emotions !== 'object') {
    return NextResponse.json({ error: 'emotions required' }, { status: 400 })
  }
  // 받는 사람에게는 음향 값이 없으므로 보낸 사람의 장면 결과를 함께 저장한다.
  const scene = parseSceneResult(body.scene)

  const id = nanoid(8)
  const supabase = createServiceClient()
  let { error } = await supabase
    .from('shared_results')
    .insert(scene ? { id, emotions, scene } : { id, emotions })

  // scene 컬럼 마이그레이션(2026-10-18-shared-results-scene.sql) 전이면 장면 없이 저장한다.
  if (error && scene && /scene/.test(error.message)) {
    ({ error } = await supabase.from('shared_results').insert({ id, emotions }))
  }

  if (error) {
    console.error('[share] supabase error:', error)
    return NextResponse.json({ error: 'failed to save' }, { status: 500 })
  }

  return NextResponse.json({ id })
}
