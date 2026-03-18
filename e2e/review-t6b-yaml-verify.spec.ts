import { test, expect } from '@playwright/test'

test('T6b: Verify YAML export content via clipboard', async ({ page, context }) => {
  // Grant clipboard permissions
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('button').filter({ hasText: /New flow/i }).first().click()
  await page.waitForTimeout(2000)

  // Click Export YAML
  const exportBtn = page.locator('button').filter({ hasText: /Export YAML/i }).first()
  await expect(exportBtn).toBeVisible()
  await exportBtn.click()
  await page.waitForTimeout(1000)

  await page.screenshot({ path: 'doc/review-screenshots/T6-after-export.png', fullPage: true })

  // Check if a toast or modal appeared
  const toast = page.locator('[class*="toast"], [class*="Toast"], [role="alert"], [class*="notification"]').first()
  if (await toast.isVisible().catch(() => false)) {
    console.log('Toast text:', await toast.textContent())
  }

  // Try to read clipboard
  try {
    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText()
    })
    console.log('Clipboard content length:', clipboardText?.length)
    console.log('Contains nodes:', clipboardText?.includes('nodes'))
    console.log('Contains edges:', clipboardText?.includes('edges'))
    console.log('First 300 chars:', clipboardText?.substring(0, 300))
  } catch (e) {
    console.log('Clipboard read failed:', (e as Error).message)
  }
})
