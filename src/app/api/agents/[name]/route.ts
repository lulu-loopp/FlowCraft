import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { updateAgentEntry, removeAgentEntry } from '@/lib/registry-manager'

const AGENTS_DIR = path.join(process.cwd(), 'agents')

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const body = await req.json() as { enabled: boolean }
  try {
    await updateAgentEntry(name, { enabled: body.enabled })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  try {
    const agentDir = path.join(AGENTS_DIR, name)
    await fs.rm(agentDir, { recursive: true, force: true })
    await removeAgentEntry(name)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
