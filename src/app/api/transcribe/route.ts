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

  // File extension must match content — Safari/iOS records mp4, others webm/ogg
  const mimeType = audioFile.type || 'audio/webm'
  const ext = mimeType.includes('mp4') ? 'm4a'
    : mimeType.includes('ogg') ? 'ogg'
    : 'webm'
  const file = new File([audioFile], `voice.${ext}`, { type: mimeType })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'ko',
  })

  return NextResponse.json({ text: transcription.text })
}
