import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { readPackRegistry, addPackEntry } from '@/lib/registry-manager'
import { requireMutationAuth } from '@/lib/api-auth'

const PACKS_DIR = path.join(process.cwd(), 'agents', 'packs')

export async function GET() {
  try {
    const registry = await readPackRegistry()
    return Response.json(registry)
  } catch {
    return Response.json({ packs: [] })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  try {
    const body = await req.json() as {
      name: string
      description?: string
      instructions: string
      flow: { nodes: unknown[]; edges: unknown[] }
    }

    const cleanName = body.name.trim()
      .replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '')
    if (!cleanName) {
      return Response.json({ error: 'Invalid name' }, { status: 400 })
    }

    const description = body.description || `Pack: ${cleanName}`

    // Build pack.md
    const packMd = [
      '---',
      `name: ${cleanName}`,
      `description: ${description}`,
      `model: claude-sonnet-4-6`,
      '---',
      '',
      body.instructions,
    ].join('\n')

    const packDir = path.join(PACKS_DIR, cleanName)
    await fs.mkdir(packDir, { recursive: true })
    await fs.writeFile(path.join(packDir, 'pack.md'), packMd, 'utf-8')
    await fs.writeFile(
      path.join(packDir, 'flow.json'),
      JSON.stringify(body.flow, null, 2),
      'utf-8'
    )

    // Create memory.md if not exists
    const memoryPath = path.join(packDir, 'memory.md')
    try { await fs.access(memoryPath) } catch {
      await fs.writeFile(memoryPath, '# Memory\n', 'utf-8')
    }

    const nodeCount = Array.isArray(body.flow?.nodes) ? body.flow.nodes.length : 0

    await addPackEntry({
      name: cleanName,
      description,
      nodeCount,
      runCount: 0,
      createdAt: Date.now(),
    })

    return Response.json({ name: cleanName })
  } catch (err) {
    console.error('[agents/packs POST]', err)
    return Response.json({ error: 'Failed to create pack' }, { status: 500 })
  }
}
