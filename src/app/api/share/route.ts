import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  let body: { emotions?: Record<string, number> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }

  const { emotions } = body
  if (!emotions || typeof emotions !== 'object') {
    return NextResponse.json({ error: 'emotions required' }, { status: 400 })
  }

  const id = nanoid(8)
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('shared_results')
    .insert({ id, emotions })

  if (error) {
    console.error('[share] supabase error:', error)
    return NextResponse.json({ error: 'failed to save' }, { status: 500 })
  }

  return NextResponse.json({ id })
}
