import LoginRequired from '@/components/LoginRequired'
import TrainingClient from './TrainingClient'

export default function TrainingPage() {
  return (
    <LoginRequired>
      <TrainingClient />
    </LoginRequired>
  )
}
