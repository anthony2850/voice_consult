'use client'

import { useEffect, useState } from 'react'

const VARIANTS = [
  {
    headline: ['지금 면접보면', '합격할 확률은?'],
    highlight: 1,
    desc: '목소리 자신감·안정감·집중도를 AI가 측정해\n면접관이 느끼는 첫인상을 분석해드려요',
  },
  {
    headline: ['남이 듣는 내 목소리는', '호감형일까?'],
    highlight: 1,
    desc: '상대방이 내 목소리에서 느끼는 감정을 AI가 분석해\n당신의 호감도 패턴을 알려드려요',
  },
  {
    headline: ['관상은 과학이다', '그렇다면 목소리는?'],
    highlight: 1,
    desc: '목소리 톤·리듬·에너지를 AI가 분석해\n당신만의 Voice Emotion을 알려드려요',
  },
]

export default function HomeHero() {
  const [variant, setVariant] = useState(VARIANTS[0])

  useEffect(() => {
    setVariant(VARIANTS[Math.floor(Math.random() * VARIANTS.length)])
  }, [])

  return (
    <>
      <h1 className="text-[2rem] font-black leading-tight tracking-tight mb-3">
        {variant.headline.map((line, i) => (
          <span key={i}>
            {i === variant.highlight
              ? <span className="gradient-text">{line}</span>
              : <span className="text-foreground">{line}</span>
            }
            {i < variant.headline.length - 1 && <br />}
          </span>
        ))}
      </h1>

      <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-[280px]">
        {variant.desc.split('\n').map((line, i) => (
          <span key={i}>{line}{i === 0 && <br />}</span>
        ))}
      </p>
    </>
  )
}
