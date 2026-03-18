import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { readIndividualRegistry, addIndividualEntry } from '@/lib/registry-manager'
import { requireMutationAuth } from '@/lib/api-auth'

const INDIVIDUALS_DIR = path.join(process.cwd(), 'agents', 'individuals')

export async function GET() {
  try {
    const registry = await readIndividualRegistry()
    return Response.json(registry)
  } catch {
    return Response.json({ individuals: [] })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  try {
    const body = await req.json() as {
      name: string
      description?: string
      role?: string
      systemPrompt_zh?: string
      systemPrompt_en?: string
      tools?: string[]
      skills?: string[]
      model?: string
      provider?: string
      maxIterations?: number
      personality?: {
        thinkingStyle?: string
        communicationStyle?: string
        valueOrientation?: string
        backstory?: string
        beliefs?: string
      }
      memory?: string
    }

    const cleanName = body.name.trim()
      .replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '')
    if (!cleanName) {
      return Response.json({ error: 'Invalid name' }, { status: 400 })
    }

    const description = body.description || ''
    const role = body.role || ''

    // Build agent.md with dual-language frontmatter
    const frontmatter = [
      '---',
      `name: ${cleanName}`,
      `description: ${description}`,
      `role: ${role}`,
      `provider: ${body.provider || 'anthropic'}`,
      `model: ${body.model || 'claude-sonnet-4-6'}`,
      `maxIterations: ${body.maxIterations || 10}`,
    ]
    if (body.systemPrompt_zh) {
      frontmatter.push(`systemPrompt_zh: "${body.systemPrompt_zh.replace(/"/g, '\\"')}"`)
    }
    if (body.systemPrompt_en) {
      frontmatter.push(`systemPrompt_en: "${body.systemPrompt_en.replace(/"/g, '\\"')}"`)
    }
    if (body.tools?.length) {
      frontmatter.push('tools:')
      body.tools.forEach(t => frontmatter.push(`  - ${t}`))
    }
    if (body.skills?.length) {
      frontmatter.push('skills:')
      body.skills.forEach(s => frontmatter.push(`  - ${s}`))
    }
    // Personality config
    if (body.personality) {
      const p = body.personality
      if (p.thinkingStyle) frontmatter.push(`thinkingStyle: ${p.thinkingStyle}`)
      if (p.communicationStyle) frontmatter.push(`communicationStyle: ${p.communicationStyle}`)
      if (p.valueOrientation) frontmatter.push(`valueOrientation: ${p.valueOrientation}`)
      if (p.backstory) frontmatter.push(`backstory: "${p.backstory.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
      if (p.beliefs) frontmatter.push(`beliefs: "${p.beliefs.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
    }
    frontmatter.push('---')

    const agentDir = path.join(INDIVIDUALS_DIR, cleanName)
    await fs.mkdir(agentDir, { recursive: true })
    await fs.writeFile(path.join(agentDir, 'agent.md'), frontmatter.join('\n'), 'utf-8')

    // Write memory.md: use provided memory content, or create default if not exists
    const memoryPath = path.join(agentDir, 'memory.md')
    if (body.memory && body.memory.trim()) {
      await fs.writeFile(memoryPath, body.memory, 'utf-8')
    } else {
      try { await fs.access(memoryPath) } catch {
        await fs.writeFile(memoryPath, '# Memory\n', 'utf-8')
      }
    }

    const memoryCount = body.memory ? (body.memory.match(/^## /gm) || []).length : 0
    await addIndividualEntry({
      name: cleanName,
      description,
      role,
      runCount: 0,
      memoryCount,
      createdAt: Date.now(),
    })

    return Response.json({ name: cleanName })
  } catch (err) {
    console.error('[agents/individuals POST]', err)
    return Response.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}
