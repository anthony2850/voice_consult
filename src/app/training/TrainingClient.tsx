'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PERSONAS } from '@/lib/personas'

const EMOTION_KO: Record<string, string> = {
  'Admiration': '감탄',
  'Adoration': '경애',
  'Aesthetic Appreciation': '미적 감상',
  'Amusement': '즐거움',
  'Awe': '경외감',
  'Awkwardness': '어색함',
  'Calmness': '차분함',
  'Concentration': '집중',
  'Contemplation': '사색',
  'Contentment': '만족감',
  'Craving': '갈망',
  'Determination': '결단력',
  'Disappointment': '실망',
  'Doubt': '의심',
  'Ecstasy': '황홀감',
  'Empathic Pain': '공감·아픔',
  'Enthusiasm': '열정',
  'Excitement': '흥분',
  'Interest': '호기심',
  'Joy': '기쁨',
  'Love': '사랑',
  'Nostalgia': '향수',
  'Pain': '아파함',
  'Pride': '자부심',
  'Realization': '깨달음',
  'Relief': '안도감',
  'Romance': '설렘',
  'Sympathy': '공감·위로',
  'Triumph': '승리감',
  'Surprise (positive)': '긍정 놀람',
}

// 감정별 발성 훈련 팁
const TRAINING_TIPS: Record<string, { tip: string; exercise: string }> = {
  Determination: {
    tip: '문장 끝을 흐리지 말고 또렷하게 끊어 주세요. 턱을 살짝 당기고 앞을 바라보는 자세가 도움이 돼요.',
    exercise: '"반드시 해냅니다." "지금 시작합니다." 를 3회씩, 끝음절을 강하게 내뱉으며 읽어보세요.',
  },
  Calmness: {
    tip: '말하기 전 2초 호흡을 고르고, 평소보다 20% 느린 속도로 말해 보세요.',
    exercise: '"괜찮아요. 천천히 해봐요." 를 눈을 감고 낮고 고르게 5회 반복해 보세요.',
  },
  Concentration: {
    tip: '한 문장씩 의미를 새기며 읽고, 핵심 단어에 살짝 힘을 주세요.',
    exercise: '신문 한 단락을 소리 내어 천천히 읽으며 핵심 단어마다 1음절 길게 늘이는 연습을 해 보세요.',
  },
  Realization: {
    tip: '아, 그렇구나 하는 순간처럼 목소리 끝을 자연스럽게 올렸다 내려 보세요.',
    exercise: '"아, 이제 알겠어요." 를 무릎을 탁 치는 느낌으로 5회 읽어보세요.',
  },
  Love: {
    tip: '입꼬리를 살짝 올리고 부드럽게 숨을 내쉬듯 말해 보세요.',
    exercise: '"정말 고마워요. 늘 응원해요." 를 미소 지으며 5회 읽어보세요.',
  },
  Sympathy: {
    tip: '상대방의 감정을 받아들인다는 느낌으로, 말 사이사이 짧은 호흡을 넣어 보세요.',
    exercise: '"그랬군요. 많이 힘드셨겠어요." 를 고개를 살짝 끄덕이며 5회 읽어보세요.',
  },
  'Empathic Pain': {
    tip: '목소리 볼륨을 살짝 낮추고, 말끝을 조용히 마무리해 보세요.',
    exercise: '"정말 마음이 아프네요." 를 천천히 숨을 내쉬며 5회 연습해 보세요.',
  },
  Contentment: {
    tip: '긴장을 풀고 편안한 날숨 위에 목소리를 얹는다는 느낌으로 말해 보세요.',
    exercise: '"지금 이 순간이 참 좋아요." 를 어깨를 내리며 부드럽게 5회 읽어보세요.',
  },
  Enthusiasm: {
    tip: '말하기 전 짧은 들숨으로 에너지를 채우고, 첫 음절을 또렷하게 시작해 보세요.',
    exercise: '"정말 기대돼요! 함께 해봐요!" 를 박수를 치는 느낌으로 힘차게 5회 읽어보세요.',
  },
  Excitement: {
    tip: '말의 속도를 평소보다 약간 빠르게, 끝음에 생기를 담아보세요.',
    exercise: '"믿기지 않아요, 진짜예요?" 를 눈을 크게 뜨는 느낌으로 5회 읽어보세요.',
  },
  Joy: {
    tip: '미소 짓는 입 모양 그대로 말하면 목소리에 밝음이 자연스럽게 실려요.',
    exercise: '"오늘 정말 좋은 날이에요!" 를 웃는 표정으로 5회 읽어보세요.',
  },
  Triumph: {
    tip: '가슴을 펴고 배에서 나오는 목소리로 말해 보세요.',
    exercise: '"우리가 해냈습니다!" 를 주먹을 쥐는 느낌으로 힘차게 5회 읽어보세요.',
  },
  Contemplation: {
    tip: '말 사이에 의도적인 침묵을 두고, 천천히 생각하며 말하는 듯한 리듬을 만들어 보세요.',
    exercise: '"잠깐, 생각해볼 필요가 있어요." 를 멈춤을 살려 5회 읽어보세요.',
  },
  Doubt: {
    tip: '문장 끝을 살짝 올려 물음표의 뉘앙스를 담아보세요.',
    exercise: '"정말 그게 맞는 걸까요?" 를 눈썹을 살짝 올리는 느낌으로 5회 읽어보세요.',
  },
  Pride: {
    tip: '턱을 살짝 들고 안정적인 목소리 볼륨을 유지하며 말해 보세요.',
    exercise: '"저는 이 일이 정말 자랑스럽습니다." 를 당당하게 5회 읽어보세요.',
  },
  Admiration: {
    tip: '목소리 끝을 부드럽게 올리며 감탄의 뉘앙스를 담아보세요.',
    exercise: '"정말 대단하세요, 어떻게 하셨어요?" 를 진심을 담아 5회 읽어보세요.',
  },
  Awe: {
    tip: '말하기 전 짧게 숨을 멈추고, 놀라움이 담긴 낮은 목소리로 시작해 보세요.',
    exercise: '"와… 이게 가능한 일이에요?" 를 탄식하듯 5회 읽어보세요.',
  },
  Romance: {
    tip: '말의 속도를 조금 늦추고, 부드럽고 따뜻한 호흡 위에 목소리를 얹어 보세요.',
    exercise: '"당신 곁에 있으면 참 좋아요." 를 눈을 부드럽게 하며 5회 읽어보세요.',
  },
  Adoration: {
    tip: '진심 어린 눈빛과 함께 목소리를 따뜻하게 낮춰 보세요.',
    exercise: '"정말 소중한 사람이에요." 를 마음을 담아 5회 읽어보세요.',
  },
  'Aesthetic Appreciation': {
    tip: '말의 리듬을 천천히 흐르듯 이어가고, 좋은 것을 음미하는 표정으로 말해보세요.',
    exercise: '"정말 아름답네요, 마음이 차분해져요." 를 감상하듯 5회 읽어보세요.',
  },
  Nostalgia: {
    tip: '시선을 살짝 멀리 두고, 추억을 떠올리는 듯 부드럽고 느린 호흡으로 말해보세요.',
    exercise: '"그때 생각이 나네요, 참 좋았는데." 를 회상하듯 5회 읽어보세요.',
  },
  Relief: {
    tip: '긴 날숨을 내쉬며 말하고, 어깨와 턱의 긴장을 완전히 풀어 보세요.',
    exercise: '"다행이에요, 이제 괜찮아요." 를 깊이 숨을 내쉬며 5회 읽어보세요.',
  },
  Amusement: {
    tip: '말하면서 자연스럽게 웃음기를 섞고, 문장 끝을 살짝 올려보세요.',
    exercise: '"그게 진짜예요? 너무 웃기다." 를 실제로 웃으며 5회 읽어보세요.',
  },
  Interest: {
    tip: '앞쪽으로 몸을 살짝 기울이는 느낌으로, 목소리에 호기심을 담아보세요.',
    exercise: '"오, 그래요? 더 얘기해줘요!" 를 눈을 빛내며 5회 읽어보세요.',
  },
  Craving: {
    tip: '목소리를 살짝 낮추고 간절함이 담긴 느린 속도로 말해보세요.',
    exercise: '"제발, 딱 한 번만 기회를 주세요." 를 간절히 5회 읽어보세요.',
  },
  Ecstasy: {
    tip: '온몸에 힘을 빼고 기쁨이 저절로 흘러나오는 듯 가볍게 말해보세요.',
    exercise: '"세상에, 너무너무 행복해요!" 를 팔짝 뛰는 느낌으로 5회 읽어보세요.',
  },
  Disappointment: {
    tip: '말끝을 천천히 내리며 감정을 아끼듯 조용하게 마무리해 보세요.',
    exercise: '"그럴 줄 알았는데, 역시 아쉽네요." 를 조용히 5회 읽어보세요.',
  },
  Pain: {
    tip: '목소리 볼륨을 낮추고 말 사이에 숨을 참는 느낌을 살려보세요.',
    exercise: '"정말 힘든 시간이었어요." 를 진심을 담아 천천히 5회 읽어보세요.',
  },
  'Surprise (positive)': {
    tip: '첫 음절을 높게 시작하고 에너지를 순간적으로 끌어올려 보세요.',
    exercise: '"어머, 정말요?! 믿기지 않아요!" 를 깜짝 놀란 듯 5회 읽어보세요.',
  },
  Awkwardness: {
    tip: '말을 살짝 더듬거리거나 웃음기를 살짝 섞어 친근한 어색함을 표현해 보세요.',
    exercise: '"저, 그게… 사실은 말이에요." 를 수줍게 5회 읽어보세요.',
  },
}

const DEFAULT_TIP = {
  tip: '이 감정을 목소리에 담으려면 실제로 그 감정을 느끼는 순간을 떠올리며 말해보세요.',
  exercise: '해당 감정이 담긴 짧은 문장을 직접 만들어 5회 읽어보세요.',
}

interface TrainingTarget {
  emotions: string[]
  personaId: number
}

export default function TrainingClient() {
  const router = useRouter()
  const [target, setTarget] = useState<TrainingTarget | null>(null)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('trainingTarget')
      if (stored) setTarget(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  const persona = target ? PERSONAS.find((p) => p.id === target.personaId) : null

  if (!target || target.emotions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-84px)] px-5 text-center gap-4">
        <p className="text-muted-foreground text-sm">훈련 정보를 찾을 수 없어요.</p>
        <Button variant="outline" onClick={() => router.back()} className="rounded-2xl">
          돌아가기
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] px-5 pt-6 pb-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={18} />
          </button>
          {persona && (
            <p className="text-xs font-semibold text-primary">{persona.emoji} {persona.name}</p>
          )}
        </div>
        <h1 className="text-xl font-black text-foreground leading-tight">발성 훈련</h1>
        <p className="text-sm text-muted-foreground mt-1">
          목표보다 낮은 감정을 높이는 훈련이에요
        </p>
      </div>

      {/* Emotion cards */}
      <div className="space-y-4">
        {target.emotions.map((e) => {
          const koName = EMOTION_KO[e] ?? e
          const tips = TRAINING_TIPS[e] ?? DEFAULT_TIP
          return (
            <div key={e} className="glass rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-white bg-primary/80 px-2.5 py-1 rounded-full">
                  {koName}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1">💡 훈련 포인트</p>
                  <p className="text-xs text-foreground leading-relaxed">{tips.tip}</p>
                </div>
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1">🎤 연습 문장</p>
                  <p className="text-xs text-foreground leading-relaxed">{tips.exercise}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Re-record CTA */}
      <div className="mt-6">
        <Button
          size="lg"
          onClick={() => router.push('/record')}
          className="w-full h-14 text-base font-bold rounded-2xl gradient-primary border-0 shadow-xl shadow-primary/30 active:scale-95 transition-transform gap-2"
        >
          <Mic size={20} />
          훈련 후 다시 분석해보기
        </Button>
        <p className="text-center text-[11px] text-muted-foreground mt-2">
          훈련 후 다시 녹음하면 점수 변화를 확인할 수 있어요
        </p>
      </div>
    </div>
  )
}
