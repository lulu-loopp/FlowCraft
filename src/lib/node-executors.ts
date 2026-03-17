import type { Node } from '@xyflow/react'
import type { InputFile } from '@/components/canvas/nodes/input-node'
import type { AgentStep } from '@/types/agent'

export async function getWorkspaceContext(flowId: string, nodeId: string): Promise<string> {
  if (!flowId) return '';
  try {
    const res = await fetch(`/api/workspace/${flowId}?nodeId=${nodeId}`);
    if (!res.ok) return '';
    const { context } = await res.json();
    return context || '';
  } catch {
    return '';
  }
}

export async function executeAgentNode(
  node: Node,
  input: string,
  inputImages: InputFile[],
  workspaceContext: string,
  onStep: (step: AgentStep) => void,
  onToken: (token: string) => void,
  defaultProvider = 'anthropic',
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = node.data as any
  const basePrompt = (data.systemPrompt as string) || 'You are a helpful assistant.'
  const systemPrompt = workspaceContext
    ? `${workspaceContext}\n\n${basePrompt}`
    : basePrompt

  const response = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        id: node.id,
        name: (data.label as string) || 'Agent',
        systemPrompt,
        model: {
          provider: data.provider || defaultProvider,
          model: data.model || 'claude-sonnet-4-6',
          apiKey: '',
        },
        maxIterations: (data.maxIterations as number) || 10,
      },
      goal: input,
      inputImages: inputImages.map(f => ({ base64: f.base64, mimeType: f.mimeType, name: f.name })),
      enabledTools: (data.enabledTools as string[]) || [],
      enabledSkills: [],          // built-in subagent skills (not used in canvas nodes)
      enabledFileSkills: (data.enabledSkills as string[]) || [],
    }),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: 'Agent call failed' })) as { error?: string }
    throw new Error(errBody.error || `HTTP ${response.status}`)
  }
  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let finalOutput = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split('\n\n').filter(Boolean)
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      let event: { type: string; data?: unknown }
      try { event = JSON.parse(line.slice(6)) as { type: string; data?: unknown } } catch { continue }

      if (event.type === 'error') throw new Error((event.data as string) || 'Agent error')
      if (event.type === 'token') onToken(event.data as string)
      if (event.type === 'step') {
        const step = event.data as AgentStep
        onStep(step)
        if (step.type === 'done') finalOutput = step.content
      }
      if (event.type === 'done') finalOutput = (event.data as string) || finalOutput
    }
  }

  return finalOutput
}

export async function executeConditionNode(
  node: Node,
  input: string,
  defaultProvider = 'anthropic',
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = node.data as any
  const mode: 'natural' | 'expression' = data.conditionMode || 'natural'
  const condition: string = data.conditionValue || ''

  if (!condition.trim()) return true

  const res = await fetch('/api/condition/eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input,
      condition,
      mode,
      provider: data.provider || defaultProvider,
      model: data.model || 'claude-haiku-4-5-20251001',
    }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'Condition evaluation failed' })) as { error?: string }
    throw new Error(`Condition: ${errBody.error || `HTTP ${res.status}`}`)
  }
  const { result } = await res.json()
  return !!result
}
