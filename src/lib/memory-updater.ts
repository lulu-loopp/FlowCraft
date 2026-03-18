/** Memory storage: append, compress, backup, save, read. */

import { refreshAgentLibrary } from '@/hooks/useAgentLibrary'
import {
  parseMemoryFile, serializeMemoryItems, isOldFormat, migrateToNewFormat,
  countMemoryItems, type MemoryItem,
} from './memory-parser'
import { callLightModel, type DistillResult } from './memory-distiller'

export { parseMemoryFile, serializeMemoryItems, isOldFormat, migrateToNewFormat, countMemoryItems }
export type { MemoryItem }
export { distillExecutionMemory, distillFeedbackMemory, distillChatMemory, CHAT_DISTILL_PROMPT, type DistillResult } from './memory-distiller'

export function formatMemoryEntry(tag: string, content: string): string {
  return `### ${new Date().toISOString().slice(0, 10)} [${tag}]\n${content}\n`
}

/** Append memory to the appropriate section, with migration and compression. */
export async function appendMemory(
  memoryPath: { flowId: string; nodeId: string; individualName?: string },
  result: DistillResult,
  agentName?: string,
): Promise<void> {
  try {
    const currentMemory = await readPrivateMemory(
      memoryPath.flowId, memoryPath.nodeId, memoryPath.individualName,
    )

    let memory = currentMemory
    if (memory && isOldFormat(memory)) {
      memory = migrateToNewFormat(memory, agentName)
    }

    const items = parseMemoryFile(memory)

    if (result.targetSection === 'style') {
      items.push({ id: `style-${Date.now()}`, section: 'style', content: result.content })
    } else {
      const ts = new Date().toISOString().slice(0, 10)
      items.push({
        id: `exp-${Date.now()}`, section: 'experience',
        date: ts, tag: result.tag, content: result.content,
      })
    }

    const expItems = items.filter(i => i.section === 'experience')
    if (expItems.length > 50) {
      await compressExperience(items, memoryPath, agentName)
      return
    }

    await saveMemory(memoryPath, serializeMemoryItems(items, agentName))
  } catch { /* silent */ }
}

async function compressExperience(
  items: MemoryItem[],
  memoryPath: { flowId: string; nodeId: string; individualName?: string },
  agentName?: string,
): Promise<void> {
  try {
    await backupMemory(memoryPath, serializeMemoryItems(items, agentName))

    const expItems = items.filter(i => i.section === 'experience')
    const styleItems = items.filter(i => i.section === 'style')
    const toKeep = expItems.slice(-25)
    const toCompress = expItems.slice(0, -25)

    const compressText = toCompress
      .map(i => `${i.date && i.tag ? `[${i.tag}] ` : ''}${i.content}`)
      .join('\n')

    const compressed = await callLightModel(
      '将以下经验条目压缩为 10 条最重要的行为准则，优先保留反思类记忆。每条一行，200字以内。',
      compressText,
    )

    const compressedItems: MemoryItem[] = compressed
      ? compressed.split('\n').filter(l => l.trim()).map((line, i) => ({
          id: `exp-compressed-${i}`, section: 'experience' as const,
          date: new Date().toISOString().slice(0, 10), tag: '压缩',
          content: line.replace(/^[-·•]\s*/, ''),
        }))
      : []

    await saveMemory(
      memoryPath,
      serializeMemoryItems([...styleItems, ...compressedItems, ...toKeep], agentName),
    )
  } catch { /* silent */ }
}

type MemPath = { flowId: string; nodeId: string; individualName?: string }

async function backupMemory(p: MemPath, content: string): Promise<void> {
  if (!p.individualName) return
  try {
    await fetch(`/api/agents/individuals/${p.individualName}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memoryBackup: content }),
    })
  } catch { /* silent */ }
}

async function saveMemory(p: MemPath, content: string): Promise<void> {
  const newCount = countMemoryItems(content)
  if (p.individualName) {
    await fetch(`/api/agents/individuals/${p.individualName}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory: content, memoryCount: newCount }),
    })
    refreshAgentLibrary()
  } else {
    await fetch(`/api/memory/${p.flowId}/${p.nodeId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  }
}

export async function incrementRunCount(name: string): Promise<void> {
  try {
    const res = await fetch(`/api/agents/individuals/${name}`)
    if (!res.ok) return
    const data = await res.json()
    await fetch(`/api/agents/individuals/${name}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runCount: (data.entry?.runCount || 0) + 1 }),
    })
    refreshAgentLibrary()
  } catch { /* silent */ }
}

export async function readPrivateMemory(flowId: string, nodeId: string, individualName?: string): Promise<string> {
  try {
    if (individualName) {
      const res = await fetch(`/api/agents/individuals/${individualName}`)
      if (!res.ok) return ''
      return (await res.json()).memory || ''
    }
    const res = await fetch(`/api/memory/${flowId}/${nodeId}`)
    if (!res.ok) return ''
    return (await res.json()).content || ''
  } catch { return '' }
}
