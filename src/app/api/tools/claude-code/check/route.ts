import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function GET() {
  const results: {
    nodeInstalled: boolean
    nodeVersion: string | null
    claudeInstalled: boolean
    claudeVersion: string | null
    codexInstalled: boolean
    codexVersion: string | null
  } = {
    nodeInstalled: false,
    nodeVersion: null,
    claudeInstalled: false,
    claudeVersion: null,
    codexInstalled: false,
    codexVersion: null,
  }

  // Check Node.js
  try {
    const { stdout } = await execFileAsync('node', ['--version'], { timeout: 5000 })
    results.nodeVersion = stdout.trim()
    results.nodeInstalled = true
  } catch { /* not installed */ }

  // Check Claude CLI
  try {
    const { stdout } = await execFileAsync('claude', ['--version'], {
      timeout: 5000,
      shell: true,
    })
    results.claudeVersion = stdout.trim()
    results.claudeInstalled = true
  } catch { /* not installed */ }

  // Check Codex CLI
  try {
    const { stdout } = await execFileAsync('codex', ['--version'], {
      timeout: 5000,
      shell: true,
    })
    results.codexVersion = stdout.trim()
    results.codexInstalled = true
  } catch { /* not installed */ }

  return NextResponse.json(results)
}
