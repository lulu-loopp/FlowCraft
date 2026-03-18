import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { requireMutationAuth } from '@/lib/api-auth'

const execFileAsync = promisify(execFile)

export const dynamic = 'force-dynamic'

function codexCmd() {
  return 'codex'
}

/** GET — list MCP servers */
export async function GET() {
  try {
    const { stdout } = await execFileAsync(codexCmd(), ['mcp', 'list'], {
      timeout: 10000,
      shell: true,
    })

    // Parse the table output
    const lines = stdout.trim().split('\n').filter(l => l.trim())
    if (lines.length <= 1) return NextResponse.json({ servers: [] })

    const servers = lines.slice(1).map(line => {
      const parts = line.split(/\s{2,}/).map(s => s.trim())
      return {
        name: parts[0] || '',
        command: parts[1] || '',
        enabled: (parts[3] || '').toLowerCase() === 'enabled',
      }
    }).filter(s => s.name)

    return NextResponse.json({ servers })
  } catch {
    return NextResponse.json({ servers: [] })
  }
}

/** POST — add MCP server */
export async function POST(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const { name, command } = await req.json() as { name: string; command: string }
  if (!name || !command) {
    return NextResponse.json({ error: 'name and command are required' }, { status: 400 })
  }

  try {
    // Determine if it's a URL or a command
    const isUrl = command.startsWith('http://') || command.startsWith('https://')
    const args = ['mcp', 'add', name]
    if (isUrl) {
      args.push('--url', command)
    } else {
      const ALLOWED_COMMANDS = ['npx', 'node', 'codex', 'python', 'python3', 'uv', 'uvx']
      const parts = command.split(/\s+/)
      const executable = parts[0]
      if (!ALLOWED_COMMANDS.includes(executable)) {
        return NextResponse.json({ error: `Command not allowed: ${executable}` }, { status: 400 })
      }
      args.push('--', ...parts)
    }

    await execFileAsync(codexCmd(), args, { timeout: 15000, shell: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** DELETE — remove MCP server */
export async function DELETE(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const name = req.nextUrl.searchParams.get('name')
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  try {
    await execFileAsync(codexCmd(), ['mcp', 'remove', name], { timeout: 10000, shell: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
