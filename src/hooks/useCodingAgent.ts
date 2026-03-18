'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export interface FileChange {
  file: string
  status: 'modified' | 'added' | 'deleted'
}

export interface TerminalLine {
  type: 'output' | 'stderr' | 'user' | 'system'
  content: string
  ts: number
}

interface UseCodingAgentOptions {
  nodeId: string
  onComplete?: (output: string) => void
  onError?: (error: string) => void
}

export function useCodingAgent({ nodeId, onComplete, onError }: UseCodingAgentOptions) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [fileChanges, setFileChanges] = useState<FileChange[]>([])
  const [isWaiting, setIsWaiting] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [fullOutput, setFullOutput] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const outputAccRef = useRef('')

  const addLine = useCallback((line: TerminalLine) => {
    setLines(prev => [...prev.slice(-200), line])
  }, [])

  const run = useCallback(async (task: string, workDir?: string, timeoutMinutes = 10, cli = 'claude') => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('running')
    setLines([])
    setFileChanges([])
    setIsWaiting(false)
    setStartTime(Date.now())
    setFullOutput('')
    outputAccRef.current = ''

    try {
      const res = await fetch('/api/tools/claude-code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, task, workDir, timeoutMinutes, cli }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        setStatus('error')
        onError?.(`Failed to start ${cli === 'codex' ? 'Codex' : 'Claude Code'}`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const eventMatch = part.match(/^event: (\w+)\ndata: ([\s\S]+)$/)
          if (!eventMatch) continue
          const [, event, dataStr] = eventMatch
          let data: Record<string, unknown>
          try { data = JSON.parse(dataStr) } catch { continue }

          switch (event) {
            case 'text':
            case 'output': {
              const content = extractContent(data, cli)
              if (content) {
                outputAccRef.current += content + '\n'
                addLine({ type: 'output', content, ts: Date.now() })
                const waiting = /\?\s*$|waiting|confirm|y\/n|\(yes\/no\)/i.test(content)
                setIsWaiting(waiting)
              }
              break
            }
            case 'stderr':
              addLine({ type: 'stderr', content: data.content as string, ts: Date.now() })
              break
            case 'done': {
              const code = data.code as number
              if (code === 0) {
                setStatus('success')
                const diffRes = await fetch(`/api/tools/claude-code/diff?workDir=${encodeURIComponent(workDir || '')}`)
                if (diffRes.ok) {
                  const diffData = await diffRes.json()
                  setFileChanges(diffData.changes || [])
                }
                setFullOutput(outputAccRef.current)
                onComplete?.(outputAccRef.current)
              } else {
                setStatus('error')
                onError?.(`Process exited with code ${code}`)
              }
              break
            }
            case 'error':
              setStatus('error')
              addLine({ type: 'system', content: data.message as string, ts: Date.now() })
              onError?.(data.message as string)
              break
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setStatus('error')
        onError?.((err as Error).message)
      }
    }
  }, [nodeId, addLine, onComplete, onError])

  const sendInput = useCallback(async (input: string) => {
    addLine({ type: 'user', content: `> ${input}`, ts: Date.now() })
    setIsWaiting(false)
    await fetch('/api/tools/claude-code/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, input }),
    })
  }, [nodeId, addLine])

  const stop = useCallback(async () => {
    abortRef.current?.abort()
    await fetch(`/api/tools/claude-code/run?nodeId=${nodeId}`, { method: 'DELETE' })
    setStatus('idle')
  }, [nodeId])

  useEffect(() => {
    return () => {
      fetch(`/api/tools/claude-code/run?nodeId=${nodeId}`, { method: 'DELETE' }).catch(() => {})
    }
  }, [nodeId])

  return {
    status,
    lines,
    fileChanges,
    isWaiting,
    startTime,
    fullOutput,
    run,
    sendInput,
    stop,
  }
}

/** Extract displayable content from an SSE output event */
function extractContent(data: Record<string, unknown>, cli: string): string {
  if (cli === 'codex') {
    // Codex JSONL format
    const type = data.type as string
    if (type === 'item.completed') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = data.item as any
      if (item?.type === 'agent_message') return item.text || ''
      if (item?.type === 'command_execution') {
        const parts = []
        if (item.command) parts.push(`$ ${item.command}`)
        if (item.aggregated_output) parts.push(item.aggregated_output)
        return parts.join('\n')
      }
    }
    if (type === 'turn.completed') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usage = data.usage as any
      if (usage) return `[tokens: in=${usage.input_tokens}, out=${usage.output_tokens}]`
    }
    return ''
  }

  // Claude stream-json
  return (data.content as string) || (data.result as string) || JSON.stringify(data)
}
