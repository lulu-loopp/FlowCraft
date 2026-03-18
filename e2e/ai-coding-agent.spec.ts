import { test, expect } from '@playwright/test'

// ── API Route Tests ──

test.describe('Claude Code API Routes', () => {
  test('GET /api/tools/claude-code/check returns installation status', async ({ request }) => {
    const res = await request.get('/api/tools/claude-code/check')
    expect(res.ok()).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('nodeInstalled')
    expect(data).toHaveProperty('nodeVersion')
    expect(data).toHaveProperty('claudeInstalled')
    expect(data).toHaveProperty('claudeVersion')
    expect(typeof data.nodeInstalled).toBe('boolean')
    expect(typeof data.claudeInstalled).toBe('boolean')
  })

  test('GET /api/tools/claude-code/skills returns skills list', async ({ request }) => {
    const res = await request.get('/api/tools/claude-code/skills')
    expect(res.ok()).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('skills')
    expect(Array.isArray(data.skills)).toBe(true)
    // Each skill should have name, scope, path
    if (data.skills.length > 0) {
      expect(data.skills[0]).toHaveProperty('name')
      expect(data.skills[0]).toHaveProperty('scope')
      expect(['global', 'project']).toContain(data.skills[0].scope)
    }
  })

  test('GET /api/tools/claude-code/mcps returns servers list', async ({ request }) => {
    const res = await request.get('/api/tools/claude-code/mcps')
    expect(res.ok()).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('servers')
    expect(Array.isArray(data.servers)).toBe(true)
  })

  test('GET /api/tools/claude-code/diff returns file changes', async ({ request }) => {
    const res = await request.get('/api/tools/claude-code/diff')
    expect(res.ok()).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('changes')
    expect(Array.isArray(data.changes)).toBe(true)
    if (data.changes.length > 0) {
      const first = data.changes[0]
      expect(first).toHaveProperty('file')
      expect(first).toHaveProperty('status')
      expect(['modified', 'added', 'deleted']).toContain(first.status)
      // File path should not be truncated (regression check)
      expect(first.file).not.toMatch(/^[a-z]{2}\//)
      expect(first.file.length).toBeGreaterThan(3)
    }
  })

  test('POST /api/tools/claude-code/input returns 404 when no process running', async ({ request }) => {
    const res = await request.post('/api/tools/claude-code/input', {
      data: { nodeId: 'nonexistent-node', input: 'test' },
    })
    expect(res.status()).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('No running process')
  })

  test('DELETE /api/tools/claude-code/run returns killed:false for unknown node', async ({ request }) => {
    const res = await request.delete('/api/tools/claude-code/run?nodeId=nonexistent')
    expect(res.ok()).toBe(true)
    const data = await res.json()
    expect(data.killed).toBe(false)
  })

  test('POST /api/tools/claude-code/run rejects missing params', async ({ request }) => {
    const res = await request.post('/api/tools/claude-code/run', {
      data: {},
    })
    expect(res.status()).toBe(400)
  })

  test('POST /api/tools/claude-code/run rejects codex CLI', async ({ request }) => {
    const res = await request.post('/api/tools/claude-code/run', {
      data: { nodeId: 'test', task: 'hello', cli: 'codex' },
    })
    expect(res.status()).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Only Claude Code')
  })
})

// ── UI Tests ──

test.describe('AI Coding Agent Node in Canvas', () => {
  test('left panel shows AI Coding node in node palette', async ({ page }) => {
    // Navigate to any flow canvas
    await page.goto('/canvas/default-flow')
    await page.waitForLoadState('networkidle')

    // Look for the AI Coding node in the left panel
    const aiCodingNode = page.locator('text=AI Coding').first()
    await expect(aiCodingNode).toBeVisible({ timeout: 10000 })
  })

  test('can drag AI Coding Agent node onto canvas', async ({ page }) => {
    await page.goto('/canvas/default-flow')
    await page.waitForLoadState('networkidle')

    // Find the AI Coding draggable item in left panel
    const dragItem = page.locator('[draggable="true"]').filter({ hasText: /AI Coding|AI 编程/ }).first()
    await expect(dragItem).toBeVisible({ timeout: 10000 })

    // Get canvas area
    const canvas = page.locator('.react-flow__pane').first()
    await expect(canvas).toBeVisible({ timeout: 10000 })

    // Drag and drop
    const canvasBox = await canvas.boundingBox()
    if (canvasBox) {
      await dragItem.dragTo(canvas, {
        targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 2 },
      })
    }

    // Verify node was created on canvas
    await page.waitForTimeout(1000)
    const nodeOnCanvas = page.locator('.react-flow__node').filter({ hasText: /AI Coding|AI 编程|aiCodingAgent/ })
    await expect(nodeOnCanvas.first()).toBeVisible({ timeout: 5000 })
  })

  test('AI Coding Agent node shows install status', async ({ page }) => {
    await page.goto('/canvas/default-flow')
    await page.waitForLoadState('networkidle')

    // Drag AI Coding node to canvas
    const dragItem = page.locator('[draggable="true"]').filter({ hasText: /AI Coding|AI 编程/ }).first()
    const canvas = page.locator('.react-flow__pane').first()
    await expect(dragItem).toBeVisible({ timeout: 10000 })
    await expect(canvas).toBeVisible({ timeout: 10000 })

    const canvasBox = await canvas.boundingBox()
    if (canvasBox) {
      await dragItem.dragTo(canvas, {
        targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 2 },
      })
    }

    await page.waitForTimeout(2000)

    // Node should show either "Ready"/"就绪" (installed) or "Not detected"/"未检测到" (not installed)
    const node = page.locator('.react-flow__node').filter({ hasText: /AI Coding|AI 编程|aiCodingAgent/ }).first()
    await expect(node).toBeVisible({ timeout: 5000 })

    // Check for either installed or not-installed state
    const readyText = node.locator('text=/Ready|就绪/')
    const notInstalledText = node.locator('text=/Not detected|未检测到/')
    const hasReady = await readyText.isVisible().catch(() => false)
    const hasNotInstalled = await notInstalledText.isVisible().catch(() => false)
    expect(hasReady || hasNotInstalled).toBe(true)
  })

  test('clicking AI Coding Agent node shows config panel', async ({ page }) => {
    await page.goto('/canvas/default-flow')
    await page.waitForLoadState('networkidle')

    // Drag AI Coding node to canvas
    const dragItem = page.locator('[draggable="true"]').filter({ hasText: /AI Coding|AI 编程/ }).first()
    const canvas = page.locator('.react-flow__pane').first()
    await expect(dragItem).toBeVisible({ timeout: 10000 })
    await expect(canvas).toBeVisible({ timeout: 10000 })

    const canvasBox = await canvas.boundingBox()
    if (canvasBox) {
      await dragItem.dragTo(canvas, {
        targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 2 },
      })
    }

    await page.waitForTimeout(1000)

    // Click the node
    const node = page.locator('.react-flow__node').filter({ hasText: /AI Coding|AI 编程|aiCodingAgent/ }).first()
    await node.click({ force: true })

    await page.waitForTimeout(500)

    // Right panel should show config with CLI choice, task description, working directory
    const rightPanel = page.locator('text=/Claude Code/').first()
    await expect(rightPanel).toBeVisible({ timeout: 10000 })

    // Codex option should be disabled with "Coming soon" text
    const codexOption = page.locator('text=/Codex/').first()
    await expect(codexOption).toBeVisible({ timeout: 3000 })
  })
})

// ── Settings Page ──

test.describe('Settings Page - Claude Code Section', () => {
  test('settings page shows Claude Code integration status', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Should show Claude Code section header
    const sectionHeader = page.locator('text=/Claude Code Integration|Claude Code 集成/')
    await expect(sectionHeader).toBeVisible({ timeout: 10000 })

    // Should show either "Installed" or "Not installed"
    const statusText = page.locator('text=/Installed|已安装|Not installed|未安装/')
    await expect(statusText.first()).toBeVisible({ timeout: 10000 })
  })
})
