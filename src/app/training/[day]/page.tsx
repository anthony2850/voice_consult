import LoginRequired from '@/components/LoginRequired'
import DayTrainingClient from './DayTrainingClient'

export default async function DayTrainingPage({
  params,
}: {
  params: Promise<{ day: string }>
}) {
  const { day } = await params
  const dayIndex = Math.max(0, Math.min(6, parseInt(day) - 1))
  return (
    <LoginRequired>
      <DayTrainingClient dayIndex={dayIndex} />
    </LoginRequired>
  )
}
