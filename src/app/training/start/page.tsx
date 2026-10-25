import { Suspense } from 'react'
import LoginRequired from '@/components/LoginRequired'
import StartClient from './StartClient'

export default function StartPage() {
  return (
    <LoginRequired>
      <Suspense>
        <StartClient />
      </Suspense>
    </LoginRequired>
  )
}
