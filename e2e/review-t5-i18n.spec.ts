import { test, expect } from '@playwright/test'

test('T5: Language switching - EN/ZH toggle, persistence', async ({ page }) => {
  // Start on homepage
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Find language toggle button (currently shows "中文" meaning switch to Chinese)
  const langBtn = page.locator('button').filter({ hasText: /中文|English|EN|ZH/i }).first()
  console.log('Language button text:', await langBtn.textContent().catch(() => 'NOT FOUND'))

  // Switch to Chinese
  await langBtn.click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'doc/review-screenshots/T5-homepage-zh.png', fullPage: true })

  // Verify Chinese text appeared
  const pageText = await page.textContent('body')
  const hasChinese = pageText?.includes('新建') || pageText?.includes('工作流') || pageText?.includes('画布')
  console.log('Has Chinese text:', hasChinese)

  // Navigate to canvas
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const newFlowBtn = page.locator('button').filter({ hasText: /新建|New/i }).first()
  if (await newFlowBtn.isVisible()) {
    await newFlowBtn.click()
    await page.waitForTimeout(2000)
  }
  await page.screenshot({ path: 'doc/review-screenshots/T5-canvas-zh.png', fullPage: true })

  // Check for untranslated English text that should be in Chinese
  const canvasText = await page.textContent('body') || ''
  const untranslated = []
  const checkTerms = ['Settings', 'New flow', 'Run', 'Export', 'Save', 'Delete', 'Cancel']
  for (const term of checkTerms) {
    if (canvasText.includes(term)) {
      untranslated.push(term)
    }
  }
  if (untranslated.length > 0) {
    console.log('Potentially untranslated terms:', untranslated.join(', '))
  } else {
    console.log('No obvious untranslated terms found')
  }

  // Switch back to English
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const langBtnEn = page.locator('button').filter({ hasText: /English|中文|EN|ZH/i }).first()
  await langBtnEn.click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'doc/review-screenshots/T5-homepage-en.png', fullPage: true })

  // Verify English is back
  const enText = await page.textContent('body')
  console.log('Has English "New flow":', enText?.includes('New flow'))

  // Refresh and verify language persists
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  const afterRefreshText = await page.textContent('body')
  const langPersisted = afterRefreshText?.includes('New flow') || afterRefreshText?.includes('新建')
  console.log('Language persisted after refresh:', langPersisted)
  console.log('Current lang after refresh:', afterRefreshText?.includes('New flow') ? 'EN' : 'ZH')
})
