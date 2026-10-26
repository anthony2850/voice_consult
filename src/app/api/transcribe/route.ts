import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

/** 발음 트랙 녹음은 길어야 20초 남짓이다. 그보다 훨씬 큰 파일은 받지 않는다. */
const MAX_BYTES = 3 * 1024 * 1024

const EXT: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' }

/**
 * 발음 트랙 녹음을 글자로 바꾼다 (OpenAI gpt-4o-mini-transcribe).
 * 로그인한 사용자만 쓸 수 있다. 녹음과 글자는 저장하지 않고, 화면에서 맞은 글자 비율만 계산한다.
 * 문장을 힌트로 주지 않는다. 주면 인식기가 문장에 맞춰 채워서 실제보다 잘 알아들은 것처럼 나온다.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: user, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user.user) return NextResponse.json({ error: 'login required' }, { status: 401 })

  const audio = await req.arrayBuffer()
  if (audio.byteLength === 0) return NextResponse.json({ error: 'empty body' }, { status: 400 })
  if (audio.byteLength > MAX_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 })

  const type = (req.headers.get('content-type') ?? 'audio/webm').split(';')[0].trim()
  const form = new FormData()
  form.append('file', new Blob([audio], { type }), `practice.${EXT[type] ?? 'webm'}`)
  form.append('model', 'gpt-4o-mini-transcribe')
  form.append('language', 'ko')
  form.append('response_format', 'json')

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) {
      console.warn('[transcribe] OpenAI returned', res.status, (await res.text()).slice(0, 200))
      return NextResponse.json({ error: 'transcription failed' }, { status: 502 })
    }
    const data = (await res.json()) as { text?: unknown }
    return NextResponse.json({ text: typeof data.text === 'string' ? data.text : '' })
  } catch (err) {
    console.warn('[transcribe] fetch failed:', err)
    return NextResponse.json({ error: 'transcription failed' }, { status: 502 })
  }
}
