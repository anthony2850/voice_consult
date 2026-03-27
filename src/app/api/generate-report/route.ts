import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function topEmotions(emotions: Record<string, number>, n = 10) {
  return Object.entries(emotions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, score]) => `${name}: ${(score * 100).toFixed(1)}%`)
    .join(', ')
}

export async function POST(req: NextRequest) {
  const { emotions } = await req.json() as {
    emotions: Record<string, number> | null
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ report: getMockReport() })
  }

  const emotionContext = emotions
    ? `주요 감정 지표 (Hume AI 분석): ${topEmotions(emotions)}`
    : '감정 데이터 없음'

  const prompt = `당신은 목소리 심리 분석 전문가입니다. 아래 Hume AI 음성 감정 분석 데이터를 바탕으로 상세 분석 리포트를 작성해주세요.

**${emotionContext}**

다음 5개 섹션으로 리포트를 작성해주세요. 각 섹션은 실용적이고 개인화된 인사이트를 2~4문장으로 담아주세요. 친근하고 공감 가는 톤으로 써주세요.

## 🎙 목소리가 말하는 나의 본모습
(감정 패턴이 드러내는 성격과 내면의 특성)

## 💬 대인관계에서 내 목소리의 영향
(상대방이 내 목소리에서 어떤 인상을 받는지, 소통 방식의 강점과 주의점)

## ⚡ 스트레스 상황에서 목소리 변화
(감정이 격해질 때 목소리에 어떤 변화가 생기고, 어떻게 관리하면 좋은지)

## 💼 직업/커리어에서 목소리 활용법
(이 감정 패턴이 잘 맞는 역할과 커리어 인사이트)

## 🌱 목소리로 성장하는 방법
(목소리를 더 매력적으로 만들기 위한 구체적인 연습 팁 2~3가지)

JSON이나 마크다운 코드블록 없이, 섹션 제목과 내용만 작성해주세요.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })

  const report = message.content[0].type === 'text' ? message.content[0].text : getMockReport()
  return NextResponse.json({ report })
}

function getMockReport(): string {
  return `## 🎙 목소리가 말하는 나의 본모습
목소리에서 감지된 감정 패턴은 내면의 풍부한 감수성을 드러내고 있어요. 평소 감정을 섬세하게 인식하고, 상황에 따라 유연하게 반응하는 경향이 있어요.

## 💬 대인관계에서 내 목소리의 영향
상대방은 당신의 목소리에서 진정성과 따뜻함을 느낍니다. 감정이 자연스럽게 목소리에 실리기 때문에 신뢰감을 주는 소통이 가능해요.

## ⚡ 스트레스 상황에서 목소리 변화
스트레스를 받을 때 목소리 톤이 평소보다 높아지거나 말 속도가 빨라지는 경향이 있어요. 심호흡을 한 번 하고 말을 시작하면 더 안정적인 인상을 줄 수 있어요.

## 💼 직업/커리어에서 목소리 활용법
감정 표현이 풍부한 목소리는 발표, 상담, 교육 분야에서 특히 강점을 발휘해요. 목소리의 자연스러운 에너지를 살려 청중의 집중을 이끌어내는 역할에 잘 맞아요.

## 🌱 목소리로 성장하는 방법
1. 매일 3분씩 복식호흡 연습으로 목소리 안정감을 높여보세요.
2. 녹음해서 들어보며 말 속도와 억양 패턴을 체크해보세요.
3. 대화 시 상대방의 눈을 보며 말하면 목소리에 자신감이 생겨요.`
}
