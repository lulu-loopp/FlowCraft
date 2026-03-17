import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { parseGitHubUrl, downloadSingleMdFile } from '@/lib/github-downloader'
import { readAgentRegistry, addAgentEntry } from '@/lib/registry-manager'
import { parseAgentMd } from '@/lib/agents/agent-loader'
import { requireMutationAuth } from '@/lib/api-auth'
import type { ScannedItem } from '@/types/registry'

const AGENTS_DIR = path.join(process.cwd(), 'agents')

export async function GET() {
  try {
    const registry = await readAgentRegistry()
    return Response.json(registry)
  } catch {
    return Response.json({ agents: [] })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const body = await req.json() as {
    source: string
    selectedItems?: ScannedItem[]  // 用户选中要安装的 agent
  }

  const token = process.env.GITHUB_TOKEN
  const installed: string[] = []
  const errors: string[] = []

  try {
    const { owner, repo, ref } = parseGitHubUrl(body.source)
    const selectedItems = body.selectedItems ?? []

    for (const item of selectedItems) {
      try {
        const files = await downloadSingleMdFile(owner, repo, item.filePath, ref, token)

        const mdFile = files.find((f) => f.path.endsWith('.md'))
        if (!mdFile) continue

        const manifest = parseAgentMd(mdFile.content)
        const agentDir = path.join(AGENTS_DIR, manifest.name)
        await fs.mkdir(agentDir, { recursive: true })

        for (const file of files) {
          const filePath = path.join(agentDir, file.path)
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          await fs.writeFile(filePath, file.content)
        }

        await addAgentEntry({
          name: manifest.name,
          description: manifest.description,
          source: body.source,
          installedAt: Date.now(),
          enabled: true,
          path: `agents/${manifest.name}`,
        })

        installed.push(manifest.name)
      } catch (err) {
        errors.push(
          `${item.name}: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      }
    }

    return Response.json({ installed, errors })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
