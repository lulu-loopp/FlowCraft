'use client'

import { useState, useRef, useCallback } from 'react'

export interface InteractiveMessage {
  id: string
  type: 'system' | 'assistant' | 'tool_use' | 'tool_result' | 'user' | 'error' | 'result' | 'text'
  content: string
  toolName?: string
  toolInput?: string
  toolId?: string
  isError?: boolean
  ts: number
}

let msgIdCounter = 0
function nextId() { return `msg-${++msgIdCounter}-${Date.now()}` }

export function useInteractiveCoding(nodeId: string) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle')
  const [messages, setMessages] = useState<InteractiveMessage[]>([])
  const conversationIdRef = useRef<string | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const workDirRef = useRef<string | undefined>(undefined)
  const cliRef = useRef<string>('claude')
  const busyRef = useRef(false)
  const queueRef = useRef<string[]>([])
  void nodeId

  const addMessage = useCallback((msg: Omit<InteractiveMessage, 'id' | 'ts'>) => {
    setMessages(prev => [...prev, { ...msg, id: nextId(), ts: Date.now() }])
  }, [])

  const sendOne = useCallback(async (text: string) => {
    busyRef.current = true
    setStatus('connecting')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/tools/claude-code/interactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          message: text,
          workDir: workDirRef.current,
          cli: cliRef.current,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        addMessage({ type: 'error', content: `Request failed (${res.status})` })
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

          if (event === 'done') {
            if (data.conversationId) {
              conversationIdRef.current = data.conversationId as string
            }
            continue
          }

          if (event === 'error') {
            addMessage({ type: 'error', content: (data.message as string) || 'Unknown error' })
            continue
          }

          if (event === 'stderr') continue

          if (event === 'message') {
            const cli = (data._cli as string) || cliRef.current
            if (cli === 'codex') {
              parseCodexMessage(data, addMessage)
            } else {
              parseClaudeMessage(data, addMessage)
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addMessage({ type: 'error', content: (err as Error).message })
      }
    } finally {
      busyRef.current = false
      setStatus('connected')
    }
  }, [addMessage])

  const drainQueue = useCallback(async () => {
    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!
      await sendOne(next)
    }
  }, [sendOne])

  const start = useCallback(async (workDir?: string, cli = 'claude') => {
    workDirRef.current = workDir
    cliRef.current = cli
    conversationIdRef.current = undefined
    queueRef.current = []
    busyRef.current = false
    setStatus('connected')
    const cliName = cli === 'codex' ? 'Codex' : 'Claude Code'
    setMessages([{ id: nextId(), ts: Date.now(), type: 'system', content: `${cliName} session started. Type a message to begin.` }])
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    addMessage({ type: 'user', content: text })

    if (busyRef.current) {
      queueRef.current.push(text)
      addMessage({ type: 'system', content: 'Queued — will send after current response' })
      return
    }

    await sendOne(text)
    await drainQueue()
  }, [addMessage, sendOne, drainQueue])

  const stop = useCallback(async () => {
    abortRef.current?.abort()
    queueRef.current = []
    busyRef.current = false
    conversationIdRef.current = undefined
    setStatus('disconnected')
  }, [])

  return { status, messages, start, sendMessage, stop }
}

// ─── Claude stream-json parser ───

function parseClaudeMessage(data: Record<string, unknown>, addMessage: (msg: Omit<InteractiveMessage, 'id' | 'ts'>) => void) {
  const msgType = data.type as string

  switch (msgType) {
    case 'system':
      break

    case 'assistant': {
      const msg = data.message as Record<string, unknown> | undefined
      if (!msg?.content) break
      for (const block of msg.content as Array<Record<string, unknown>>) {
        if (block.type === 'text') {
          addMessage({ type: 'assistant', content: block.text as string })
        } else if (block.type === 'tool_use') {
          addMessage({
            type: 'tool_use',
            content: '',
            toolName: block.name as string,
            toolInput: typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2),
            toolId: block.id as string,
          })
        }
      }
      break
    }

    case 'content_block_start': {
      const block = data.content_block as Record<string, unknown> | undefined
      if (!block) break
      if (block.type === 'text' && block.text) {
        addMessage({ type: 'assistant', content: block.text as string })
      } else if (block.type === 'tool_use') {
        addMessage({ type: 'tool_use', content: '', toolName: block.name as string, toolId: block.id as string })
      }
      break
    }

    case 'content_block_delta': {
      const delta = data.delta as Record<string, unknown> | undefined
      if (delta?.type === 'text_delta' && delta.text) {
        addMessage({ type: 'text', content: delta.text as string })
      }
      break
    }

    case 'tool_result':
    case 'result': {
      const content = data.result || data.content || data.output || JSON.stringify(data)
      addMessage({
        type: msgType === 'tool_result' ? 'tool_result' : 'result',
        content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
        toolId: data.tool_use_id as string | undefined,
        isError: data.is_error as boolean | undefined,
      })
      break
    }

    case 'error': {
      const error = data.error as Record<string, unknown> | undefined
      addMessage({ type: 'error', content: (error?.message || data.message || data.content || JSON.stringify(data)) as string })
      break
    }

    case 'text':
      addMessage({ type: 'text', content: (data.content as string) || '' })
      break

    default:
      if (data.content || data.result) {
        addMessage({ type: 'text', content: (data.content || data.result) as string })
      }
      break
  }
}

// ─── Codex JSONL parser ───

function parseCodexMessage(data: Record<string, unknown>, addMessage: (msg: Omit<InteractiveMessage, 'id' | 'ts'>) => void) {
  const type = data.type as string

  switch (type) {
    case 'thread.started':
    case 'turn.started':
      break

    case 'item.started': {
      const item = data.item as Record<string, unknown> | undefined
      if (!item) break
      if (item.type === 'command_execution' && item.command) {
        addMessage({
          type: 'tool_use',
          content: '',
          toolName: 'shell',
          toolInput: item.command as string,
          toolId: item.id as string,
        })
      }
      break
    }

    case 'item.completed': {
      const item = data.item as Record<string, unknown> | undefined
      if (!item) break
      if (item.type === 'agent_message' && item.text) {
        addMessage({ type: 'assistant', content: item.text as string })
      } else if (item.type === 'command_execution') {
        addMessage({
          type: 'tool_result',
          content: (item.aggregated_output as string) || '(no output)',
          toolId: item.id as string,
          isError: (item.exit_code as number) !== 0,
        })
      }
      break
    }

    case 'turn.completed': {
      const usage = data.usage as Record<string, unknown> | undefined
      if (usage) {
        addMessage({
          type: 'system',
          content: `Tokens: ${usage.input_tokens} in / ${usage.output_tokens} out`,
        })
      }
      break
    }

    default:
      if (data.content || data.text) {
        addMessage({ type: 'text', content: (data.content || data.text) as string })
      }
      break
  }
}
