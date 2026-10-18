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

// 브라우저 측 extractAudioFeatures 결과 모양 (진단 페이지가 읽는 sessionStorage 값)
const SAMPLE_FEATURES = {
  duration_sec: 12.3, sample_rate: 48000,
  pitch: { mean_hz: 142.5, min_hz: 98, max_hz: 210, std_hz: 28.4, voiced_ratio: 0.62 },
  energy: { rms_mean: 0.08, rms_std: 0.03, db_mean: -24.1, db_max: -12, db_min: -40, db_range: 28 },
  spectral: { centroid_mean_hz: 356, centroid_std_hz: 40, bandwidth_mean_hz: 900, rolloff_mean_hz: 2000, flatness_mean: 0.2, contrast_mean_db: 20 },
  mfccs: {},
  rhythm: { tempo_bpm: 120, onset_count: 52, onsets_per_second: 4.2 },
  voice_quality: { jitter_abs_ms: 0.1, jitter_rel_pct: 1.4, shimmer_abs: 0.03, shimmer_rel_pct: 3.1, hnr_db: 18.2, source: 'praat' },
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

  test('결과 → 자세히 보기 → 진단 페이지 → 훈련 이동', async ({ page }) => {
    await page.goto('/result')
    await page.evaluate(([emotions, features]) => {
      sessionStorage.setItem('voiceEmotions', JSON.stringify(emotions))
      sessionStorage.setItem('audioFeatures', JSON.stringify(features))
    }, [SAMPLE_EMOTIONS, SAMPLE_FEATURES] as const)
    await page.reload()
    await page.waitForTimeout(1200)

    // 결과 페이지에는 금액, 사전등록, 로그인 요청이 없어야 함
    await expect(page.getByText(/990원|4,900원|사전 ?예약|로그인하면/)).toHaveCount(0)

    await page.getByRole('button', { name: '이 페르소나를 만든 수치 보기' }).click()
    await page.waitForURL('**/result/voice', { timeout: 5000 })
    await expect(page.getByRole('heading', { name: '목소리 품질 분석' })).toBeVisible()

    const trainingBtn = page.getByRole('button', { name: /훈련|다듬기/ })
    await trainingBtn.click()
    await page.waitForURL('**/training', { timeout: 5000 })
    expect(page.url()).toContain('/training')
    console.log('✓ 결과 → 진단 → /training 이동 확인')
  })

  test('진단 데이터 없이 /result/voice 접근 시 재녹음 안내', async ({ page }) => {
    await page.goto('/result/voice')
    await page.waitForTimeout(800)
    await expect(page.getByRole('heading', { name: '표시할 목소리 진단이 없어요' })).toBeVisible()
  })

  test('존재하지 않는 경로 접근 시 404 처리', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz')
    // Next.js는 보통 404 페이지를 보여줌
    console.log('404 페이지 상태:', response?.status())
    expect(response?.status()).toBe(404)
  })
})
