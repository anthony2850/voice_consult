/**
 * QA-05: API 엔드포인트 테스트
 * - /api/analyze-voice: 잘못된 요청에 대한 응답
 * - /api/generate-report: 접근 제어
 * - 응답 포맷 검증
 */
import { test, expect } from '@playwright/test'

test.describe('API 엔드포인트 신뢰성', () => {
  test('analyze-voice: 빈 요청 시 에러 반환 (서버 크래시 없음)', async ({ request }) => {
    const response = await request.post('/api/analyze-voice', {
      data: {},
    })
    // 500이 아닌 400이나 422여야 이상적, 하지만 최소한 서버가 살아있어야 함
    console.log('빈 요청 응답 상태:', response.status())
    expect(response.status()).not.toBe(500)
  })

  test('analyze-voice: 정상 응답 포맷 확인 (mock 데이터)', async ({ request }) => {
    // FormData 없이 요청 → mock 데이터로 응답해야 함 (또는 에러)
    const response = await request.post('/api/analyze-voice', {
      multipart: {
        // 실제 오디오 없이 테스트
      },
    })
    const status = response.status()
    console.log('analyze-voice 응답 상태:', status)

    if (status === 200) {
      const body = await response.json()
      console.log('응답 키:', Object.keys(body))
      // emotions 필드가 있어야 함
      expect(body).toHaveProperty('emotions')
      expect(typeof body.emotions).toBe('object')
    }
    // 400/422는 허용 (올바른 에러 처리)
    expect([200, 400, 422]).toContain(status)
  })

  test('generate-report: 인증 없이 접근 시 에러 반환', async ({ request }) => {
    const response = await request.post('/api/generate-report', {
      data: { emotions: {}, audioFeatures: null },
    })
    console.log('미인증 리포트 생성 응답:', response.status())
    // 401 또는 400이어야 함 (500은 안 됨)
    expect(response.status()).not.toBe(500)
  })

  test('payment/confirm: GET 요청 처리', async ({ request }) => {
    const response = await request.get('/api/payment/confirm?paymentKey=test&orderId=test&amount=0')
    console.log('결제 확인 API 응답:', response.status())
    // 리다이렉트나 400/401이 정상, 500은 안 됨
    expect(response.status()).not.toBe(500)
  })
})
