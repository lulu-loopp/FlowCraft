import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { setProcess, killProcess } from '@/lib/coding-agent-process'
import { requireMutationAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

function findBin(name: string): { bin: string; shell: boolean } {
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const candidates: string[] = []
  if (home) {
    candidates.push(path.join(home, '.local', 'bin', `${name}.exe`))
    candidates.push(path.join(home, '.local', 'bin', name))
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    candidates.push(path.join(appData, 'npm', `${name}.cmd`))
    candidates.push(path.join(appData, 'npm', name))
  }
  for (const c of candidates) {
    try { fs.accessSync(c); return { bin: c, shell: c.endsWith('.cmd') } } catch {}
  }
  // Fallback: use shell to resolve from PATH
  return { bin: name, shell: true }
}

export async function POST(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const body = await req.json()
  const {
    nodeId,
    task,
    workDir,
    timeoutMinutes = 10,
    cli = 'claude',
  } = body as {
    nodeId: string
    task: string
    workDir?: string
    timeoutMinutes?: number
    cli?: string
  }

  if (!nodeId || !task) {
    return new Response(JSON.stringify({ error: 'nodeId and task are required' }), { status: 400 })
  }

  if (cli !== 'claude' && cli !== 'codex') {
    return new Response(JSON.stringify({ error: 'cli must be claude or codex' }), { status: 400 })
  }

  const timeoutMs = timeoutMinutes * 60 * 1000

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      let proc
      const cleanEnv = { ...process.env }

      if (cli === 'codex') {
        const { bin, shell } = findBin('codex')
        const args = [
          'exec',
          '--json',
          '--dangerously-bypass-approvals-and-sandbox',
          '--ephemeral',
        ]
        if (workDir) args.push('-C', workDir)
        args.push(task)

        proc = spawn(bin, args, {
          cwd: workDir || process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: cleanEnv,
          shell,
        })
      } else {
        const { bin, shell } = findBin('claude')
        const args = ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', task]
        delete cleanEnv.ANTHROPIC_API_KEY
        proc = spawn(bin, args, {
          cwd: workDir || process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: cleanEnv,
          shell,
        })
      }

      proc.stdin.end()
      setProcess(nodeId, proc, timeoutMs)
      send('start', { nodeId, pid: proc.pid, cli })

      let buffer = ''
      proc.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            send('output', parsed)
          } catch {
            send('text', { content: trimmed })
          }
        }
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        send('stderr', { content: chunk.toString() })
      })

      proc.on('close', (code) => {
        if (buffer.trim()) {
          try {
            send('output', JSON.parse(buffer.trim()))
          } catch {
            send('text', { content: buffer.trim() })
          }
        }
        send('done', { code })
        killProcess(nodeId)
        controller.close()
      })

      proc.on('error', (err) => {
        send('error', { message: err.message })
        killProcess(nodeId)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

export async function DELETE(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const nodeId = req.nextUrl.searchParams.get('nodeId')
  if (!nodeId) {
    return new Response(JSON.stringify({ error: 'nodeId required' }), { status: 400 })
  }
  const killed = killProcess(nodeId)
  return new Response(JSON.stringify({ killed }))
}
