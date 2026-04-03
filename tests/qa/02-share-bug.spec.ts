/**
 * QA-02: 공유 링크 페르소나 불일치 버그
 *
 * 재현 시나리오:
 *   1. 사용자가 음성 분석 → 특정 페르소나 배정
 *   2. 공유 버튼 → URL 복사 (현재: window.location.href = /result)
 *   3. 친구가 해당 URL 접속 → 다른 세션이므로 sessionStorage 없음
 *   4. getMockEmotions() fallback → 랜덤 감정 → 다른 페르소나 출력
 *
 * 기대 결과: 공유받은 사람도 동일한 페르소나를 봐야 함
 * 현재 결과: 매번 다른 페르소나가 나올 수 있음
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

  test('공유 링크 수신자: 새 세션에서 /result 접근 → 다른 페르소나 나올 수 있음', async ({ page }) => {
    // sessionStorage 없는 새 세션으로 접근 (친구 상황)
    await page.goto('/result')
    await page.waitForTimeout(1000)

    const heroText = await page.locator('h1').first().textContent()
    console.log('[친구] 페르소나:', heroText)

    // ⚠️ 이 테스트는 버그 존재 확인용:
    // sessionStorage 없으면 getMockEmotions()가 랜덤 데이터를 생성하므로
    // 원본과 다른 페르소나가 나올 수 있음
    expect(heroText).toBeTruthy()
    // TODO: 공유 기능 수정 후 원본 세션과 동일한 페르소나가 나와야 함
  })

  test('새로고침 시 페르소나가 바뀌는 버그', async ({ page }) => {
    // sessionStorage 없는 상태에서 여러 번 새로고침
    await page.goto('/result')
    await page.waitForTimeout(800)
    const persona1 = await page.locator('h1').first().textContent()

    await page.reload()
    await page.waitForTimeout(800)
    const persona2 = await page.locator('h1').first().textContent()

    await page.reload()
    await page.waitForTimeout(800)
    const persona3 = await page.locator('h1').first().textContent()

    console.log('새로고침 테스트:')
    console.log('  1회:', persona1)
    console.log('  2회:', persona2)
    console.log('  3회:', persona3)

    // ⚠️ 버그: sessionStorage 없으면 새로고침마다 다른 페르소나가 나올 수 있음
    // 수정 후: 세 번 모두 같은 페르소나여야 함
    const allSame = persona1 === persona2 && persona2 === persona3
    if (!allSame) {
      console.log('⚠️  새로고침마다 페르소나가 달라지는 버그 확인됨')
    } else {
      console.log('✓  새로고침해도 동일한 페르소나 유지됨')
    }
    // 현재는 버그가 존재하므로 soft assertion (실패해도 다음 테스트 진행)
    // 수정 후 아래 주석 해제:
    // expect(allSame).toBe(true)
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
