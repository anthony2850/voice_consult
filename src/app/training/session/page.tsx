import LoginRequired from '@/components/LoginRequired'
import SessionClient from './SessionClient'

export default function SessionPage() {
  return (
    <LoginRequired>
      <SessionClient />
    </LoginRequired>
  )
}
