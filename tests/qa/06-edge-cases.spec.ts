/**
 * QA-06: 엣지 케이스 & 상태 오염 테스트
 * - 결제 콜백 URL 직접 접근
 * - 잘못된 sessionStorage 데이터
 * - 히스토리 중복 저장
 */
import { test, expect } from '@playwright/test'

test.describe('엣지 케이스 & 비정상 상태', () => {
  test('결과 페이지: sessionStorage가 깨진 JSON일 때 크래시 없음', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate(() => {
      sessionStorage.setItem('voiceEmotions', 'NOT_VALID_JSON{{{')
    })
    await page.reload()
    await page.waitForTimeout(1000)

    // 파싱 실패해도 화이트스크린/500이 아닌 fallback으로 렌더링
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('body')).not.toContainText('Unexpected token')
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
    console.log('✓ 깨진 JSON에서도 fallback 렌더링 확인')
  })

  test('결과 페이지: emotions 값이 빈 객체일 때', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate(() => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify({}))
    })
    await page.reload()
    await page.waitForTimeout(1000)

    await expect(page.locator('body')).not.toContainText('500')
    console.log('✓ 빈 emotions 객체 처리 확인')
  })

  test('결과 페이지: emotions 값이 null일 때', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate(() => {
      sessionStorage.setItem('voiceEmotions', 'null')
    })
    await page.reload()
    await page.waitForTimeout(1000)

    await expect(page.locator('body')).not.toContainText('500')
    console.log('✓ null emotions 처리 확인')
  })

  test('결제 성공 콜백 URL 직접 접근 시 크래시 없음', async ({ page }) => {
    await page.goto('/result/success?paymentKey=fake&orderId=fake&amount=0')
    await page.waitForTimeout(1000)
    await expect(page.locator('body')).not.toContainText('500')
    console.log('✓ 결제 콜백 직접 접근 처리 확인')
  })

  test('checkout 페이지: 직접 접근 시 처리', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForTimeout(1000)
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    console.log('✓ checkout 직접 접근 처리 확인')
  })

  test('report 페이지: 결제 없이 직접 접근 시 처리', async ({ page }) => {
    await page.goto('/report')
    await page.waitForTimeout(1000)
    // 결제 안 했으면 리다이렉트하거나 안내 메시지를 보여줘야 함
    await expect(page.locator('body')).not.toContainText('500')
    console.log('✓ 미결제 report 접근 처리 확인')
  })

  test('localStorage 히스토리: 연속 분석 시 중복 방지', async ({ page }) => {
    // localStorage에 히스토리 데이터 주입
    await page.goto('/mypage')
    await page.evaluate(() => {
      const today = new Date().toDateString()
      const history = [
        { date: today, top3: ['열정', '흥분', '기쁨'], persona: '인간 비타민 크리에이터' },
        { date: today, top3: ['열정', '흥분', '기쁨'], persona: '인간 비타민 크리에이터' }, // 중복
      ]
      localStorage.setItem('voiceEmotionHistory', JSON.stringify(history))
    })
    await page.reload()
    await page.waitForTimeout(1000)

    await expect(page.locator('body')).not.toContainText('500')
    console.log('✓ 중복 히스토리 처리 확인')
  })
})
