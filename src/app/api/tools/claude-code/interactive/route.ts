import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
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
  return { bin: name, shell: true }
}

/**
 * POST: Send a single message in a conversation.
 * Body: { conversationId?, message, workDir?, cli? }
 * Returns SSE stream with the response.
 *
 * Claude: uses -p + --conversation-id for multi-turn
 * Codex:  uses exec (first) or exec resume <threadId> (subsequent) + --json
 */
export async function POST(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const { conversationId, message, workDir, cli = 'claude' } = await req.json() as {
    conversationId?: string
    message: string
    workDir?: string
    cli?: string
  }

  if (!message) {
    return new Response(JSON.stringify({ error: 'message is required' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      const cleanEnv = { ...process.env }
      let proc

      if (cli === 'codex') {
        const { bin, shell } = findBin('codex')
        let args: string[]

        if (conversationId) {
          args = [
            'exec', 'resume', conversationId,
            '--json',
            '--dangerously-bypass-approvals-and-sandbox',
            message,
          ]
        } else {
          args = [
            'exec',
            '--json',
            '--dangerously-bypass-approvals-and-sandbox',
          ]
          if (workDir) args.push('-C', workDir)
          args.push(message)
        }

        proc = spawn(bin, args, {
          cwd: workDir || process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: cleanEnv,
          shell,
        })
      } else {
        const { bin, shell } = findBin('claude')
        const args = [
          '-p', message,
          '--output-format', 'stream-json',
          '--verbose',
          '--dangerously-skip-permissions',
        ]
        if (conversationId) {
          args.push('--conversation-id', conversationId)
        }
        delete cleanEnv.ANTHROPIC_API_KEY

        proc = spawn(bin, args, {
          cwd: workDir || process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: cleanEnv,
          shell,
        })
      }

      proc.stdin.end()

      let buffer = ''
      let detectedConversationId = conversationId || ''

      proc.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            // Capture conversation/thread ID
            if (cli === 'claude' && parsed.type === 'system' && parsed.conversation_id) {
              detectedConversationId = parsed.conversation_id
            }
            if (cli === 'codex' && parsed.type === 'thread.started' && parsed.thread_id) {
              detectedConversationId = parsed.thread_id
            }
            send('message', { ...parsed, _cli: cli })
          } catch {
            send('message', { type: 'text', content: trimmed, _cli: cli })
          }
        }
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim()
        if (text) {
          send('stderr', { content: text })
        }
      })

      proc.on('close', (code) => {
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim())
            if (cli === 'claude' && parsed.type === 'system' && parsed.conversation_id) {
              detectedConversationId = parsed.conversation_id
            }
            if (cli === 'codex' && parsed.type === 'thread.started' && parsed.thread_id) {
              detectedConversationId = parsed.thread_id
            }
            send('message', { ...parsed, _cli: cli })
          } catch {
            send('message', { type: 'text', content: buffer.trim(), _cli: cli })
          }
        }
        send('done', { code, conversationId: detectedConversationId })
        controller.close()
      })

      proc.on('error', (err) => {
        send('error', { message: err.message })
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
