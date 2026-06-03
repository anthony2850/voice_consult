import { notFound } from 'next/navigation'
import SessionPlayer from '@/components/training/SessionPlayer'
import { getDay } from '@/lib/curriculum'

export default async function Page({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params
  const dayNum = parseInt(day, 10)
  const trainingDay = getDay(dayNum)
  if (!trainingDay) notFound()

  return (
    <div className="min-h-[calc(100vh-84px)]">
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <p className="text-white/80 text-xs mb-1">Day {trainingDay.dayNum} / 5</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{trainingDay.emoji}</span>
            <h1 className="text-xl font-black text-white">{trainingDay.theme}</h1>
          </div>
          <p className="text-white/80 text-xs mt-2 leading-relaxed">{trainingDay.subtitle}</p>
        </div>
      </div>
      <SessionPlayer day={trainingDay} />
    </div>
  )
}
