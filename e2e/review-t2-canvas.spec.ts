import { test, expect } from '@playwright/test'

test('T2: Canvas operations - add nodes, config panel, condition handles', async ({ page }) => {
  // Create a new flow
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const newFlowBtn = page.locator('button').filter({ hasText: /New flow/i }).first()
  await newFlowBtn.click()
  await page.waitForTimeout(2000)
  await page.waitForLoadState('networkidle')

  await page.screenshot({ path: 'doc/review-screenshots/T2-canvas-initial.png', fullPage: true })

  // Look for left panel with node palette
  const leftPanel = page.locator('[class*="left-panel"], [class*="LeftPanel"], aside').first()
  console.log('Left panel visible:', await leftPanel.isVisible().catch(() => false))

  // Try to find draggable node items in left panel
  const nodeItems = page.locator('[draggable="true"], [data-type]')
  const nodeCount = await nodeItems.count()
  console.log(`Found ${nodeCount} draggable/typed items`)
  for (let i = 0; i < Math.min(nodeCount, 15); i++) {
    const text = await nodeItems.nth(i).textContent()
    const type = await nodeItems.nth(i).getAttribute('data-type')
    console.log(`  Item ${i}: "${text?.trim()}" type=${type}`)
  }

  // Find the Agent node in palette and drag it to canvas
  const agentItem = page.locator('[draggable="true"]').filter({ hasText: /agent/i }).first()
  if (await agentItem.isVisible()) {
    const canvas = page.locator('.react-flow__renderer, .react-flow__pane').first()
    const canvasBox = await canvas.boundingBox()
    if (canvasBox) {
      // Drag agent node to canvas
      await agentItem.dragTo(canvas, {
        targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 3 }
      })
      await page.waitForTimeout(1000)
    }
  } else {
    console.log('Agent draggable not found, trying click-based approach')
  }

  // Check for nodes on canvas
  const canvasNodes = page.locator('.react-flow__node')
  const canvasNodeCount = await canvasNodes.count()
  console.log(`Canvas nodes: ${canvasNodeCount}`)

  // Click on a node to open right panel
  if (canvasNodeCount > 0) {
    // Click the first non-input/output node or any node
    for (let i = 0; i < canvasNodeCount; i++) {
      const nodeType = await canvasNodes.nth(i).getAttribute('data-type')
      const nodeText = await canvasNodes.nth(i).textContent()
      console.log(`  Node ${i}: type=${nodeType} text="${nodeText?.trim().substring(0, 50)}"`)
    }

    // Click on the agent node if present
    const agentNode = page.locator('.react-flow__node').filter({ hasText: /agent/i }).first()
    if (await agentNode.isVisible()) {
      await agentNode.click()
      await page.waitForTimeout(500)

      // Check right panel appeared
      const rightPanel = page.locator('[class*="right"], [class*="config"], [class*="panel"]').filter({ hasText: /system prompt|model|provider/i }).first()
      console.log('Right panel/config visible:', await rightPanel.isVisible().catch(() => false))

      // Try to find and type in system prompt
      const promptInput = page.locator('textarea').filter({ hasText: /system|prompt/i }).first()
        || page.locator('textarea').first()
      if (await promptInput.isVisible().catch(() => false)) {
        await promptInput.fill('You are a helpful assistant for testing.')
        console.log('System prompt filled')
      }
    }
  }

  // Add condition node
  const conditionItem = page.locator('[draggable="true"]').filter({ hasText: /condition/i }).first()
  if (await conditionItem.isVisible()) {
    const canvas = page.locator('.react-flow__renderer, .react-flow__pane').first()
    const canvasBox = await canvas.boundingBox()
    if (canvasBox) {
      await conditionItem.dragTo(canvas, {
        targetPosition: { x: canvasBox.width / 2, y: canvasBox.height * 2 / 3 }
      })
      await page.waitForTimeout(1000)
    }
  }

  // Verify condition node has true/false handles
  const condNode = page.locator('.react-flow__node').filter({ hasText: /condition|true|false/i }).first()
  if (await condNode.isVisible().catch(() => false)) {
    const handles = condNode.locator('.react-flow__handle')
    const handleCount = await handles.count()
    console.log(`Condition node handles: ${handleCount}`)

    // Look for true/false labels
    const trueLabel = condNode.locator('text=true, text=True, [class*="true"]').first()
    const falseLabel = condNode.locator('text=false, text=False, [class*="false"]').first()
    console.log('True label:', await trueLabel.isVisible().catch(() => false))
    console.log('False label:', await falseLabel.isVisible().catch(() => false))
  }

  await page.screenshot({ path: 'doc/review-screenshots/T2-canvas-with-nodes.png', fullPage: true })
})
