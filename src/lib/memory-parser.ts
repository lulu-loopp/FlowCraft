/**
 * Parse and serialize the two-section memory file format.
 *
 * Format:
 * # {Name} 的行为准则
 * ## 工作风格（用户主动告知，最高优先级）
 * - item 1
 * ## 从经验中学到的（自动提炼）
 * ### 2024-01-15 [成功]
 * Content...
 */

export interface MemoryItem {
  id: string
  section: 'style' | 'experience'
  date?: string
  tag?: string
  content: string
}

/** Parse a memory markdown file into structured items */
export function parseMemoryFile(markdown: string): MemoryItem[] {
  if (!markdown.trim()) return []
  const isNew = markdown.includes('## 工作风格') || markdown.includes('## Work Style')
  if (!isNew) return parseOldFormat(markdown)

  const items: MemoryItem[] = []

  // Parse "工作风格" section
  const styleMatch = markdown.match(/## 工作风格[^\n]*\n([\s\S]*?)(?=\n## 从经验|$)/)
  if (styleMatch) {
    const lines = styleMatch[1].split('\n').filter(l => l.startsWith('- '))
    for (const line of lines) {
      items.push({ id: `style-${items.length}-${Date.now()}`, section: 'style', content: line.slice(2).trim() })
    }
  }

  // Parse "从经验中学到的" section
  const expMatch = markdown.match(/## 从经验中学到的[^\n]*\n([\s\S]*)$/)
  if (expMatch) {
    const blocks = expMatch[1].split(/^### /m).filter(Boolean)
    for (const block of blocks) {
      const firstLine = block.split('\n')[0] || ''
      const tagMatch = firstLine.match(/^([\d-]+(?:\s[\d:]+)?)\s*\[(.+?)\]/)
      const body = block.slice(firstLine.length).trim()
      if (tagMatch) {
        items.push({ id: `exp-${tagMatch[1]}-${items.length}`, section: 'experience', date: tagMatch[1], tag: tagMatch[2], content: body })
      } else if (body || firstLine.trim()) {
        items.push({ id: `exp-${items.length}-${Date.now()}`, section: 'experience', content: (firstLine.trim() + '\n' + body).trim() })
      }
    }
  }
  return items
}

function parseOldFormat(markdown: string): MemoryItem[] {
  const items: MemoryItem[] = []
  const sections = markdown.split(/^## /m).filter(Boolean)
  for (const section of sections) {
    const firstLine = section.split('\n')[0] || ''
    const match = firstLine.match(/^([\d-]+\s[\d:]+)\s*\[(.+?)\]/)
    const body = section.slice(firstLine.length).trim()
    if (match) {
      items.push({ id: `exp-${match[1]}-${items.length}`, section: 'experience', date: match[1], tag: match[2], content: body })
    } else if (body || firstLine.trim()) {
      items.push({ id: `exp-${items.length}-${Date.now()}`, section: 'experience', content: (firstLine.trim() + '\n' + body).trim() })
    }
  }
  return items
}

/** Serialize structured items back to markdown */
export function serializeMemoryItems(items: MemoryItem[], agentName?: string): string {
  const name = agentName || 'Agent'
  const lines: string[] = [`# ${name} 的行为准则`, '', '## 工作风格（用户主动告知，最高优先级）']
  for (const item of items.filter(i => i.section === 'style')) {
    lines.push(`- ${item.content}`)
  }
  lines.push('', '## 从经验中学到的（自动提炼）', '')
  for (const item of items.filter(i => i.section === 'experience')) {
    const ts = item.date || new Date().toISOString().slice(0, 10)
    const tag = item.tag || '手动'
    lines.push(`### ${ts} [${tag}]`, item.content, '')
  }
  return lines.join('\n')
}

export function isOldFormat(markdown: string): boolean {
  if (!markdown.trim()) return false
  return !markdown.includes('## 工作风格') && !markdown.includes('## Work Style')
}

export function migrateToNewFormat(markdown: string, agentName?: string): string {
  return serializeMemoryItems(parseOldFormat(markdown), agentName)
}

export function countMemoryItems(markdown: string): number {
  return parseMemoryFile(markdown).length
}

/** Extract "工作风格" section text for prompt injection */
export function extractStyleSection(markdown: string): string {
  const items = parseMemoryFile(markdown).filter(i => i.section === 'style')
  return items.length ? items.map(i => `- ${i.content}`).join('\n') : ''
}

/** Extract recent N experience items for prompt injection */
export function extractRecentExperience(markdown: string, count = 10): string {
  const items = parseMemoryFile(markdown).filter(i => i.section === 'experience').slice(-count)
  if (!items.length) return ''
  return items.map(i => {
    const header = i.date && i.tag ? `[${i.date} ${i.tag}]` : ''
    return header ? `${header} ${i.content}` : i.content
  }).join('\n')
}
