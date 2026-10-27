import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import ResultClient from '@/app/result/ResultClient'

/**
 * 공유 링크. 결과를 이 주소에서 바로 보여 준다.
 * 예전에는 감정 점수를 주소(/result?d=…)에 실어 보내서, 주소째 분석 도구와 접속 기록에 남았다.
 */
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

  return (
    <Suspense>
      <ResultClient shared={{ emotions: data.emotions, scene: (data as { scene?: unknown }).scene ?? null }} />
    </Suspense>
  )
}
