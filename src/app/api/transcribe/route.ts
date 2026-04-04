import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'audio file required' }, { status: 400 })
  }

  const audioFile = formData.get('audio') as Blob | null
  if (!audioFile) {
    return NextResponse.json({ error: 'audio file required' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey })
  const file = new File([audioFile], 'voice.webm', { type: audioFile.type || 'audio/webm' })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'ko',
  })

  return NextResponse.json({ text: transcription.text })
}
