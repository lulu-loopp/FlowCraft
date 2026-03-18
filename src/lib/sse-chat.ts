/**
 * Shared SSE chat request utility.
 * Used by both Playground ChatPanel and Agent Chat Modal.
 */

export interface SSEChatConfig {
  id: string
  name: string
  systemPrompt: string
  model: { provider: string; model: string; apiKey: string; temperature?: number }
  maxIterations: number
}

export interface SSEChatOptions {
  config: SSEChatConfig
  history: { role: string; content: string }[]
  message: string
  enabledTools?: string[]
  enabledSkills?: string[]
  enabledSkillNames?: string[]
  summary?: string
  signal?: AbortSignal
  onToken: (token: string) => void
  onDone: () => void
  onError: (error: string) => void
}

export async function sendSSEChat(options: SSEChatOptions): Promise<void> {
  const {
    config, history, message,
    enabledTools = [], enabledSkills = [], enabledSkillNames = [],
    summary, signal, onToken, onDone, onError,
  } = options

  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      config, history, message,
      enabledTools, enabledSkills, enabledSkillNames, summary,
    }),
  })

  if (!res.ok || !res.body) {
    onError(`HTTP ${res.status}`)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'token') onToken(event.data)
        else if (event.type === 'done') onDone()
        else if (event.type === 'error') onError(event.data || 'Unknown error')
      } catch { /* ignore malformed lines */ }
    }
  }
}
