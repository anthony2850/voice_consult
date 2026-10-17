import { Suspense } from 'react'
import LoginRequired from '@/components/LoginRequired'
import DiagnoseClient from './DiagnoseClient'

export default function DiagnosePage() {
  return (
    <LoginRequired>
      <Suspense>
        <DiagnoseClient />
      </Suspense>
    </LoginRequired>
  )
}
