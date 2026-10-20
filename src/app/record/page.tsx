import { Suspense } from 'react'
import RecordClient from './RecordClient'

export default function RecordPage() {
  return (
    <Suspense>
      <RecordClient />
    </Suspense>
  )
}
