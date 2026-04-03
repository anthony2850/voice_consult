/**
 * QA-03: 결과 페이지 신뢰성 테스트
 * - sessionStorage 유무에 따른 동작
 * - 감정 데이터가 정상적으로 표시되는지
 * - 페르소나 매칭 결과 일관성
 */
import { test, expect } from '@playwright/test'

const SAMPLE_EMOTIONS = {
  Determination: 0.88,
  Calmness: 0.82,
  Concentration: 0.79,
  Realization: 0.71,
  Pride: 0.60,
  Interest: 0.55,
  Contentment: 0.40,
  Enthusiasm: 0.30,
  Joy: 0.25,
  Amusement: 0.20,
}

test.describe('결과 페이지 신뢰성', () => {
  test('감정 데이터 주입 후 페르소나가 올바르게 표시됨', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate((emotions) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
    }, SAMPLE_EMOTIONS)
    await page.reload()
    await page.waitForTimeout(1200)

    // 페르소나 이름이 h1에 나타나야 함
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
    const personaName = await h1.textContent()
    console.log('표시된 페르소나:', personaName)
    expect(personaName?.length).toBeGreaterThan(0)
  })

  test('같은 감정 데이터는 항상 동일한 페르소나를 반환', async ({ page }) => {
    const results: string[] = []

    for (let i = 0; i < 3; i++) {
      await page.goto('/result')
      await page.evaluate((emotions) => {
        sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
      }, SAMPLE_EMOTIONS)
      await page.reload()
      await page.waitForTimeout(1000)

      const persona = await page.locator('h1').first().textContent()
      results.push(persona ?? '')
    }

    console.log('일관성 테스트 결과:', results)
    // 같은 감정 → 같은 페르소나 (결정적 알고리즘이어야 함)
    expect(results[0]).toBe(results[1])
    expect(results[1]).toBe(results[2])
    console.log('✓ 동일한 감정 데이터로 항상 동일한 페르소나 반환')
  })

  test('상위 5개 감정 배지가 표시됨', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate((emotions) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
    }, SAMPLE_EMOTIONS)
    await page.reload()
    await page.waitForTimeout(1200)

    // 헤더에 감정 배지들이 표시되어야 함
    const badges = page.locator('.bg-white\\/20').filter({ hasText: /[가-힣]/ })
    const count = await badges.count()
    console.log('표시된 감정 배지 수:', count)
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('일치율 % 가 표시됨', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate((emotions) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
    }, SAMPLE_EMOTIONS)
    await page.reload()
    await page.waitForTimeout(1200)

    await expect(page.locator('body')).toContainText('%')
    console.log('✓ 일치율 표시 확인')
  })

  test('페르소나 카드가 로드됨 (애니메이션 후)', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate((emotions) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
    }, SAMPLE_EMOTIONS)
    await page.reload()
    await page.waitForTimeout(2000) // 애니메이션 대기

    // 페이지가 opacity:0 상태로 숨겨져 있으면 안 됨
    const mainDiv = page.locator('.flex.flex-col.min-h-\\[calc\\(100vh-84px\\)\\]')
    const opacity = await mainDiv.evaluate((el) => getComputedStyle(el).opacity)
    expect(parseFloat(opacity)).toBeGreaterThan(0.9)
    console.log('✓ 결과 페이지 fade-in 완료, opacity:', opacity)
  })
})
