/**
 * Builds the system prompt for a node inside a packed node,
 * injecting pack-level memory and individual agent memory in the correct priority order.
 */
import { buildFullSystemPrompt } from '@/lib/personality-injector'
import { readPrivateMemory } from '@/lib/memory-updater'
import type { PersonalityConfig } from '@/lib/personality-injector'
import type { Node } from '@xyflow/react'

export interface PackMemoryContext {
  /** The pack's overall memory (from agents/packs/{name}/memory.md) */
  packMemory: string
  /** Parent pack memory when nested (outer pack's memory) */
  parentPackMemory?: string
}

/**
 * Read pack memory from the API.
 */
export async function readPackMemory(packName: string): Promise<string> {
  if (!packName) return ''
  try {
    const res = await fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
    if (!res.ok) return ''
    const data = await res.json()
    // memory.md content is served alongside pack data
    return data.memory || ''
  } catch {
    return ''
  }
}

/**
 * Build the full system prompt for a node inside a pack.
 *
 * For a regular agent (no individualName):
 *   ## [Pack memory]
 *   [Node system prompt]
 *
 * For an individual agent (has individualName):
 *   ## [Individual's work style]     ← highest priority
 *   [Individual's personal experience]
 *   ## [Pack memory]
 *   [Individual's system prompt]
 *
 * parentPackMemory is injected before packMemory (outer → inner).
 */
export async function buildPackedNodePrompt(
  node: Node,
  flowId: string,
  packCtx: PackMemoryContext,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = node.data as any
  const personality = data.personality as PersonalityConfig | undefined
  const individualName = data.individualName as string | undefined
  const rawPrompt = (data.systemPrompt as string) || 'You are a helpful assistant.'

  // Read the node's own private memory
  const privateMemory = await readPrivateMemory(flowId, node.id, individualName)

  // Combine pack memories: parent pack memory + current pack memory
  const packMemoryParts: string[] = []
  if (packCtx.parentPackMemory?.trim()) {
    packMemoryParts.push(packCtx.parentPackMemory.trim())
  }
  if (packCtx.packMemory?.trim()) {
    packMemoryParts.push(packCtx.packMemory.trim())
  }
  const combinedPackMemory = packMemoryParts.join('\n\n---\n\n')

  if (individualName && personality) {
    // Individual agent: full prompt (personality + memory sections + system prompt)
    // then pack memory inserted as team context
    const fullPrompt = buildFullSystemPrompt(personality, rawPrompt, privateMemory)
    const sections: string[] = []
    if (fullPrompt) sections.push(fullPrompt)
    if (combinedPackMemory) {
      sections.push(`## Team Context\n${combinedPackMemory}`)
    }
    return sections.join('\n\n---\n\n')
  }

  // Regular agent: pack memory → system prompt (with personality if any)
  const basePrompt = buildFullSystemPrompt(personality, rawPrompt, privateMemory)
  if (combinedPackMemory) {
    return `## Team Context\n${combinedPackMemory}\n\n---\n\n${basePrompt}`
  }
  return basePrompt
}
