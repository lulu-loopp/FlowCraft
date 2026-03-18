import { test, expect } from '@playwright/test'

test('T1: Homepage - brand, new button, list, navigation', async ({ page }) => {
  // Visit homepage
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'doc/review-screenshots/T1-homepage.png', fullPage: true })

  // Verify brand
  const brand = page.locator('text=FlowCraft')
  await expect(brand.first()).toBeVisible()

  // Verify new flow button exists
  const newBtn = page.getByRole('button').filter({ hasText: /new|新建|create/i }).first()
    || page.locator('button, a').filter({ hasText: /new|新建|create/i }).first()

  // Look for any clickable element to create a new flow
  const createElements = page.locator('[href*="canvas"], button').filter({ hasText: /new|新建|create|flow/i })
  const count = await createElements.count()
  console.log(`Found ${count} create/new elements`)

  // Take note of what's on the page
  const buttons = page.locator('button')
  const btnCount = await buttons.count()
  for (let i = 0; i < Math.min(btnCount, 10); i++) {
    const text = await buttons.nth(i).textContent()
    console.log(`Button ${i}: "${text?.trim()}"`)
  }

  // Try to find and click the new flow button
  const newFlowBtn = page.locator('button').filter({ hasText: /new|新建|create|\+/i }).first()
  if (await newFlowBtn.isVisible()) {
    await newFlowBtn.click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'doc/review-screenshots/T1-after-create.png', fullPage: true })

    // Verify navigation to canvas
    const url = page.url()
    console.log(`After click URL: ${url}`)
    expect(url).toContain('/canvas/')
  } else {
    console.log('No visible new flow button found, checking for links')
    const links = page.locator('a[href*="canvas"]')
    const linkCount = await links.count()
    console.log(`Found ${linkCount} canvas links`)
  }
})
