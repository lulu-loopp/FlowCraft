import { extractMdMetadata } from '@/lib/github-downloader'

export interface AgentManifest {
  name: string
  description: string
  content: string
  instructions: string
}

// 解析 agent.md 内容，提取 frontmatter 和指令
// 支持 YAML frontmatter 和表格格式两种
export function parseAgentMd(content: string): AgentManifest {
  // 先尝试 YAML frontmatter（严格格式，带指令内容）
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)

  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1]
    const instructions = frontmatterMatch[2].trim()

    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m)

    if (nameMatch && descMatch) {
      const name = nameMatch[1].trim().replace(/['"]/g, '')
      const description = descMatch[1].trim().replace(/['"]/g, '')

      if (!/^[a-z0-9_-]+$/.test(name)) {
        throw new Error('Agent name must be lowercase letters, numbers, hyphens, and underscores only')
      }

      return { name, description, content, instructions }
    }
  }

  // 回退：尝试表格格式（0xfurai 风格）
  const meta = extractMdMetadata(content)
  if (meta) {
    const name = meta.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '')
    if (!name) {
      throw new Error('Invalid agent.md: could not extract a valid name')
    }
    return { name, description: meta.description, content, instructions: content.trim() }
  }

  throw new Error('Invalid agent.md: missing frontmatter (--- block) or table metadata')
}
