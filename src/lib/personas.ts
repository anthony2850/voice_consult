export interface Persona {
  id: number
  category: string
  name: string
  description: string
  emoji: string
  /** Hume AI emotion keys — order determines radar axis order */
  emotions: string[]
  /** Target score per emotion, 0–100 scale */
  targetScores: Record<string, number>
  script: string
  /** Path to sample audio file under /public (optional) */
  sampleAudio?: string
}

export const PERSONAS: Persona[] = [
  {
    id: 1,
    category: '신뢰/전문성',
    name: '프로페셔널 아나운서',
    description: '발표나 면접에서 뚝 부러지고 신뢰감을 주는 목소리',
    emoji: '📢',
    emotions: ['Determination', 'Calmness', 'Concentration', 'Realization'],
    targetScores: {
      Determination: 78,
      Calmness: 72,
      Concentration: 75,
      Realization: 60,
    },
    script:
      '안녕하십니까. 오늘 논의하실 핵심 안건을 간략히 말씀드리겠습니다. 첫째, 3분기 실적 검토. 둘째, 신규 프로젝트 방향 수립입니다. 명확하고 효율적인 논의 부탁드립니다.',
    sampleAudio: '/personas/persona-1.wav',
  },
  {
    id: 2,
    category: '공감/위로',
    name: '다정한 심야 상담가',
    description: '상대방의 말을 잘 들어주고 마음을 어루만져 주는 따뜻한 톤',
    emoji: '🌙',
    emotions: ['Love', 'Sympathy', 'Empathic Pain', 'Contentment'],
    targetScores: {
      Love: 75,
      Sympathy: 80,
      'Empathic Pain': 65,
      Contentment: 60,
    },
    script:
      '걱정하지 않아도 괜찮아요. 지금 이 순간, 당신의 마음이 어떤지 천천히 이야기해 주세요. 저는 여기서 끝까지 함께할게요. 어떤 이야기도 다 괜찮습니다.',
  },
  {
    id: 3,
    category: '에너지/활기',
    name: '인간 비타민 크리에이터',
    description: '듣기만 해도 기분이 좋아지고 텐션이 높아지는 인싸들의 목소리',
    emoji: '⚡',
    emotions: ['Enthusiasm', 'Excitement', 'Joy', 'Triumph'],
    targetScores: {
      Enthusiasm: 82,
      Excitement: 78,
      Joy: 75,
      Triumph: 60,
    },
    script:
      '여러분! 오늘 하루도 정말 잘 해내셨어요! 힘들었던 하루가 지나고 나면 반드시 더 좋은 날이 옵니다. 오늘도 여러분은 최고입니다, 진짜로요!',
  },
  {
    id: 4,
    category: '지성/논리',
    name: '냉철하고 지적인 전략가',
    description: '감정에 치우치지 않고 객관적이고 논리적으로 들리는 이성적인 톤',
    emoji: '🎯',
    emotions: ['Contemplation', 'Calmness', 'Doubt'],
    targetScores: {
      Contemplation: 78,
      Calmness: 75,
      Doubt: 55,
    },
    script:
      '데이터를 분석한 결과, 세 가지 핵심 변수를 발견했습니다. 감정적 판단을 배제하고 각 요인의 상관관계를 살펴보면, 최적의 전략이 명확하게 보입니다.',
  },
  {
    id: 5,
    category: '매력/호감',
    name: '설렘 유발 로맨티스트',
    description: '이성에게 호감을 주거나 라디오 DJ처럼 부드럽고 매력적인 톤',
    emoji: '🌹',
    emotions: ['Romance', 'Adoration', 'Aesthetic Appreciation', 'Nostalgia'],
    targetScores: {
      Romance: 78,
      Adoration: 72,
      'Aesthetic Appreciation': 68,
      Nostalgia: 62,
    },
    script:
      '처음 당신을 봤을 때부터 알았어요. 봄날 오후처럼 따뜻하고, 잔잔한 음악처럼 편안한 사람이라는 걸요. 그래서 더 오래 기억될 것 같아요.',
  },
  {
    id: 6,
    category: '리더십/카리스마',
    name: '단단하고 여유로운 리더',
    description: '크게 소리치지 않아도 좌중을 압도하고 설득력을 가지는 목소리',
    emoji: '👑',
    emotions: ['Pride', 'Determination', 'Admiration', 'Awe'],
    targetScores: {
      Pride: 72,
      Determination: 80,
      Admiration: 65,
      Awe: 60,
    },
    script:
      '우리 팀이라면 반드시 해낼 수 있습니다. 지금까지 우리가 함께 쌓아온 것들을 믿으세요. 어떤 어려움이 와도, 우리는 함께라면 이겨낼 수 있습니다.',
  },
  {
    id: 7,
    category: '친근함/소통',
    name: '편안한 동네 베프',
    description: '어색함 없이 누구나 쉽게 다가갈 수 있는 친근하고 편안한 톤',
    emoji: '🤝',
    emotions: ['Relief', 'Amusement', 'Interest'],
    targetScores: {
      Relief: 70,
      Amusement: 75,
      Interest: 72,
    },
    script:
      '야, 오늘 뭐해? 나 마침 시간 있는데 잠깐 나올 수 있어? 근처에 카페 새로 생겼는데 같이 가면 딱 좋을 것 같아서. 오랜만에 수다 좀 떨자!',
  },
  {
    id: 8,
    category: '진정성/호소',
    name: '마음을 울리는 스토리텔러',
    description: '자신의 이야기로 사람들을 깊게 몰입시키고 감동을 주는 목소리',
    emoji: '✨',
    emotions: ['Craving', 'Ecstasy', 'Disappointment', 'Pain'],
    targetScores: {
      Craving: 68,
      Ecstasy: 72,
      Disappointment: 60,
      Pain: 65,
    },
    script:
      '그날 밤을 아직도 잊을 수가 없어요. 창밖으로 빗소리가 들리고, 우리는 아무 말 없이 그냥 앉아 있었어요. 그 침묵이 그 어떤 말보다 많은 것을 담고 있었죠.',
  },
  {
    id: 9,
    category: '유쾌/센스',
    name: '센스 만점 분위기 메이커',
    description: '재치 있고 유머러스하며 대화의 분위기를 주도하는 톤',
    emoji: '😄',
    emotions: ['Surprise (positive)', 'Amusement', 'Awkwardness'],
    targetScores: {
      'Surprise (positive)': 72,
      Amusement: 80,
      Awkwardness: 55,
    },
    script:
      '잠깐, 이거 진짜 들어봐요. 제 친구가 어제 이런 말을 했는데요, 솔직히 저는 그 순간 웃음을 참을 수가 없었어요. 여러분도 분명히 공감하실 거예요!',
  },
  {
    id: 10,
    category: '우아함/기품',
    name: '세련된 갤러리 큐레이터',
    description: '조급하지 않고 고급스러우며 기품이 흘러넘치는 목소리',
    emoji: '🎨',
    emotions: ['Calmness', 'Aesthetic Appreciation', 'Contentment', 'Admiration'],
    targetScores: {
      Calmness: 75,
      'Aesthetic Appreciation': 72,
      Contentment: 68,
      Admiration: 65,
    },
    script:
      '이 작품이 전하고자 하는 것은 단순한 아름다움이 아닙니다. 고요함 속에서 찾아오는 깊은 울림이요. 천천히 바라보실수록, 더 많은 것이 보일 거예요.',
  },
]

/**
 * Convert a single Hume emotion score to a 0–100 percentile value
 * relative to all 48 emotions in the user's result.
 * This prevents clustering at 100 and gives natural variance.
 */
export function normalizeHumeScore(
  emotionName: string,
  allEmotions: Record<string, number>,
): number {
  const raw = allEmotions[emotionName] ?? 0
  const allScores = Object.values(allEmotions).sort((a, b) => a - b)
  // count how many scores are strictly below this score
  const rank = allScores.filter((s) => s < raw).length
  // percentile: 0 = lowest emotion, 100 = highest emotion
  return Math.round((rank / (allScores.length - 1)) * 100)
}

/**
 * Find the persona that best matches the user's raw emotions.
 * For each persona, compute the mean absolute distance between
 * the user's normalized scores and the persona's targetScores.
 * Returns the persona with the smallest distance, plus the similarity (0–100).
 */
export function findBestPersona(
  allEmotions: Record<string, number>,
): { persona: Persona; similarity: number } {
  let bestPersona = PERSONAS[0]
  let bestDistance = Infinity

  for (const persona of PERSONAS) {
    const distances = persona.emotions.map((e) => {
      const userScore = normalizeHumeScore(e, allEmotions)
      const target = persona.targetScores[e] ?? 0
      return Math.abs(userScore - target)
    })
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length
    if (avgDistance < bestDistance) {
      bestDistance = avgDistance
      bestPersona = persona
    }
  }

  // Convert distance (0–100) to similarity (0–100)
  const similarity = Math.round(Math.max(0, 100 - bestDistance))
  return { persona: bestPersona, similarity }
}
