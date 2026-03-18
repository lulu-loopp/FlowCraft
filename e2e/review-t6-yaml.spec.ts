import { test, expect } from '@playwright/test'

test('T6: YAML Export - export flow with nodes', async ({ page }) => {
  // Go to a canvas with nodes
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Create new flow
  await page.locator('button').filter({ hasText: /New flow/i }).first().click()
  await page.waitForTimeout(2000)

  // Add a node so export has content
  const agentItem = page.locator('[draggable="true"]').filter({ hasText: /^Agent$/ }).first()
  const canvas = page.locator('.react-flow__pane').first()
  const canvasBox = await canvas.boundingBox()
  if (canvasBox && await agentItem.isVisible()) {
    await agentItem.dragTo(canvas, {
      targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 3 }
    })
    await page.waitForTimeout(1000)
  }

  // Look for export button in toolbar
  const allBtns = page.locator('button')
  const btnCount = await allBtns.count()
  for (let i = 0; i < Math.min(btnCount, 20); i++) {
    const text = await allBtns.nth(i).textContent()
    const title = await allBtns.nth(i).getAttribute('title')
    if (text?.toLowerCase().includes('export') || text?.toLowerCase().includes('yaml') ||
        title?.toLowerCase().includes('export') || title?.toLowerCase().includes('yaml')) {
      console.log(`Export button found at ${i}: text="${text?.trim()}" title="${title}"`)
    }
  }

  // Try to find export by text, title, or icon
  const exportBtn = page.locator('button').filter({ hasText: /export|yaml|导出/i }).first()
  let exportVisible = await exportBtn.isVisible().catch(() => false)

  if (!exportVisible) {
    // Maybe it's in a menu or has a title attribute
    const exportByTitle = page.locator('button[title*="Export"], button[title*="YAML"], button[title*="export"]').first()
    exportVisible = await exportByTitle.isVisible().catch(() => false)
    if (exportVisible) {
      await exportByTitle.click()
      await page.waitForTimeout(1000)
    } else {
      // Check for dropdown/menu
      const moreBtn = page.locator('button').filter({ hasText: /more|menu|⋯|⋮|\.\.\./i }).first()
      if (await moreBtn.isVisible().catch(() => false)) {
        await moreBtn.click()
        await page.waitForTimeout(500)
      }
      console.log('Export button not directly visible, checking all buttons...')
      for (let i = 0; i < btnCount; i++) {
        const text = await allBtns.nth(i).textContent()
        console.log(`  btn ${i}: "${text?.trim().substring(0, 40)}"`)
      }
    }
  } else {
    await exportBtn.click()
    await page.waitForTimeout(1000)
  }

  await page.screenshot({ path: 'doc/review-screenshots/T6-yaml-export.png', fullPage: true })

  // Check for YAML content in a modal, textarea, or clipboard
  const yamlContent = page.locator('pre, code, textarea').filter({ hasText: /nodes|edges|name/i }).first()
  if (await yamlContent.isVisible().catch(() => false)) {
    const text = await yamlContent.textContent()
    console.log('YAML content found, length:', text?.length)
    console.log('Contains nodes:', text?.includes('nodes'))
    console.log('Contains edges:', text?.includes('edges'))
    console.log('First 200 chars:', text?.substring(0, 200))
  } else {
    console.log('No visible YAML content found - may have been copied to clipboard')
  }
})
