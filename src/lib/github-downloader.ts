import type { ScanResult, ScannedItem } from '@/types/registry'

interface GitHubFile {
  name: string
  path: string
  type: 'file' | 'dir'
  download_url: string | null
  sha: string
}

export interface DownloadedFile {
  path: string      // 相对路径
  content: string   // 文件内容
}

// 解析各种 GitHub URL 格式，返回标准化的 owner/repo/path/ref/isFile
export function parseGitHubUrl(input: string): {
  owner: string
  repo: string
  path: string
  ref: string
  isFile: boolean
} {
  const trimmed = input.trim()

  let url = trimmed
  if (!url.startsWith('http')) {
    url = `https://github.com/${url}`
  }

  // /blob/ 表示具体文件
  const blobMatch = url.match(
    /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/
  )
  if (blobMatch) {
    const [, owner, repo, ref, path] = blobMatch
    return { owner, repo, path, ref, isFile: true }
  }

  // /tree/ 表示目录
  const treeMatch = url.match(
    /github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/
  )
  if (treeMatch) {
    const [, owner, repo, ref = 'main', path = ''] = treeMatch
    return { owner, repo, path, ref, isFile: false }
  }

  // 短格式：owner/repo 或 owner/repo/some/path.md
  if (/^[\w.-]+\/[\w.-]+(\/.*)?$/.test(trimmed)) {
    const parts = trimmed.split('/')
    const owner = parts[0]
    const repo = parts[1]
    const path = parts.slice(2).join('/')
    const isFile = path.endsWith('.md')
    return { owner, repo, path, ref: 'main', isFile }
  }

  throw new Error(`Cannot parse GitHub URL: ${input}`)
}

// 递归获取 GitHub 目录下所有文件
async function listFiles(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  token?: string
): Promise<GitHubFile[]> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
  const response = await fetch(apiUrl, { headers })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Add GITHUB_TOKEN to .env.local to increase the limit.')
    }
    if (response.status === 404) {
      throw new Error(`Path not found: ${path} in ${owner}/${repo}@${ref}`)
    }
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const items: GitHubFile[] = await response.json()
  const allFiles: GitHubFile[] = []

  for (const item of items) {
    if (item.type === 'file') {
      allFiles.push(item)
    } else if (item.type === 'dir') {
      const subFiles = await listFiles(owner, repo, item.path, ref, token)
      allFiles.push(...subFiles)
    }
  }

  return allFiles
}

// 下载单个文件内容
async function downloadFile(
  downloadUrl: string,
  token?: string
): Promise<string> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(downloadUrl, { headers })
  if (!response.ok) throw new Error(`Failed to download file: ${downloadUrl}`)
  return response.text()
}

// 从 .md 文件内容提取 name 和 description
// 支持两种格式：
// 格式1 - YAML frontmatter：
//   ---
//   name: actix-expert
//   description: Expert in Actix...
//   ---
//
// 格式2 - 表格格式（0xfurai 风格）：
//   | name | description | model |
//   |------|-------------|-------|
//   | actix-expert | Expert in Actix... | claude-sonnet-4 |
export function extractMdMetadata(content: string): {
  name: string
  description: string
} | null {
  // 尝试 YAML frontmatter
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (yamlMatch) {
    const frontmatter = yamlMatch[1]
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
    if (nameMatch && descMatch) {
      return {
        name: nameMatch[1].trim().replace(/['"]/g, ''),
        description: descMatch[1].trim().replace(/['"]/g, ''),
      }
    }
  }

  // 尝试表格格式
  const tableMatch = content.match(
    /\|\s*name\s*\|\s*description\s*\|[\s\S]*?\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/i
  )
  if (tableMatch) {
    return {
      name: tableMatch[1].trim(),
      description: tableMatch[2].trim(),
    }
  }

  return null
}

// 扫描 GitHub 仓库，返回找到的 agent/skill 列表（不下载内容，只获取元数据）
export async function scanGitHubRepo(
  input: string,
  fileType: 'skill' | 'agent',
  token?: string
): Promise<ScanResult> {
  const { owner, repo, path, ref, isFile } = parseGitHubUrl(input)

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  // 如果是具体文件 URL，直接下载并解析，不扫描目录
  if (isFile && path.endsWith('.md')) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`
    const response = await fetch(rawUrl, { headers })
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${rawUrl}`)
    }
    const content = await response.text()
    const meta = extractMdMetadata(content)
    const name = meta?.name ?? path.split('/').pop()!.replace('.md', '')

    return {
      type: 'single',
      source: input,
      items: [{
        name,
        description: meta?.description ?? '',
        filePath: path,
        selected: true,
      }],
    }
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
  const response = await fetch(apiUrl, { headers })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Add GITHUB_TOKEN to .env.local.')
    }
    if (response.status === 404) {
      throw new Error(`Repository or path not found: ${owner}/${repo}`)
    }
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const items: GitHubFile[] = await response.json()

  // 找 .md 文件（排除 README）
  const mdFiles = items.filter(
    (item) => item.type === 'file' && item.name.endsWith('.md') &&
    item.name.toLowerCase() !== 'readme.md'
  )

  // 找子目录（排除常见非内容目录）
  const dirs = items.filter((item) => item.type === 'dir' &&
    !['node_modules', '.github', 'docs', 'examples'].includes(item.name)
  )

  // 如果根目录只有一个相关 .md 文件（SKILL.md 或 agent.md）
  const skillMd = mdFiles.find((f) => f.name.toLowerCase() === 'skill.md')
  const agentMd = mdFiles.find((f) => f.name.toLowerCase() === 'agent.md')
  const singleMd = skillMd ?? agentMd

  if (singleMd && mdFiles.length <= 2) {
    const content = await downloadFile(singleMd.download_url!, token)
    const meta = extractMdMetadata(content)
    const name = meta?.name ?? singleMd.name.replace('.md', '')
    const description = meta?.description ?? ''

    return {
      type: 'single',
      source: input,
      items: [{
        name,
        description,
        filePath: singleMd.path,
        selected: true,
      }],
    }
  }

  // 如果根目录有多个 .md 文件（集合仓库）
  if (mdFiles.length > 1) {
    const scannedItems: ScannedItem[] = []
    for (const file of mdFiles) {
      if (!file.download_url) continue
      const content = await downloadFile(file.download_url, token)
      const meta = extractMdMetadata(content)
      const name = meta?.name ?? file.name.replace('.md', '')
      scannedItems.push({
        name,
        description: meta?.description ?? '',
        filePath: file.path,
        selected: true,
      })
    }
    return { type: 'collection', source: input, items: scannedItems }
  }

  // 如果根目录没有 .md 但有命名为 agents/skills/subagents 的子目录，递归进去
  const namedDir = dirs.find(
    (d) => ['agents', 'skills', 'subagents'].includes(d.name.toLowerCase())
  )
  if (namedDir) {
    const subInput = `https://github.com/${owner}/${repo}/tree/${ref}/${namedDir.path}`
    return scanGitHubRepo(subInput, fileType, token)
  }

  // 情况：根目录全是子文件夹，每个子文件夹里有 SKILL.md 或 agent.md
  // 例如 anthropics/skills/tree/main/skills
  if (mdFiles.length === 0 && dirs.length > 0) {
    const scannedItems: ScannedItem[] = []

    for (const dir of dirs) {
      try {
        const subDirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${dir.path}?ref=${ref}`
        const subResponse = await fetch(subDirUrl, { headers })
        if (!subResponse.ok) continue

        const subItems: GitHubFile[] = await subResponse.json()
        const mdFile = subItems.find(
          (f) => f.type === 'file' &&
            f.name.endsWith('.md') &&
            f.name.toLowerCase() !== 'readme.md'
        )
        if (!mdFile || !mdFile.download_url) continue

        const content = await downloadFile(mdFile.download_url, token)
        const meta = extractMdMetadata(content)
        const name = meta?.name ?? dir.name

        scannedItems.push({
          name,
          description: meta?.description ?? '',
          filePath: mdFile.path,
          selected: true,
        })
      } catch {
        continue
      }
    }

    if (scannedItems.length === 0) {
      throw new Error(
        'No SKILL.md or agent .md files found. Make sure each subfolder contains a SKILL.md file.'
      )
    }

    return { type: 'collection', source: input, items: scannedItems }
  }

  throw new Error('No .md files found in the repository. Make sure the repo contains SKILL.md or agent .md files.')
}

// 下载单个 .md 文件及其同级资源（scripts/、references/ 等）
export async function downloadSingleMdFile(
  owner: string,
  repo: string,
  filePath: string,    // 如 'agents/actix-expert.md'
  ref: string,
  token?: string
): Promise<DownloadedFile[]> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  // 下载 .md 文件本身
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`
  const content = await downloadFile(rawUrl, token)

  const files: DownloadedFile[] = [
    { path: filePath.split('/').pop()!, content }
  ]

  // 检查 .md 所在目录（存放 scripts、references 等同级资源）
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/'))
  try {
    const dirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}?ref=${ref}`
    const dirResponse = await fetch(dirUrl, { headers })
    if (dirResponse.ok) {
      const subFiles = await listFiles(owner, repo, dirPath, ref, token)
      for (const subFile of subFiles) {
        if (!subFile.download_url) continue
        const subContent = await downloadFile(subFile.download_url, token)
        const relativePath = subFile.path.slice(dirPath.length + 1)
        files.push({ path: relativePath, content: subContent })
      }
    }
  } catch {
    // 没有同名目录，忽略
  }

  return files
}

// 主函数：下载整个 GitHub 目录，返回文件列表
export async function downloadGitHubFolder(
  input: string,
  token?: string
): Promise<{
  files: DownloadedFile[]
  name: string    // 文件夹名（最后一段路径）
}> {
  const { owner, repo, path, ref } = parseGitHubUrl(input)

  const folderName = path
    ? path.split('/').pop() ?? repo
    : repo

  const files = await listFiles(owner, repo, path, ref, token)

  const downloaded: DownloadedFile[] = []
  for (const file of files) {
    if (!file.download_url) continue
    const content = await downloadFile(file.download_url, token)

    const relativePath = path
      ? file.path.slice(path.length + 1)
      : file.path

    downloaded.push({ path: relativePath, content })
  }

  return { files: downloaded, name: folderName }
}
