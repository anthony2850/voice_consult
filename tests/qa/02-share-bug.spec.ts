/**
 * QA-02: 결과 데이터 신뢰성 및 공유 링크
 *
 * 재현 시나리오:
 *   1. 사용자가 음성 분석 → 특정 페르소나 배정
 *   2. 공유 버튼 → 분석 데이터가 포함된 공유 URL 생성
 *   3. 친구가 해당 URL 접속 → 다른 세션이므로 sessionStorage 없음
 *   4. 분석 데이터 없는 직접 접근에는 재녹음 안내 출력
 *
 * 기대 결과: 공유받은 사람도 동일한 페르소나를 봐야 함
 * 기대 결과: 가짜 감정 데이터나 임의의 페르소나를 만들지 않음
 */
import { test, expect } from '@playwright/test'

const MOCK_EMOTIONS = {
  Enthusiasm: 0.9,
  Excitement: 0.85,
  Joy: 0.8,
  Triumph: 0.75,
  Amusement: 0.7,
  Admiration: 0.5,
  Interest: 0.4,
  Calmness: 0.3,
  Determination: 0.2,
  Contentment: 0.1,
}

test.describe('[BUG] 공유 링크 - 페르소나 불일치', () => {
  test('원본 세션: sessionStorage에 감정 데이터 있을 때 페르소나 확인', async ({ page }) => {
    await page.goto('/result')
    // sessionStorage에 감정 주입 (분석 직후 상태 시뮬레이션)
    await page.evaluate((emotions) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
    }, MOCK_EMOTIONS)

    await page.reload()
    await page.waitForTimeout(1000)

    const heroText = await page.locator('h1').first().textContent()
    console.log('[원본] 페르소나:', heroText)
    expect(heroText).toBeTruthy()

    // 페르소나 이름 저장
    return heroText
  })

  test('분석 데이터 없이 /result에 직접 접근하면 재녹음을 안내', async ({ page }) => {
    // sessionStorage 없는 새 세션으로 접근 (친구 상황)
    await page.goto('/result')
    await page.waitForTimeout(1000)

    await expect(page.getByRole('heading', { name: '표시할 음성 분석 결과가 없어요' })).toBeVisible()
    await expect(page.getByRole('button', { name: '목소리 녹음하러 가기' })).toBeVisible()
  })

  test('분석 데이터 없는 상태를 새로고침해도 임의의 페르소나를 만들지 않음', async ({ page }) => {
    await page.goto('/result')
    for (let i = 0; i < 3; i++) {
      await expect(page.getByRole('heading', { name: '표시할 음성 분석 결과가 없어요' })).toBeVisible()
      await expect(page.getByText('페르소나 일치율')).toHaveCount(0)
      await page.reload()
    }
  })

  test('공유 버튼이 존재하는지 확인', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate((emotions) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
    }, MOCK_EMOTIONS)
    await page.reload()
    await page.waitForTimeout(1000)

    // 공유 버튼 확인
    const shareButton = page.getByRole('button', { name: /공유/i })
    await expect(shareButton).toBeVisible()
    console.log('✓ 공유 버튼 존재 확인')
  })
})
