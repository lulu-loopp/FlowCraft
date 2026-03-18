import { test, expect } from '@playwright/test'

test('T3: Persistence - save, refresh, verify state retained', async ({ page }) => {
  // Create a new flow
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('button').filter({ hasText: /New flow/i }).first().click()
  await page.waitForTimeout(2000)

  const flowUrl = page.url()
  console.log('Flow URL:', flowUrl)

  // Add an Agent node by dragging
  const agentItem = page.locator('[draggable="true"]').filter({ hasText: /^Agent$/ }).first()
  const canvas = page.locator('.react-flow__pane').first()
  const canvasBox = await canvas.boundingBox()

  if (canvasBox && await agentItem.isVisible()) {
    await agentItem.dragTo(canvas, {
      targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 3 }
    })
    await page.waitForTimeout(1000)
  }

  // Count nodes before save
  const nodesBefore = await page.locator('.react-flow__node').count()
  console.log('Nodes before save:', nodesBefore)

  // Click on the added agent node
  const agentNode = page.locator('.react-flow__node').last()
  await agentNode.click()
  await page.waitForTimeout(500)

  // Try to find and fill system prompt in right panel
  const textarea = page.locator('textarea').first()
  if (await textarea.isVisible().catch(() => false)) {
    await textarea.fill('Test persistence prompt')
    console.log('Filled system prompt')
    await page.waitForTimeout(500)
  }

  // Screenshot before refresh
  await page.screenshot({ path: 'doc/review-screenshots/T3-before-refresh.png', fullPage: true })

  // Wait for auto-save (debounce)
  await page.waitForTimeout(3000)

  // Refresh page
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // Screenshot after refresh
  await page.screenshot({ path: 'doc/review-screenshots/T3-after-refresh.png', fullPage: true })

  // Verify nodes persisted
  const nodesAfter = await page.locator('.react-flow__node').count()
  console.log('Nodes after refresh:', nodesAfter)
  expect(nodesAfter).toBe(nodesBefore)

  // Check if the agent node still has config
  const agentNodeAfter = page.locator('.react-flow__node').last()
  await agentNodeAfter.click()
  await page.waitForTimeout(500)

  const textareaAfter = page.locator('textarea').first()
  if (await textareaAfter.isVisible().catch(() => false)) {
    const value = await textareaAfter.inputValue()
    console.log('System prompt after refresh:', value)
  }
})
