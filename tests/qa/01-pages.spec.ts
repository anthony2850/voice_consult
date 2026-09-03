/**
 * QA-01: 페이지 기본 로드 테스트
 * 모든 주요 페이지가 에러 없이 렌더링되는지 확인
 */
import { test, expect } from '@playwright/test'

test.describe('주요 페이지 기본 로드', () => {
  test('홈 페이지 로드', async ({ page }) => {
    await page.goto('/')
    await expect(page).not.toHaveTitle(/error/i)
    // 핵심 CTA 버튼 존재
    const cta = page.getByRole('link', { name: /분석|시작|목소리/i }).first()
    await expect(cta).toBeVisible()
  })

  test('녹음 페이지 로드', async ({ page }) => {
    await page.goto('/record')
    await expect(page).not.toHaveTitle(/error/i)
    // 마이크 권한 요청 전 UI 렌더링 확인
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('결과 페이지 - sessionStorage 없을 때 재녹음 안내 렌더링', async ({ page }) => {
    // sessionStorage 비어있는 상태로 /result 직접 접근
    await page.goto('/result')
    // 500 에러나 흰 화면이 아닌 결과가 렌더링되어야 함
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.getByRole('heading', { name: '표시할 음성 분석 결과가 없어요' })).toBeVisible()
  })

  test('트레이닝 페이지 로드', async ({ page }) => {
    await page.goto('/training')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('마이페이지 로드', async ({ page }) => {
    await page.goto('/mypage')
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})
