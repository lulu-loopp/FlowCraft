import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import {
  readIndividualRegistry,
  updateIndividualEntry,
  removeIndividualEntry,
} from '@/lib/registry-manager'
import { requireMutationAuth } from '@/lib/api-auth'

const INDIVIDUALS_DIR = path.join(process.cwd(), 'agents', 'individuals')
const SAFE_NAME_RE = /^[\p{L}\p{N}_-]+$/u

function assertSafeName(name: string): void {
  if (!SAFE_NAME_RE.test(name) || /[./\\]/.test(name)) throw new Error(`Invalid name: ${name}`)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  try {
    assertSafeName(name)
    const agentPath = path.join(INDIVIDUALS_DIR, name, 'agent.md')
    const content = await fs.readFile(agentPath, 'utf-8')
    const registry = await readIndividualRegistry()
    const entry = registry.individuals.find(i => i.name === name)

    // Read memory
    let memory = ''
    let memoryCount = 0
    try {
      memory = await fs.readFile(
        path.join(INDIVIDUALS_DIR, name, 'memory.md'), 'utf-8'
      )
      memoryCount = (memory.match(/^## /gm) || []).length
    } catch { /* no memory file */ }

    return Response.json({ name, content, entry, memory, memoryCount })
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
      content?: string
      description?: string
      role?: string
      runCount?: number
      memoryCount?: number
      memory?: string
      chatHistory?: { timestamp: number; messages: { role: string; content: string }[] }
    }

    if (body.content) {
      await fs.writeFile(
        path.join(INDIVIDUALS_DIR, name, 'agent.md'),
        body.content,
        'utf-8'
      )
    }

    if (body.memory !== undefined) {
      const memPath = path.join(INDIVIDUALS_DIR, name, 'memory.md')
      await fs.mkdir(path.dirname(memPath), { recursive: true })
      await fs.writeFile(memPath, body.memory, 'utf-8')
    }

    if (body.chatHistory) {
      const histDir = path.join(INDIVIDUALS_DIR, name, 'chat-history')
      await fs.mkdir(histDir, { recursive: true })
      const filename = `${body.chatHistory.timestamp}.json`
      await fs.writeFile(
        path.join(histDir, filename),
        JSON.stringify(body.chatHistory.messages, null, 2),
        'utf-8'
      )
    }

    const updates: Record<string, unknown> = {}
    if (body.description !== undefined) updates.description = body.description
    if (body.role !== undefined) updates.role = body.role
    if (body.runCount !== undefined) updates.runCount = body.runCount
    if (body.memoryCount !== undefined) updates.memoryCount = body.memoryCount

    if (Object.keys(updates).length > 0) {
      await updateIndividualEntry(name, updates)
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const { name } = await params
  try {
    assertSafeName(name)
    const { entry } = await req.json() as { entry: string }
    const memPath = path.join(INDIVIDUALS_DIR, name, 'memory.md')
    await fs.mkdir(path.dirname(memPath), { recursive: true })
    await fs.appendFile(memPath, entry, 'utf-8')

    // Update memoryCount in registry
    const content = await fs.readFile(memPath, 'utf-8')
    const count = (content.match(/^## /gm) || []).length
    await updateIndividualEntry(name, { memoryCount: count })

    return Response.json({ ok: true, memoryCount: count })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Append failed' },
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
    await fs.rm(path.join(INDIVIDUALS_DIR, name), { recursive: true, force: true })
    await removeIndividualEntry(name)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
