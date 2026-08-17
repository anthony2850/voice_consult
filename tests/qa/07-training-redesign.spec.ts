import { test, expect } from '@playwright/test'

test.describe('Training tab redesign (Phase 2 — outcome-based)', () => {
  test('training entry shows pre-register landing (fake door)', async ({ page }) => {
    await page.goto('/training')
    await expect(page.getByText('AI 발성 훈련 프로그램')).toBeVisible()
    await expect(page.getByText(/4,900/)).toBeVisible()
    await expect(page.getByText('이런 훈련을 받게 돼요')).toBeVisible()
    await expect(page.getByPlaceholder('이메일 주소를 입력해 주세요')).toBeVisible()
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
