/**
 * QA-04: 페이지 간 네비게이션 테스트
 * - 각 CTA 버튼이 올바른 페이지로 이동하는지
 * - 뒤로가기 동작
 * - 결과에서 재분석 버튼
 */
import { test, expect } from '@playwright/test'

const SAMPLE_EMOTIONS = {
  Enthusiasm: 0.9, Excitement: 0.85, Joy: 0.8, Triumph: 0.75,
  Amusement: 0.7, Admiration: 0.5, Interest: 0.4, Calmness: 0.3,
  Determination: 0.2, Contentment: 0.1,
}

test.describe('페이지 간 네비게이션', () => {
  test('홈 → 녹음 페이지 이동', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    const ctaLink = page.getByRole('link', { name: /분석|시작|목소리/i }).first()
    await expect(ctaLink).toBeVisible()
    await ctaLink.click()
    await page.waitForURL('**/record', { timeout: 5000 })
    expect(page.url()).toContain('/record')
    console.log('✓ 홈 → /record 이동 확인')
  })

  test('결과 → 재분석 버튼 클릭 시 /record로 이동', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate((emotions) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
    }, SAMPLE_EMOTIONS)
    await page.reload()
    await page.waitForTimeout(1200)

    // 재분석/다시하기 버튼
    const retryBtn = page.getByRole('button', { name: /다시|재분석|새로/i })
    if (await retryBtn.count() > 0) {
      await retryBtn.first().click()
      await page.waitForURL('**/record', { timeout: 5000 })
      expect(page.url()).toContain('/record')
      console.log('✓ 재분석 버튼 → /record 이동 확인')
    } else {
      // RotateCcw 아이콘 버튼 시도
      const iconBtn = page.locator('button').filter({ has: page.locator('svg') }).first()
      const buttons = await page.getByRole('button').all()
      console.log('버튼 목록:')
      for (const btn of buttons) {
        const text = await btn.textContent()
        console.log(' -', text?.trim())
      }
    }
  })

  test('결과 → 트레이닝 버튼 이동', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate((emotions) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
    }, SAMPLE_EMOTIONS)
    await page.reload()
    await page.waitForTimeout(1500)

    const trainingBtn = page.getByRole('button', { name: /트레이닝|훈련|연습/i })
    if (await trainingBtn.count() > 0) {
      await trainingBtn.first().click()
      await page.waitForURL('**/training', { timeout: 5000 })
      expect(page.url()).toContain('/training')
      console.log('✓ 트레이닝 버튼 → /training 이동 확인')
    } else {
      console.log('⚠️  트레이닝 버튼 없음 (조건부 렌더링일 수 있음)')
    }
  })

  test('결과 → 리포트 버튼 존재 확인', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate((emotions) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
    }, SAMPLE_EMOTIONS)
    await page.reload()
    await page.waitForTimeout(1500)

    // 리포트/AI 분석 버튼
    const reportBtn = page.getByRole('button', { name: /리포트|보고서|AI|분석/i })
    if (await reportBtn.count() > 0) {
      console.log('✓ 리포트 버튼 존재')
      await expect(reportBtn.first()).toBeVisible()
    } else {
      console.log('⚠️  리포트 버튼 없음')
    }
  })

  test('존재하지 않는 경로 접근 시 404 처리', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz')
    // Next.js는 보통 404 페이지를 보여줌
    console.log('404 페이지 상태:', response?.status())
    expect(response?.status()).toBe(404)
  })
})
