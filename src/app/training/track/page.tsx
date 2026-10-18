import LoginRequired from '@/components/LoginRequired'
import TrackClient from './TrackClient'

export default function TrackPage() {
  return (
    <LoginRequired>
      <TrackClient />
    </LoginRequired>
  )
}
