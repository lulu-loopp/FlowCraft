import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { parseGitHubUrl, downloadSingleMdFile } from '@/lib/github-downloader'
import { readSkillRegistry, addSkillEntry } from '@/lib/registry-manager'
import { parseSkillMd } from '@/lib/skills/skill-loader'
import { requireMutationAuth } from '@/lib/api-auth'
import type { ScannedItem } from '@/types/registry'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

export async function GET() {
  try {
    const registry = await readSkillRegistry()
    return Response.json(registry)
  } catch {
    return Response.json({ skills: [] })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const body = await req.json() as {
    source: string
    selectedItems?: ScannedItem[]  // GitHub 模式：用户选中的 skill
    manualContent?: string          // manual 模式
  }

  const token = process.env.GITHUB_TOKEN
  const installed: string[] = []
  const errors: string[] = []

  try {
    // manual 模式
    if (body.source === 'manual' && body.manualContent) {
      const manifest = parseSkillMd(body.manualContent)
      const skillDir = path.join(SKILLS_DIR, manifest.name)
      await fs.mkdir(skillDir, { recursive: true })
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), body.manualContent)
      await addSkillEntry({
        name: manifest.name,
        description: manifest.description,
        source: 'manual',
        installedAt: Date.now(),
        enabled: true,
        path: `skills/${manifest.name}`,
      })
      return Response.json({ installed: [manifest.name], errors: [] })
    }

    // GitHub 模式：安装用户选中的 items
    const { owner, repo, ref } = parseGitHubUrl(body.source)
    const selectedItems = body.selectedItems ?? []

    for (const item of selectedItems) {
      try {
        const files = await downloadSingleMdFile(owner, repo, item.filePath, ref, token)

        const mdFile = files.find((f) => f.path.endsWith('.md'))
        if (!mdFile) continue

        const manifest = parseSkillMd(mdFile.content)
        const skillDir = path.join(SKILLS_DIR, manifest.name)
        await fs.mkdir(skillDir, { recursive: true })

        for (const file of files) {
          const filePath = path.join(skillDir, file.path)
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          await fs.writeFile(filePath, file.content)
        }

        await addSkillEntry({
          name: manifest.name,
          description: manifest.description,
          source: body.source,
          installedAt: Date.now(),
          enabled: true,
          path: `skills/${manifest.name}`,
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
