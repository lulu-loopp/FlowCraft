import { useCallback } from 'react'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'
import type { Node } from '@xyflow/react'

/**
 * Parse individual agent frontmatter into a node data patch.
 * Pure function — no store dependency — so it can be reused outside React.
 */
export function parseIndividualContent(content: string, agentName: string, lang: string): Record<string, unknown> {
  const fm = content.match(/^---\n([\s\S]*?)\n---/)?.[1] || ''
  const get = (key: string) => {
    const m = fm.match(new RegExp(`^${key}:\\s*"?(.*?)"?\\s*$`, 'm'))
    return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : ''
  }
  const getList = (key: string): string[] => {
    const m = fm.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, 'm'))
    if (!m) return []
    return m[1].split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
  }
  const systemPromptZh = get('systemPrompt_zh')
  const systemPromptEn = get('systemPrompt_en')
  const systemPrompt = (lang === 'zh' ? systemPromptZh : systemPromptEn) || systemPromptZh || systemPromptEn
  const patch: Record<string, unknown> = {
    systemPrompt, individualName: agentName,
    provider: get('provider') || undefined, model: get('model') || undefined,
    maxIterations: parseInt(get('maxIterations')) || 10,
    enabledTools: getList('tools'), enabledSkills: getList('skills'),
  }
  const name = get('name'), role = get('role')
  const ts = get('thinkingStyle'), cs = get('communicationStyle')
  const vo = get('valueOrientation'), bs = get('backstory'), bl = get('beliefs')
  if (ts || cs || vo || bs || bl || name || role) {
    patch.personality = {
      ...(name && { name }), ...(role && { role }),
      ...(ts && { thinkingStyle: ts }), ...(cs && { communicationStyle: cs }),
      ...(vo && { valueOrientation: vo }), ...(bs && { backstory: bs }), ...(bl && { beliefs: bl }),
    }
  }
  return patch
}

/**
 * Refresh all referenced individual nodes in the store with latest data from disk.
 * Call after loading a flow to ensure individual agents are up-to-date.
 */
export async function refreshIndividualNodes(nodes: Node[], lang?: string): Promise<Node[]> {
  if (!lang) {
    try {
      const stored = JSON.parse(localStorage.getItem('flowcraft-ui') || '{}')
      lang = (stored?.state?.lang as string) || 'zh'
    } catch { lang = 'zh' }
  }
  // Collect unique individual names
  const individualNames = new Set<string>()
  for (const n of nodes) {
    if (n.data?.individualName && n.data?.isReference) {
      individualNames.add(n.data.individualName as string)
    }
  }
  if (individualNames.size === 0) return nodes

  // Fetch all individual definitions in parallel
  const patches = new Map<string, Record<string, unknown>>()
  await Promise.all(
    [...individualNames].map(async (name) => {
      try {
        const res = await fetch(`/api/agents/individuals/${encodeURIComponent(name)}`)
        if (!res.ok) return
        const json = await res.json()
        const content = json.content as string || ''
        patches.set(name, parseIndividualContent(content, name, lang))
      } catch { /* skip */ }
    })
  )

  if (patches.size === 0) return nodes

  // Apply patches to all matching nodes
  return nodes.map(n => {
    if (!n.data?.individualName || !n.data?.isReference) return n
    const patch = patches.get(n.data.individualName as string)
    if (!patch) return n
    // Preserve node-specific label if it differs from the individual name
    return { ...n, data: { ...n.data, ...patch } }
  })
}

/**
 * Hook that returns a function to async-load individual agent data into a node.
 */
export function useLoadIndividual() {
  return useCallback(async (nodeId: string, agentName: string) => {
    try {
      const res = await fetch(`/api/agents/individuals/${encodeURIComponent(agentName)}`)
      if (!res.ok) return
      const json = await res.json()
      const content = json.content as string || ''
      const currentLang = useUIStore.getState().lang
      const patch = parseIndividualContent(content, agentName, currentLang)
      const store = useFlowStore.getState()
      store.setNodes(store.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    } catch { /* ignore */ }
  }, [])
}
