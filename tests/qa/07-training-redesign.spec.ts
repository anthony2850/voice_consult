import { test, expect } from '@playwright/test'

test.describe('Training track (one concern, one ladder)', () => {
  test('training entry takes guests to onboarding first (login comes at the end), no price', async ({ page }) => {
    await page.goto('/training')
    await page.waitForURL('**/training/onboarding')
    await expect(page.getByRole('heading', { name: /어떤 상황에서/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: '로그인이 필요해요' })).toHaveCount(0)
    await expect(page.getByText(/4,900원|사전 ?예약|사전 ?등록/)).toHaveCount(0)
  })

  test('diagnosis and session routes are gated the same way', async ({ page }) => {
    await page.goto('/training/diagnose')
    await expect(page.getByRole('heading', { name: '로그인이 필요해요' })).toBeVisible()
    await page.goto('/training/session')
    await expect(page.getByRole('heading', { name: '로그인이 필요해요' })).toBeVisible()
  })

  test('old day routes are gone', async ({ page }) => {
    const response = await page.goto('/training/session/1')
    expect(response?.status()).toBe(404)
  })
})
