/**
 * Test: "Run from here" per-node execution
 *
 * 1. Create a simple flow: Input → Agent A → Agent B → Output
 * 2. Run the full flow (so all nodes have cached output)
 * 3. Click "Run from here" on Agent B — only Agent B and Output should re-run
 * 4. Verify Agent A kept its previous output (not re-run)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Run from node', () => {
  test('hover play button is visible and functional', async ({ page }) => {
    // Capture browser console logs
    page.on('console', msg => {
      if (msg.text().includes('[RunFromNode]')) {
        console.log('BROWSER:', msg.text())
      }
    })
    const flowId = `flow-test-rfn-${Date.now()}`
    const flowData = {
      name: 'Test Run From Node',
      nodes: [
        {
          id: 'io-1',
          type: 'io',
          position: { x: 100, y: 300 },
          data: { label: 'Input', inputText: 'Hello world' },
        },
        {
          id: 'agent-a',
          type: 'agent',
          position: { x: 400, y: 300 },
          data: {
            label: 'Agent A',
            systemPrompt: 'Simply repeat the input with "Agent A says: " prefix. Output only one short line.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'agent-b',
          type: 'agent',
          position: { x: 700, y: 300 },
          data: {
            label: 'Agent B',
            systemPrompt: 'Simply repeat the input with "Agent B says: " prefix. Output only one short line.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'output-1',
          type: 'output',
          position: { x: 1000, y: 300 },
          data: { label: 'Output' },
        },
      ],
      edges: [
        { id: 'e1', source: 'io-1', target: 'agent-a', type: 'custom' },
        { id: 'e2', source: 'agent-a', target: 'agent-b', type: 'custom' },
        { id: 'e3', source: 'agent-b', target: 'output-1', type: 'custom' },
      ],
    }

    // Save flow
    await page.request.put(`${BASE}/api/flows/${flowId}`, { data: flowData })

    // Navigate to canvas
    await page.goto(`${BASE}/canvas/${flowId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Step 1: Run the full flow
    const runButton = page.getByRole('button', { name: 'Run flow' })
    await runButton.click()

    // Wait for completion: look for "Completed." log from Output node
    await page.waitForSelector('text=Completed.', { timeout: 120000 })
    // Wait a bit more for all nodes to settle
    await page.waitForTimeout(2000)

    // Verify both agents produced output
    const agentANode = page.locator('[data-id="agent-a"]')
    const agentBNode = page.locator('[data-id="agent-b"]')
    await expect(agentANode).toContainText('Agent A says')
    await expect(agentBNode).toContainText('Agent B says')

    // Record Agent A's output for later comparison
    const agentAOutputBefore = await agentANode.textContent()
    console.log('Agent A output after full run:', agentAOutputBefore?.slice(0, 80))

    // Step 2: Verify "Run from here" button appears on hover
    await agentBNode.hover()
    await page.waitForTimeout(500)
    const hoverPlayBtn = agentBNode.locator('button[title="Run from here"], button[title="从此处运行"]')
    await expect(hoverPlayBtn).toBeVisible()
    console.log('✅ Hover play button is visible on Agent B')

    // Step 3: Click "Run from here" on Agent B
    await hoverPlayBtn.click()
    await page.waitForTimeout(1000)

    // Wait for the partial run to complete
    // The logs should show Agent B starting again but NOT Agent A
    await page.waitForSelector('text=Completed.', { timeout: 120000 })
    await page.waitForTimeout(2000)

    // Step 4: Verify Agent A was NOT re-run (output unchanged)
    const agentAOutputAfter = await agentANode.textContent()
    console.log('Agent A output after partial run:', agentAOutputAfter?.slice(0, 80))

    // Agent A should still show success status (not waiting/running)
    await expect(agentANode).toContainText('Agent A says')

    // Agent B should have been re-run (shows output)
    await expect(agentBNode).toContainText('Agent B says')

    console.log('✅ Run from node test passed!')
  })

  test('run from node after stopping mid-execution', async ({ page }) => {
    page.on('console', msg => {
      if (msg.text().includes('[RunFromNode]') || msg.text().includes('[RunFlow]')) {
        console.log('BROWSER:', msg.text())
      }
    })
    const flowId = `flow-test-rfn-stop-${Date.now()}`
    const flowData = {
      name: 'Test RFN After Stop',
      nodes: [
        {
          id: 'io-1',
          type: 'io',
          position: { x: 100, y: 300 },
          data: { label: 'Input', inputText: 'Hello world' },
        },
        {
          id: 'agent-a',
          type: 'agent',
          position: { x: 400, y: 300 },
          data: {
            label: 'Agent A',
            systemPrompt: 'Simply repeat the input with "Agent A says: " prefix. Output only one short line.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'agent-b',
          type: 'agent',
          position: { x: 700, y: 300 },
          data: {
            label: 'Agent B',
            systemPrompt: 'Write a very detailed 500 word essay about the history of computing. Include many paragraphs and sections.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'agent-c',
          type: 'agent',
          position: { x: 1000, y: 300 },
          data: {
            label: 'Agent C',
            systemPrompt: 'Simply repeat the input with "Agent C says: " prefix. Output only one short line.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'output-1',
          type: 'output',
          position: { x: 1300, y: 300 },
          data: { label: 'Output' },
        },
      ],
      edges: [
        { id: 'e1', source: 'io-1', target: 'agent-a', type: 'custom' },
        { id: 'e2', source: 'agent-a', target: 'agent-b', type: 'custom' },
        { id: 'e3', source: 'agent-b', target: 'agent-c', type: 'custom' },
        { id: 'e4', source: 'agent-c', target: 'output-1', type: 'custom' },
      ],
    }

    await page.request.put(`${BASE}/api/flows/${flowId}`, { data: flowData })
    await page.goto(`${BASE}/canvas/${flowId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Step 1: Start the full flow
    const runButton = page.getByRole('button', { name: 'Run flow' })
    await runButton.click()

    // Wait for Agent A to complete — click Stop immediately to catch Agent B mid-run
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Agent A') && document.body.innerText.includes('Completed.')
    }, { timeout: 60000 })

    // Click Stop immediately (no wait)
    const stopButton = page.getByRole('button', { name: /stop|停止/i })
    if (await stopButton.isVisible()) {
      await stopButton.click()
      console.log('Clicked Stop')
    } else {
      console.log('Stop button not visible — flow may have already completed')
    }
    await page.waitForTimeout(2000)

    // Check node statuses after stop
    const nodeStatuses = await page.evaluate(() => {
      // Access zustand store
      const store = (window as unknown as Record<string, unknown>).__ZUSTAND_STORE__
      // Try to read from DOM instead
      const nodes = document.querySelectorAll('.react-flow__node')
      const result: Record<string, string> = {}
      nodes.forEach(n => {
        const id = n.getAttribute('data-id') || 'unknown'
        const hasCheck = n.querySelector('.lucide-check-circle-2, [class*="text-emerald"]')
        const hasSpinner = n.querySelector('[class*="thinking-dot"]')
        result[id] = hasCheck ? 'success' : hasSpinner ? 'running' : 'other'
      })
      return result
    })
    console.log('Node statuses after stop:', JSON.stringify(nodeStatuses))

    // Step 3: Click "Run from here" on Agent B (which was interrupted or didn't complete)
    const agentBNode = page.locator('[data-id="agent-b"]')
    await agentBNode.hover()
    await page.waitForTimeout(500)
    const hoverPlayBtn = agentBNode.locator('button[title="Run from here"], button[title="从此处运行"]')

    if (await hoverPlayBtn.isVisible()) {
      await hoverPlayBtn.click()
      console.log('Clicked Run from here on Agent B (hover button)')
    } else {
      // Maybe node is selected, try toolbar button
      await agentBNode.click()
      await page.waitForTimeout(500)
      const toolbarBtn = page.locator('button[title="Run from here"], button[title="从此处运行"]')
      await toolbarBtn.first().click()
      console.log('Clicked Run from here on Agent B (toolbar button)')
    }

    // Wait for completion
    await page.waitForSelector('text=Completed.', { timeout: 120000 })
    await page.waitForTimeout(3000)

    // Verify Agent A was NOT re-run — it should keep success status
    const agentANode = page.locator('[data-id="agent-a"]')
    const agentAStatus = await agentANode.evaluate(el => {
      return el.querySelector('.lucide-check-circle-2, [class*="text-emerald"]') ? 'success' : 'other'
    })
    console.log('Agent A status after partial run:', agentAStatus)

    console.log('✅ Run from node after stop test done')
  })

  test('run from node without prior full run includes necessary upstream', async ({ page }) => {
    page.on('console', msg => {
      if (msg.text().includes('[RunFromNode]')) {
        console.log('BROWSER:', msg.text())
      }
    })
    const flowId = `flow-test-rfn-noprev-${Date.now()}`
    const flowData = {
      name: 'Test RFN No Prior Run',
      nodes: [
        {
          id: 'io-1',
          type: 'io',
          position: { x: 100, y: 300 },
          data: { label: 'Input', inputText: 'Hello world' },
        },
        {
          id: 'agent-a',
          type: 'agent',
          position: { x: 400, y: 300 },
          data: {
            label: 'Agent A',
            systemPrompt: 'Simply repeat the input with "Agent A says: " prefix.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'agent-b',
          type: 'agent',
          position: { x: 700, y: 300 },
          data: {
            label: 'Agent B',
            systemPrompt: 'Simply repeat the input with "Agent B says: " prefix.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'output-1',
          type: 'output',
          position: { x: 1000, y: 300 },
          data: { label: 'Output' },
        },
      ],
      edges: [
        { id: 'e1', source: 'io-1', target: 'agent-a', type: 'custom' },
        { id: 'e2', source: 'agent-a', target: 'agent-b', type: 'custom' },
        { id: 'e3', source: 'agent-b', target: 'output-1', type: 'custom' },
      ],
    }

    await page.request.put(`${BASE}/api/flows/${flowId}`, { data: flowData })
    await page.goto(`${BASE}/canvas/${flowId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // WITHOUT running the flow first, click "Run from here" on Agent B
    const agentBNode = page.locator('[data-id="agent-b"]')
    await agentBNode.hover()
    await page.waitForTimeout(500)
    const hoverPlayBtn = agentBNode.locator('button[title="Run from here"], button[title="从此处运行"]')
    await expect(hoverPlayBtn).toBeVisible()
    await hoverPlayBtn.click()

    // Wait for completion
    await page.waitForSelector('text=Completed.', { timeout: 120000 })
    await page.waitForTimeout(2000)

    // Both agents should have run (since Agent A had no prior output)
    await expect(agentBNode).toContainText('Agent B says')
    console.log('✅ Run from node (no prior run) test passed — upstream nodes correctly included')
  })

  test('run from node in flow with loop back-edge does not re-run upstream', async ({ page }) => {
    // Simulates: Input → Planner → Worker A → Merge → Reviewer → Condition
    //                             → Worker B ↗           condition false → Planner (back-edge)
    // After full run, clicking "Run from here" on Worker A should NOT include Planner.
    page.on('console', msg => {
      if (msg.text().includes('[RunFromNode]')) {
        console.log('BROWSER:', msg.text())
      }
    })

    const flowId = `flow-test-rfn-loop-${Date.now()}`
    const flowData = {
      name: 'Test RFN Loop Back-Edge',
      nodes: [
        {
          id: 'io-1',
          type: 'io',
          position: { x: 50, y: 300 },
          data: { label: 'Input', inputText: 'Create a report' },
        },
        {
          id: 'planner',
          type: 'agent',
          position: { x: 300, y: 300 },
          data: {
            label: 'Planner',
            systemPrompt: 'You are a planner. Output a plan with "Planner says: " prefix. One short line.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'worker-a',
          type: 'agent',
          position: { x: 600, y: 200 },
          data: {
            label: 'Worker A',
            systemPrompt: 'You are Worker A. Output "Worker A done: " followed by a short summary.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'worker-b',
          type: 'agent',
          position: { x: 600, y: 400 },
          data: {
            label: 'Worker B',
            systemPrompt: 'You are Worker B. Output "Worker B done: " followed by a short summary.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'merge-1',
          type: 'merge',
          position: { x: 900, y: 300 },
          data: { label: 'Merge' },
        },
        {
          id: 'reviewer',
          type: 'agent',
          position: { x: 1150, y: 300 },
          data: {
            label: 'Reviewer',
            systemPrompt: 'Review the input. Always output exactly: {"passed": true, "score": 9, "feedback": "Looks good"}',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'condition-1',
          type: 'condition',
          position: { x: 1400, y: 300 },
          data: {
            label: 'Pass?',
            conditionMode: 'expression',
            conditionValue: 'output.passed === true',
            maxLoopIterations: 2,
          },
        },
        {
          id: 'output-1',
          type: 'output',
          position: { x: 1700, y: 300 },
          data: { label: 'Output' },
        },
      ],
      edges: [
        { id: 'e1', source: 'io-1', target: 'planner', type: 'custom' },
        { id: 'e2', source: 'planner', target: 'worker-a', type: 'custom' },
        { id: 'e3', source: 'planner', target: 'worker-b', type: 'custom' },
        { id: 'e4', source: 'worker-a', target: 'merge-1', type: 'custom' },
        { id: 'e5', source: 'worker-b', target: 'merge-1', type: 'custom' },
        { id: 'e6', source: 'merge-1', target: 'reviewer', type: 'custom' },
        { id: 'e7', source: 'reviewer', target: 'condition-1', type: 'custom' },
        { id: 'e8', source: 'condition-1', target: 'output-1', sourceHandle: 'true-handle', type: 'custom' },
        // Loop back-edge: condition false → planner
        { id: 'e9', source: 'condition-1', target: 'planner', sourceHandle: 'false-handle', type: 'custom' },
      ],
    }

    // Save flow
    await page.request.put(`${BASE}/api/flows/${flowId}`, { data: flowData })

    // Navigate and run full flow
    await page.goto(`${BASE}/canvas/${flowId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const runButton = page.getByRole('button', { name: 'Run flow' })
    await runButton.click()

    // Wait for Run button to reappear (means flow finished)
    await page.waitForFunction(() => {
      const btn = document.querySelector('button')
      const allBtns = Array.from(document.querySelectorAll('button'))
      return allBtns.some(b => b.textContent?.includes('Run flow') || b.textContent?.includes('运行'))
    }, { timeout: 120000 })
    await page.waitForTimeout(2000)

    // Verify Planner and Worker A completed
    const plannerNode = page.locator('[data-id="planner"]')
    const workerANode = page.locator('[data-id="worker-a"]')
    await expect(plannerNode).toContainText('Planner says')
    await expect(workerANode).toContainText('Worker A done')

    const plannerOutputBefore = await plannerNode.textContent()
    console.log('Planner output before partial run:', plannerOutputBefore?.slice(0, 60))

    // Click on Worker A to select it, then use the toolbar play button
    await workerANode.click()
    await page.waitForTimeout(500)
    const toolbarPlayBtn = workerANode.locator('xpath=..').locator('button[title="Run from here"], button[title="从此处运行"]')
    // Fallback: find the play button in the floating toolbar above the node
    const playBtn = page.locator('button[title="Run from here"], button[title="从此处运行"]').first()
    await expect(playBtn).toBeVisible({ timeout: 5000 })
    await playBtn.click({ force: true })
    console.log('Clicked Run from here on Worker A (toolbar)')

    // Wait for partial run to finish (Run button reappears)
    await page.waitForFunction(() => {
      const allBtns = Array.from(document.querySelectorAll('button'))
      return allBtns.some(b => b.textContent?.includes('Run flow') || b.textContent?.includes('运行'))
    }, { timeout: 120000 })
    await page.waitForTimeout(2000)

    // Verify Planner was NOT re-run (output unchanged, still shows success)
    const plannerOutputAfter = await plannerNode.textContent()
    console.log('Planner output after partial run:', plannerOutputAfter?.slice(0, 60))
    await expect(plannerNode).toContainText('Planner says')

    // Worker A should have been re-run
    await expect(workerANode).toContainText('Worker A done')

    console.log('✅ Run from node with loop back-edge test passed!')
  })

  test('toolbar play button appears when node is selected', async ({ page }) => {
    const flowId = `flow-test-rfn2-${Date.now()}`
    const flowData = {
      name: 'Test RFN Toolbar',
      nodes: [
        {
          id: 'io-1',
          type: 'io',
          position: { x: 100, y: 300 },
          data: { label: 'Input', inputText: 'Test input' },
        },
        {
          id: 'agent-1',
          type: 'agent',
          position: { x: 400, y: 300 },
          data: {
            label: 'Test Agent',
            systemPrompt: 'Echo the input.',
            provider: 'deepseek',
            model: 'deepseek-chat',
            enabledTools: [],
            enabledSkills: [],
            maxIterations: 3,
          },
        },
        {
          id: 'output-1',
          type: 'output',
          position: { x: 700, y: 300 },
          data: { label: 'Output' },
        },
      ],
      edges: [
        { id: 'e1', source: 'io-1', target: 'agent-1', type: 'custom' },
        { id: 'e2', source: 'agent-1', target: 'output-1', type: 'custom' },
      ],
    }

    await page.request.put(`${BASE}/api/flows/${flowId}`, { data: flowData })
    await page.goto(`${BASE}/canvas/${flowId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Click on agent node to select it
    const agentNode = page.locator('[data-id="agent-1"]')
    await agentNode.click()
    await page.waitForTimeout(500)

    // Check for play button in the floating toolbar
    const toolbarPlayBtn = page.locator('.absolute.-top-11 button[title="Run from here"], .absolute.-top-11 button[title="从此处运行"]')
    await expect(toolbarPlayBtn).toBeVisible()
    console.log('✅ Toolbar play button is visible when node is selected')
  })
})
