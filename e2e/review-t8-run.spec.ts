import { test, expect } from '@playwright/test'

test('T8: Run flow - Input→Output, execution, history', async ({ page }) => {
  // Create a new flow
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('button').filter({ hasText: /New flow/i }).first().click()
  await page.waitForTimeout(2000)

  const flowUrl = page.url()
  console.log('Flow URL:', flowUrl)

  // The default flow has an agent node. Let's check what's there
  const nodes = page.locator('.react-flow__node')
  const nodeCount = await nodes.count()
  console.log('Existing nodes:', nodeCount)
  for (let i = 0; i < nodeCount; i++) {
    const type = await nodes.nth(i).getAttribute('data-type')
    const text = await nodes.nth(i).textContent()
    console.log(`  Node ${i}: type=${type} text="${text?.substring(0, 50)}"`)
  }

  // We need Input → Agent → Output connected
  // Add Input node
  const inputItem = page.locator('[draggable="true"]').filter({ hasText: /^Input$/ }).first()
  const canvas = page.locator('.react-flow__pane').first()
  const canvasBox = await canvas.boundingBox()

  if (canvasBox) {
    // Add Input node on left
    if (await inputItem.isVisible()) {
      await inputItem.dragTo(canvas, {
        targetPosition: { x: canvasBox.width * 0.2, y: canvasBox.height * 0.5 }
      })
      await page.waitForTimeout(500)
    }

    // Add Output node on right
    const outputItem = page.locator('[draggable="true"]').filter({ hasText: /^Output$/ }).first()
    if (await outputItem.isVisible()) {
      await outputItem.dragTo(canvas, {
        targetPosition: { x: canvasBox.width * 0.8, y: canvasBox.height * 0.5 }
      })
      await page.waitForTimeout(500)
    }
  }

  await page.waitForTimeout(1000)
  const nodesAfterAdd = await page.locator('.react-flow__node').count()
  console.log('Nodes after adding:', nodesAfterAdd)

  // Find and set input value on the input node
  const inputNode = page.locator('.react-flow__node[data-type="input"], .react-flow__node').filter({ hasText: /input/i }).first()
  if (await inputNode.isVisible().catch(() => false)) {
    await inputNode.click()
    await page.waitForTimeout(500)
    // Look for textarea in the input node or right panel
    const inputTextarea = page.locator('textarea').first()
    if (await inputTextarea.isVisible().catch(() => false)) {
      await inputTextarea.fill('Hello, this is a test input')
      console.log('Input value set')
    }
  }

  await page.screenshot({ path: 'doc/review-screenshots/T8-before-run.png', fullPage: true })

  // Find Run button
  const runBtn = page.locator('button').filter({ hasText: /run|运行|▶/i }).first()
  console.log('Run button visible:', await runBtn.isVisible().catch(() => false))

  if (await runBtn.isVisible().catch(() => false)) {
    await runBtn.click()
    console.log('Run button clicked')

    // Wait for execution
    await page.waitForTimeout(5000)
    await page.screenshot({ path: 'doc/review-screenshots/T8-after-run.png', fullPage: true })

    // Check for execution status indicators
    const statusIndicators = page.locator('[class*="status"], [class*="running"], [class*="complete"], [class*="error"]')
    const statusCount = await statusIndicators.count()
    console.log('Status indicators:', statusCount)
  }

  // Check for History tab in bottom panel
  const historyTab = page.locator('button, [role="tab"]').filter({ hasText: /history|历史|runs/i }).first()
  if (await historyTab.isVisible().catch(() => false)) {
    await historyTab.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'doc/review-screenshots/T8-history.png', fullPage: true })
    console.log('History tab found and clicked')
  } else {
    console.log('History tab not found')
    // Check bottom panel buttons
    const bottomBtns = page.locator('[class*="bottom"] button, [class*="panel"] button')
    const count = await bottomBtns.count()
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await bottomBtns.nth(i).textContent()
      console.log(`  Bottom btn ${i}: "${text?.trim()}"`)
    }
  }
})
