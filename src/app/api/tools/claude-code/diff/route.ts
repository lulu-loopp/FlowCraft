import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

export async function GET(req: NextRequest) {
  const workDir = req.nextUrl.searchParams.get('workDir') || process.cwd()

  // Validate workDir to prevent path traversal
  const resolvedDir = path.resolve(workDir)
  const projectRoot = path.resolve(process.cwd())
  if (!resolvedDir.startsWith(projectRoot + path.sep) && resolvedDir !== projectRoot) {
    return NextResponse.json({ error: 'Invalid working directory' }, { status: 400 })
  }

  try {
    // Get git status to find changed files
    const { stdout } = await execFileAsync(
      'git',
      ['status', '--porcelain', '-u'],
      { cwd: workDir, timeout: 10000 }
    )

    const changes: { file: string; status: 'modified' | 'added' | 'deleted' }[] = []

    for (const line of stdout.split('\n')) {
      if (line.length < 4) continue
      const code = line.substring(0, 2)
      const file = line.substring(3)
      const statusChar = code.trim()

      if (statusChar === 'D') {
        changes.push({ file, status: 'deleted' })
      } else if (statusChar === '??' || statusChar === 'A') {
        changes.push({ file, status: 'added' })
      } else if (statusChar === 'M' || statusChar === 'MM') {
        changes.push({ file, status: 'modified' })
      } else {
        changes.push({ file, status: 'modified' })
      }
    }

    return NextResponse.json({ changes })
  } catch {
    // Not a git repo or git not available
    return NextResponse.json({ changes: [], error: 'Could not read git status' })
  }
}
