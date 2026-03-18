import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import {
  readPackRegistry,
  updatePackEntry,
  removePackEntry,
} from '@/lib/registry-manager'
import { requireMutationAuth } from '@/lib/api-auth'

const PACKS_DIR = path.join(process.cwd(), 'agents', 'packs')
const SAFE_NAME_RE = /^[\p{L}\p{N}_-]+$/u

function assertSafeName(name: string): void {
  if (!SAFE_NAME_RE.test(name)) throw new Error(`Invalid name: ${name}`)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  try {
    assertSafeName(name)
    const packDir = path.join(PACKS_DIR, name)
    const packMd = await fs.readFile(path.join(packDir, 'pack.md'), 'utf-8')

    let flow = null
    try {
      const flowStr = await fs.readFile(path.join(packDir, 'flow.json'), 'utf-8')
      flow = JSON.parse(flowStr)
    } catch { /* no flow.json */ }

    let memory = ''
    try {
      memory = await fs.readFile(path.join(packDir, 'memory.md'), 'utf-8')
    } catch { /* no memory.md yet */ }

    const registry = await readPackRegistry()
    const entry = registry.packs.find(p => p.name === name)

    // Count how many flows reference this pack
    let usageCount = 0
    try {
      const flowsDir = path.join(process.cwd(), 'flows')
      const files = await fs.readdir(flowsDir)
      for (const f of files) {
        if (!f.endsWith('.json') || f === 'index.json') continue
        try {
          const raw = await fs.readFile(path.join(flowsDir, f), 'utf-8')
          if (raw.includes(`"packName":"${name}"`) || raw.includes(`"packName": "${name}"`)) {
            usageCount++
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* flows dir missing */ }

    return Response.json({ name, packMd, flow, entry, memory, usageCount })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Not found' },
      { status: 404 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const { name } = await params
  try {
    assertSafeName(name)
    const body = await req.json() as {
      packMd?: string
      flow?: { nodes: unknown[]; edges: unknown[] }
      description?: string
      runCount?: number
      memory?: string
    }

    const packDir = path.join(PACKS_DIR, name)
    if (body.packMd) {
      await fs.writeFile(path.join(packDir, 'pack.md'), body.packMd, 'utf-8')
    }
    if (body.flow) {
      await fs.writeFile(
        path.join(packDir, 'flow.json'),
        JSON.stringify(body.flow, null, 2),
        'utf-8'
      )
    }
    if (body.memory !== undefined) {
      await fs.writeFile(path.join(packDir, 'memory.md'), body.memory, 'utf-8')
    }

    const updates: Record<string, unknown> = {}
    if (body.description !== undefined) updates.description = body.description
    if (body.runCount !== undefined) updates.runCount = body.runCount
    if (body.flow?.nodes) updates.nodeCount = body.flow.nodes.length

    if (Object.keys(updates).length > 0) {
      await updatePackEntry(name, updates)
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const { name } = await params
  try {
    assertSafeName(name)
    await fs.rm(path.join(PACKS_DIR, name), { recursive: true, force: true })
    await removePackEntry(name)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
