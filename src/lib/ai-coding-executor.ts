import type { Node } from '@xyflow/react'
import { useFlowStore } from '@/store/flowStore'

type LogEntry = {
  nodeName: string
  nodeType: string
  type: 'think' | 'act' | 'observe' | 'system'
  content: string
}

export async function executeAiCodingAgentNode(
  node: Node,
  input: string,
  addLog: (log: LogEntry) => void,
): Promise<string> {
  const data = node.data as import('@/types/flow').AiCodingNodeData
  const task = (data.taskDescription as string) || input
  const workDir = (data.workDir as string) || ''
  const timeoutMinutes = (data.maxTimeout as number) || 10
  const cli = (data.cli as string) || 'claude'
  const label = (data.label as string) || 'AI Coding'
  const cliName = cli === 'codex' ? 'Codex' : 'Claude Code'

  addLog({ nodeName: label, nodeType: 'aiCodingAgent', type: 'system', content: `Starting ${cliName}: ${task.slice(0, 100)}...` })

  // Update node to running state
  const store = useFlowStore.getState()
  store.setNodes(store.nodes.map(n =>
    n.id === node.id ? { ...n, data: { ...n.data, status: 'running' } } : n
  ))

  const res = await fetch('/api/tools/claude-code/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodeId: node.id,
      task: `${task}\n\nContext from upstream:\n${input}`,
      workDir,
      timeoutMinutes,
      cli,
    }),
  })

  if (!res.ok || !res.body) {
    throw new Error('Failed to start Claude Code process')
  }

  let fullOutput = ''
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
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(dataStr) } catch { continue }

      switch (event) {
        case 'text':
        case 'output': {
          const content = extractOutputContent(parsed, cli)
          if (content) {
            fullOutput += content + '\n'
            addLog({ nodeName: label, nodeType: 'aiCodingAgent', type: 'act', content })
          }
          break
        }
        case 'stderr':
          addLog({ nodeName: label, nodeType: 'aiCodingAgent', type: 'observe', content: parsed.content as string })
          break
        case 'error':
          throw new Error(parsed.message as string || 'Claude Code error')
        case 'done': {
          const code = parsed.code as number
          if (code !== 0) {
            throw new Error(`Claude Code exited with code ${code}`)
          }
          break
        }
      }
    }
  }

  // Fetch file changes after completion
  try {
    const diffRes = await fetch(`/api/tools/claude-code/diff?workDir=${encodeURIComponent(workDir)}`)
    if (diffRes.ok) {
      const diffData = await diffRes.json()
      const changes = diffData.changes || []
      if (changes.length > 0) {
        const changesSummary = changes.map((c: { file: string; status: string }) => `[${c.status}] ${c.file}`).join('\n')
        fullOutput += `\n\nFile changes:\n${changesSummary}`
        addLog({ nodeName: label, nodeType: 'aiCodingAgent', type: 'system', content: `${changes.length} file(s) changed` })
      }
    }
  } catch { /* non-critical */ }

  return fullOutput
}

/** Extract displayable content from an SSE output event */
function extractOutputContent(data: Record<string, unknown>, cli: string): string {
  if (cli === 'codex') {
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
    return ''
  }
  return (data.content as string) || (data.result as string) || ''
}
