import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { requireMutationAuth } from '@/lib/api-auth'

const execFileAsync = promisify(execFile)

interface SkillEntry {
  name: string
  scope: 'global' | 'project'
  path: string
}

async function scanSkillsDir(dir: string, scope: 'global' | 'project'): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        skills.push({ name: entry.name, scope, path: path.join(dir, entry.name) })
      }
    }
  } catch { /* dir doesn't exist */ }
  return skills
}

export async function GET(req: NextRequest) {
  const cli = req.nextUrl.searchParams.get('cli') || 'claude'
  const configDir = cli === 'codex' ? '.codex' : '.claude'
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  const globalDir = path.join(homeDir, configDir, 'skills')
  const projectDir = path.join(process.cwd(), configDir, 'skills')

  const globalSkills = await scanSkillsDir(globalDir, 'global')
  const projectSkills = await scanSkillsDir(projectDir, 'project')

  return NextResponse.json({ skills: [...globalSkills, ...projectSkills] })
}

export async function POST(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const body = await req.json() as { repoUrl: string; cli?: string }
  const { repoUrl } = body
  if (!repoUrl) {
    return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 })
  }

  // Validate URL format
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(repoUrl)) {
    return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 })
  }

  const configDir = (body.cli === 'codex') ? '.codex' : '.claude'
  const projectSkillsDir = path.join(process.cwd(), configDir, 'skills')
  await fs.mkdir(projectSkillsDir, { recursive: true })

  const repoName = repoUrl.split('/').pop()?.replace(/\.git$/, '') || 'skill'
  const targetDir = path.join(projectSkillsDir, repoName)

  try {
    await execFileAsync('git', ['clone', '--depth', '1', repoUrl, targetDir], { timeout: 30000 })
    return NextResponse.json({ installed: true, name: repoName, path: targetDir })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Clone failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const name = req.nextUrl.searchParams.get('name')
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const cli = req.nextUrl.searchParams.get('cli') || 'claude'
  const configDir = cli === 'codex' ? '.codex' : '.claude'
  const projectDir = path.join(process.cwd(), configDir, 'skills', name)
  try {
    await fs.rm(projectDir, { recursive: true, force: true })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
