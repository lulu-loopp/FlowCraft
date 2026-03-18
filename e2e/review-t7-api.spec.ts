import { test, expect } from '@playwright/test'

test('T7: API endpoints - curl tests', async ({ request }) => {
  // Test /api/flows
  const flowsRes = await request.get('/api/flows')
  console.log(`GET /api/flows: ${flowsRes.status()}`)
  const flowsData = await flowsRes.json()
  console.log(`  Flows count: ${Array.isArray(flowsData) ? flowsData.length : 'not array'}`)
  expect(flowsRes.ok()).toBe(true)

  // Get a flow ID for further tests
  let flowId = ''
  if (Array.isArray(flowsData) && flowsData.length > 0) {
    flowId = flowsData[0].id
    console.log(`  Using flow ID: ${flowId}`)
  }

  // Test /api/settings - SECURITY: check if API keys are exposed
  const settingsRes = await request.get('/api/settings')
  console.log(`GET /api/settings: ${settingsRes.status()}`)
  if (settingsRes.ok()) {
    const settingsData = await settingsRes.text()
    console.log(`  Settings response length: ${settingsData.length}`)

    // Check for exposed API keys
    const hasSkAnt = settingsData.includes('sk-ant-')
    const hasSkProj = settingsData.includes('sk-proj-')
    const hasSk = /sk-[a-zA-Z0-9]{20,}/.test(settingsData)
    console.log(`  SECURITY: Contains sk-ant-: ${hasSkAnt}`)
    console.log(`  SECURITY: Contains sk-proj-: ${hasSkProj}`)
    console.log(`  SECURITY: Contains long sk- token: ${hasSk}`)

    // Parse and check structure
    try {
      const settings = JSON.parse(settingsData)
      const keys = Object.keys(settings)
      console.log(`  Settings keys: ${keys.join(', ')}`)

      // Check if apiKeys are returned in plaintext
      if (settings.apiKeys) {
        console.log(`  SECURITY: apiKeys present in response!`)
        for (const [k, v] of Object.entries(settings.apiKeys)) {
          const val = v as string
          if (val && val.length > 0) {
            console.log(`  SECURITY: ${k} key returned (length=${val.length}, starts with: ${val.substring(0, 8)}...)`)
          }
        }
      }
    } catch (e) {
      console.log(`  Settings is not JSON`)
    }
  }

  // Test /api/workspace (if flowId available)
  if (flowId) {
    const workspaceRes = await request.get(`/api/workspace/${flowId}/documents`)
    console.log(`GET /api/workspace/${flowId}/documents: ${workspaceRes.status()}`)
  }

  // Test /api/agents
  const agentsRes = await request.get('/api/agents')
  console.log(`GET /api/agents: ${agentsRes.status()}`)
  if (agentsRes.ok()) {
    const data = await agentsRes.text()
    console.log(`  Agents response: ${data.substring(0, 200)}`)
  }

  // Test /api/skills
  const skillsRes = await request.get('/api/skills')
  console.log(`GET /api/skills: ${skillsRes.status()}`)

  // Test /api/memory
  const memoryRes = await request.get('/api/memory')
  console.log(`GET /api/memory: ${memoryRes.status()}`)

  // Test POST to /api/flows without auth
  const createRes = await request.post('/api/flows', {
    data: { name: 'test-review-flow', nodes: [], edges: [] }
  })
  console.log(`POST /api/flows: ${createRes.status()}`)

  // Test /api/flows/trash
  const trashRes = await request.get('/api/flows/trash')
  console.log(`GET /api/flows/trash: ${trashRes.status()}`)
})
