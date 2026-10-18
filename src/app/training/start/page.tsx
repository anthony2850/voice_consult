import LoginRequired from '@/components/LoginRequired'
import StartClient from './StartClient'

export default function StartPage() {
  return (
    <LoginRequired>
      <StartClient />
    </LoginRequired>
  )
}
