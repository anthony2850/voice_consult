import { test, expect } from '@playwright/test'

test.describe('Training tab redesign', () => {
  test('landing renders today day card and other-day cards', async ({ page }) => {
    await page.goto('/training')
    await expect(page.getByText('Voice Training')).toBeVisible()
    await expect(page.getByText(/Day \d \/ 5/)).toBeVisible()
    await expect(page.getByText('다른 단계 둘러보기')).toBeVisible()
    await expect(page.getByText('훈련 후 목소리 변화 측정')).toBeVisible()
  })

  test('session route renders the day header and first exercise', async ({ page }) => {
    await page.goto('/training/session/1')
    await expect(page.getByText('Day 1 / 5')).toBeVisible()
    await expect(page.getByText(/Step 1 \/ \d/)).toBeVisible()
  })

  test('invalid day shows 404', async ({ page }) => {
    const response = await page.goto('/training/session/99')
    expect(response?.status()).toBe(404)
  })
})
