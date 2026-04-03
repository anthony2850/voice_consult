import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'

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
  const { data } = await supabase
    .from('shared_results')
    .select('emotions')
    .eq('id', id)
    .single()

  if (!data?.emotions) redirect('/')

  const encoded = encodeEmotions(data.emotions as Record<string, number>)
  redirect(`/result?d=${encoded}`)
}
