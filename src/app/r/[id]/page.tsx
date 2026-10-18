import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { encodeScene, parseSceneResult } from '@/lib/voiceScene'

function encodeEmotions(emotions: Record<string, number>): string {
  const compact = Object.fromEntries(
    Object.entries(emotions).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
  )
  return btoa(encodeURIComponent(JSON.stringify(compact)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  let { data, error } = await supabase
    .from('shared_results')
    .select('emotions, scene')
    .eq('id', id)
    .single()
  // scene 컬럼 마이그레이션 전이면 감정만 읽는다.
  if (error && /scene/.test(error.message)) {
    ({ data, error } = await supabase.from('shared_results').select('emotions').eq('id', id).single())
  }

  if (!data?.emotions) redirect('/')

  const encoded = encodeEmotions(data.emotions as Record<string, number>)
  const scene = parseSceneResult((data as { scene?: unknown }).scene)
  redirect(`/result?d=${encoded}${scene ? `&s=${encodeScene(scene)}` : ''}`)
}
