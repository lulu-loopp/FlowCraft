/**
 * After packed node execution, write memories to their correct locations:
 *   - Pack overall memory → agents/packs/{name}/memory.md
 *   - Individual agent memory → agents/individuals/{name}/memory.md
 *   - Regular agent memory → workspace/{flowId}/memory/{nodeId}.md
 *
 * Each memory is independently written; failures are silent.
 */
import {
  distillExecutionMemory,
  formatMemoryEntry,
  appendMemory,
} from '@/lib/memory-updater'
import type { Node } from '@xyflow/react'

interface PackedMemoryWriteOpts {
  packName: string
  flowId: string
  internalNodes: Node[]
  nodeOutputs: Map<string, string>
  success: boolean
}

/**
 * Append memory to a pack's memory.md via the pack PUT API.
 */
async function appendPackMemory(packName: string, entry: string): Promise<void> {
  try {
    const res = await fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
    if (!res.ok) return
    const data = await res.json()
    const existingMemory = data.memory || ''
    const newMemory = existingMemory + (existingMemory.endsWith('\n') ? '' : '\n') + entry

    await fetch(`/api/agents/packs/${encodeURIComponent(packName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory: newMemory }),
    })
  } catch { /* silent */ }
}

/**
 * Write all three types of memory after packed node execution.
 * Only triggers on success (technical errors don't generate memory).
 */
export async function writePackedMemories(opts: PackedMemoryWriteOpts): Promise<void> {
  const { packName, flowId, internalNodes, nodeOutputs, success } = opts
  if (!success) return // Technical errors: no memory
  const agentNodes = internalNodes.filter(n => n.type === 'agent')
  if (agentNodes.length === 0) return

  const allOutputs = agentNodes
    .map(n => nodeOutputs.get(n.id) || '')
    .filter(Boolean)
    .join('\n---\n')

  const promises: Promise<void>[] = []

  // 1. Pack overall memory
  if (packName && allOutputs) {
    promises.push(
      distillExecutionMemory(allOutputs, `Pack: ${packName}`)
        .then(result => {
          if (!result) return
          const entry = formatMemoryEntry(result.tag, result.content)
          return appendPackMemory(packName, entry)
        })
        .then(() => {})
    )
  }

  // 2. Per-node memory (individual or regular)
  for (const agentNode of agentNodes) {
    const output = nodeOutputs.get(agentNode.id) || ''
    if (!output) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = agentNode.data as any
    const individualName = data.individualName as string | undefined
    const systemPrompt = (data.systemPrompt as string) || ''
    const hasPersonality = !!(data.personality?.name || data.personality?.role)

    if (!hasPersonality && !individualName) continue

    promises.push(
      distillExecutionMemory(output, systemPrompt)
        .then(result => {
          if (!result) return
          return appendMemory(
            { flowId, nodeId: agentNode.id, individualName },
            result,
            data.personality?.name,
          )
        })
        .then(() => {})
    )
  }

  await Promise.allSettled(promises)
}
