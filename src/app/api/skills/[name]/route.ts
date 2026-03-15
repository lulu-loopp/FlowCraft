import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { updateSkillEntry, removeSkillEntry } from '@/lib/registry-manager'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
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
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  try {
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
