import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { requireMutationAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const { name } = await req.json() as { name: string }

  if (!name) {
    return NextResponse.json({ path: null })
  }

  const homedir = process.env.USERPROFILE || process.env.HOME || ''

  // Try common locations where the user might pick a folder
  const candidates = [
    path.join(process.cwd(), name),
    path.join(process.cwd(), '..', name),
  ]

  if (homedir) {
    candidates.push(
      path.join(homedir, name),
      path.join(homedir, 'Desktop', name),
      path.join(homedir, 'Documents', name),
      path.join(homedir, 'Projects', name),
      path.join(homedir, 'Developer', name),
      path.join(homedir, 'Source', name),
      path.join(homedir, 'repos', name),
    )
  }

  // Check common drive roots on Windows
  if (process.platform === 'win32') {
    for (const drive of ['C:', 'D:', 'E:']) {
      candidates.push(
        path.join(drive, '\\', name),
        path.join(drive, '\\Developer', name),
        path.join(drive, '\\Projects', name),
      )
    }
  }

  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate)
      if (stat.isDirectory()) {
        return NextResponse.json({ path: candidate })
      }
    } catch { /* not found */ }
  }

  // Couldn't resolve, return the name as-is
  return NextResponse.json({ path: name })
}
