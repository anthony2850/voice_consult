import { test, expect } from '@playwright/test'

test.describe('Training tab redesign (Phase 2 — outcome-based)', () => {
  test('landing renders Cycle N subtitle, today day card, and other day cards', async ({ page }) => {
    await page.goto('/training')
    await expect(page.getByText('Voice Training')).toBeVisible()
    await expect(page.getByText(/Cycle \d+/)).toBeVisible()
    await expect(page.getByText(/Day \d \/ 5/)).toBeVisible()
    await expect(page.getByText('다른 단계 둘러보기')).toBeVisible()
    await expect(page.getByText('훈련 후 목소리 변화 측정')).toBeVisible()
  })

  test('session route renders the day header with theme + subtitle', async ({ page }) => {
    await page.goto('/training/session/1')
    await expect(page.getByText('Day 1 / 5')).toBeVisible()
    await expect(page.getByText('안정')).toBeVisible()
    await expect(page.getByText('당신의 진정성이 흔들림 없이 전달되도록')).toBeVisible()
  })

  test('Day 5 route shows outcome picker before exercises', async ({ page }) => {
    await page.goto('/training/session/5')
    await expect(page.getByText('어떤 영역을 한 번 더?')).toBeVisible()
    // 4 outcome cards
    await expect(page.getByText('안정', { exact: true })).toBeVisible()
    await expect(page.getByText('전달력', { exact: true })).toBeVisible()
    await expect(page.getByText('명료성', { exact: true })).toBeVisible()
    await expect(page.getByText('표현력', { exact: true })).toBeVisible()
  })

  test('invalid day shows 404', async ({ page }) => {
    const response = await page.goto('/training/session/99')
    expect(response?.status()).toBe(404)
  })
})
