import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { updateSkillEntry, removeSkillEntry } from '@/lib/registry-manager'
import { requireMutationAuth } from '@/lib/api-auth'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

const SAFE_NAME_RE = /^[\p{L}\p{N}_-]+$/u
function assertSafeName(name: string): void {
  if (!SAFE_NAME_RE.test(name)) throw new Error(`Invalid name: ${name}`)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const { name } = await params
  const body = await req.json() as { enabled: boolean }
  try {
    await updateSkillEntry(name, { enabled: body.enabled })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
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
    const skillDir = path.join(SKILLS_DIR, name)
    await fs.rm(skillDir, { recursive: true, force: true })
    await removeSkillEntry(name)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
