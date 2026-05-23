export interface Persona {
  id: number
  category: string
  name: string
  description: string
  emoji: string
  /** Emotion keys (subset of ALL_EMOTIONS) — order determines radar axis order */
  emotions: string[]
  /**
   * Target percentile per emotion, 0–100 scale.
   * Matches the output of `normalizeHumeScore` — i.e., "where this emotion
   * ranks within the user's full 49-dim vector." Designed by hand per persona
   * (not derived from synthetic audio); the matching algorithm compares each
   * persona's targets against the user's per-emotion percentiles.
   */
  targetScores: Record<string, number>
  script: string
  /** Path to sample audio file under /public (optional) */
  sampleAudio?: string
}

export const PERSONAS: Persona[] = [
  {
    id: 1,
    category: '직장인 일상',
    name: '퇴근만 기다리는 신입사원',
    description: '시계만 보면서 6시를 기다리는 그 마음',
    emoji: '🕔',
    emotions: ['Tiredness', 'Boredom', 'Relief', 'Disappointment'],
    targetScores: {
      Tiredness: 82,
      Boredom: 70,
      Relief: 60,
      Disappointment: 55,
    },
    script:
      '오늘 점심 뭐 먹지... 아 벌써 4시네. 30분만 더 버티면 돼... 휴...',
  },
  {
    id: 2,
    category: '감성 폭발',
    name: '드라마 보다 우는 사람',
    description: '주인공 한 마디에 눈물부터 차오르는 감정 부자',
    emoji: '😢',
    emotions: ['Empathic Pain', 'Sadness', 'Nostalgia', 'Love'],
    targetScores: {
      'Empathic Pain': 82,
      Sadness: 75,
      Nostalgia: 60,
      Love: 60,
    },
    script:
      '어떡해 진짜... 저 둘이 헤어진다고? 아니 작가님 너무하시잖아요... 흑...',
  },
  {
    id: 3,
    category: '연애 진행 중',
    name: '썸 타는 중인 사람',
    description: '카톡 한 줄에 심장이 출렁이는 그 시기',
    emoji: '💗',
    emotions: ['Awkwardness', 'Romance', 'Anxiety', 'Excitement'],
    targetScores: {
      Awkwardness: 78,
      Romance: 75,
      Anxiety: 65,
      Excitement: 65,
    },
    script:
      '어? 카톡 왔다... 아니야 천천히 답해야지... 근데 뭐라고 답하지... 이거 너무 친해 보이려나?',
  },
  {
    id: 4,
    category: '덕질의 정수',
    name: '콘서트 직관 중인 팬',
    description: '실물 영접 순간의 그 비명',
    emoji: '🎤',
    emotions: ['Ecstasy', 'Excitement', 'Joy', 'Triumph'],
    targetScores: {
      Ecstasy: 85,
      Excitement: 82,
      Joy: 75,
      Triumph: 65,
    },
    script:
      '꺅~~ 진짜 실물 봤어! 너무 멋있어... 와 이 노래 라이브로 듣는다고? 미쳐버려!',
  },
  {
    id: 5,
    category: '인생의 쓴맛',
    name: '시험 떨어진 후 멘붕인 사람',
    description: '결과 확인 후 5분 뒤의 그 멍한 상태',
    emoji: '😶‍🌫️',
    emotions: ['Disappointment', 'Sadness', 'Realization', 'Doubt'],
    targetScores: {
      Disappointment: 82,
      Sadness: 70,
      Realization: 68,
      Doubt: 60,
    },
    script:
      '음... 그래, 다시 하면 되지... 근데 진짜 떨어졌어. 한 학기 또 같은 거 해야 하나...',
  },
  {
    id: 6,
    category: '사회적 가식',
    name: '명절에 친척 만난 사람',
    description: '취업·결혼 질문 폭격을 견디는 그 표정',
    emoji: '😅',
    emotions: ['Awkwardness', 'Embarrassment', 'Tiredness', 'Doubt'],
    targetScores: {
      Awkwardness: 82,
      Embarrassment: 72,
      Tiredness: 65,
      Doubt: 60,
    },
    script:
      '아 네... 잘 지냈어요... 취업이요? 아직 준비 중이에요... 그게... 네...',
  },
  {
    id: 7,
    category: '수다 폭주',
    name: '카페에서 어제 일 떠드는 사람',
    description: '한 시간 떠들 거리를 가져온 그 친구',
    emoji: '😄',
    emotions: ['Amusement', 'Excitement', 'Surprise (positive)', 'Awkwardness'],
    targetScores: {
      Amusement: 82,
      Excitement: 72,
      'Surprise (positive)': 65,
      Awkwardness: 55,
    },
    script:
      '야 진짜 어제 말이야! 내가 그 사람 봤거든? 근데 글쎄, 진짜 헐대박... 너무 웃겨!',
  },
  {
    id: 8,
    category: '심야 사색가',
    name: '새벽 3시 감성에 빠진 사람',
    description: '안 올린 슬픈 글 한 줄이 떠다니는 그 시간',
    emoji: '🌙',
    emotions: ['Contemplation', 'Nostalgia', 'Sadness', 'Love'],
    targetScores: {
      Contemplation: 78,
      Nostalgia: 75,
      Sadness: 62,
      Love: 60,
    },
    script:
      '그때 그 친구 잘 지내겠지... 왜 갑자기 생각났을까. 이런 밤은 참 길어요...',
  },
  {
    id: 9,
    category: '사랑 폭발',
    name: '강아지 본 직후인 사람',
    description: '귀여움 앞에 무너지는 그 목소리',
    emoji: '🐶',
    emotions: ['Adoration', 'Love', 'Joy'],
    targetScores: {
      Adoration: 85,
      Love: 78,
      Joy: 75,
    },
    script:
      '어우~ 너무 귀여워! 와~ 진짜 천사 아니에요? 한 번만 만져봐도 돼요? 어쩜 이렇게...',
  },
  {
    id: 10,
    category: '평온한 시간',
    name: '혼자 카페에서 책 읽는 사람',
    description: '커피 한 잔과 좋은 문장 한 줄이면 충분한 사람',
    emoji: '☕',
    emotions: ['Calmness', 'Contentment', 'Contemplation', 'Aesthetic Appreciation'],
    targetScores: {
      Calmness: 80,
      Contentment: 75,
      Contemplation: 72,
      'Aesthetic Appreciation': 65,
    },
    script:
      '음... 좋은 문장이네. 다시 한번 읽어볼까. 이 작가는 정말 단어를 잘 골라요...',
  },
]

/**
 * Convert a single emotion score (0–1) to a 0–100 percentile within the user's
 * full 49-emotion vector. This is how `targetScores` is interpreted at match
 * time — "how strong is this emotion relative to the user's other emotions."
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
 * For each persona, compute the mean absolute distance between the user's
 * per-emotion percentile (normalizeHumeScore) and the persona's targetScores —
 * over only the emotions that persona uses. Pick the smallest distance.
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
