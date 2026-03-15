import type { SkillManifest } from '@/types/skill'

// 解析 SKILL.md 内容，提取 frontmatter 和指令
export function parseSkillMd(content: string): SkillManifest {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)

  if (!frontmatterMatch) {
    throw new Error('Invalid SKILL.md: missing frontmatter (--- block)')
  }

  const frontmatter = frontmatterMatch[1]
  const instructions = frontmatterMatch[2].trim()

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m)

  if (!nameMatch) throw new Error('Invalid SKILL.md: missing name in frontmatter')
  if (!descMatch) throw new Error('Invalid SKILL.md: missing description in frontmatter')

  const name = nameMatch[1].trim().replace(/['"]/g, '')
  const description = descMatch[1].trim().replace(/['"]/g, '')

  if (!/^[a-z0-9_-]+$/.test(name)) {
    throw new Error('Skill name must be lowercase letters, numbers, hyphens, and underscores only')
  }

  return { name, description, content, instructions }
}

// 把各种输入格式解析成可 fetch 的 URL
// 返回 null 表示这是原始内容，不需要 fetch
export function resolveSkillSource(input: string): string | null {
  const trimmed = input.trim()

  // 已经是 .md 直链
  if (trimmed.startsWith('http') && trimmed.endsWith('.md')) {
    return trimmed
  }

  // skills.sh 格式
  if (trimmed.includes('skills.sh/')) {
    return `${trimmed}/skill.md`
  }

  // smithery.ai 格式
  if (trimmed.includes('smithery.ai/skills/')) {
    return trimmed.replace('smithery.ai/skills/', 'smithery.ai/') + '/skill.md'
  }

  // GitHub 仓库链接
  if (trimmed.includes('github.com/')) {
    const cleaned = trimmed.replace(/\/$/, '')

    if (cleaned.includes('/tree/') || cleaned.includes('/blob/')) {
      // /tree/branch 或 /blob/branch/file — branch 已在 URL 里
      const raw = cleaned
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/tree/', '/')
        .replace('/blob/', '/')
      if (raw.endsWith('.md')) return raw
      return `${raw}/SKILL.md`
    } else {
      // github.com/user/repo → 用 main 分支
      const raw = cleaned.replace('github.com', 'raw.githubusercontent.com')
      if (raw.endsWith('.md')) return raw
      return `${raw}/main/SKILL.md`
    }
  }

  // 短格式 user/repo 或 user/repo/branch
  if (/^[\w-]+\/[\w-]+(\/[\w.-]+)?$/.test(trimmed)) {
    const parts = trimmed.split('/')
    if (parts.length === 3) {
      // 第三段是分支名，不是子目录
      return `https://raw.githubusercontent.com/${trimmed}/SKILL.md`
    }
    // user/repo → 用 main 分支
    return `https://raw.githubusercontent.com/${trimmed}/main/SKILL.md`
  }

  // 其他 http URL
  if (trimmed.startsWith('http')) {
    return trimmed
  }

  // 不是 URL，当作原始 SKILL.md 内容处理
  return null
}

// 从 URL 加载并解析 SKILL.md（通过服务端代理避免 CORS）
export async function loadSkillFromUrl(url: string): Promise<SkillManifest> {
  const response = await fetch('/api/skill/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(
      data.error ?? `Failed to fetch skill from ${url} (${response.status})`
    )
  }

  const { content } = await response.json() as { content: string }
  return parseSkillMd(content)
}

// 主入口：从任意输入加载 skill
export async function loadSkill(input: string): Promise<{
  manifest: SkillManifest
  source: string
}> {
  const url = resolveSkillSource(input)

  if (url) {
    const manifest = await loadSkillFromUrl(url)
    return { manifest, source: input }
  } else {
    const manifest = parseSkillMd(input)
    return { manifest, source: 'manual' }
  }
}
