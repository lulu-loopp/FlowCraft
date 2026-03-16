'use client'

import { useCallback } from 'react'
import { useFlowStore } from '@/store/flowStore'
import {
  topologicalSort,
  areUpstreamsCompleteOrSkipped,
  markBranchSkipped,
} from '@/lib/flow-executor'
import type { Node } from '@xyflow/react'
import type { InputFile } from '@/components/canvas/nodes/input-node'

async function getWorkspaceContext(flowId: string, nodeId: string): Promise<string> {
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

async function executeAgentNode(
  node: Node,
  input: string,
  inputImages: InputFile[],
  workspaceContext: string,
  onStep: (step: any) => void,
  onToken: (token: string) => void,
): Promise<string> {
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
          provider: data.provider || 'anthropic',
          model: data.model || 'claude-sonnet-4-6',
          apiKey: '',
        },
        maxIterations: (data.maxIterations as number) || 10,
      },
      goal: input,
      inputImages: inputImages.map(f => ({ base64: f.base64, mimeType: f.mimeType, name: f.name })),
      enabledTools: (data.enabledTools as string[]) || [],
      enabledSkills: (data.enabledSkills as string[]) || [],
    }),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: 'Agent call failed' }))
    throw new Error((errBody as any).error || `HTTP ${response.status}`)
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
      let event: any
      try { event = JSON.parse(line.slice(6)) } catch { continue }

      if (event.type === 'error') throw new Error(event.data || 'Agent error')
      if (event.type === 'token') onToken(event.data)
      if (event.type === 'step') {
        onStep(event.data)
        if (event.data.type === 'done') finalOutput = event.data.content
      }
      if (event.type === 'done') finalOutput = event.data || finalOutput
    }
  }

  return finalOutput
}

async function executeConditionNode(
  node: Node,
  input: string,
): Promise<boolean> {
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
      provider: data.provider || 'anthropic',
      model: data.model || 'claude-haiku-4-5-20251001',
    }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'Condition evaluation failed' }))
    throw new Error(`Condition: ${(errBody as any).error || `HTTP ${res.status}`}`)
  }
  const { result } = await res.json()
  return !!result
}

export function useFlowExecution() {
  const { nodes, edges, setIsRunning, addLog, clearLogs, setNodes, addRunRecord, flowId } = useFlowStore()

  const runFlow = useCallback(async (userInput?: string) => {
    if (nodes.length === 0) return

    const startedAt = new Date().toISOString()
    const startMs = Date.now()
    const currentFlowId = useFlowStore.getState().flowId

    // Initialize workspace for this flow (no-op if already exists)
    if (currentFlowId) {
      fetch(`/api/workspace/${currentFlowId}`, { method: 'POST' }).catch(() => {})
    }

    setIsRunning(true)
    clearLogs()

    setNodes(nodes.map(n => ({
      ...n,
      data: { ...n.data, status: 'waiting', logs: [], currentOutput: '', currentToken: '' }
    })))

    const sortedNodes = topologicalSort(nodes, edges)
    const completedNodeIds = new Set<string>()
    const skippedNodeIds = new Set<string>()
    const nodeOutputs = new Map<string, string>()

    // Read input node data
    const inputNode = sortedNodes.find(n => n.type === 'io')
    const inputData = inputNode?.data as any
    const inputFiles = (inputData?.inputFiles || []) as InputFile[]
    const inputImages = inputFiles.filter(f => f.type === 'image')
    const inputTextFiles = inputFiles.filter(f => f.type === 'text')

    const textFileContent = inputTextFiles
      .map(f => `\n\n文件内容（${f.name}）：\n${f.content}`)
      .join('')

    const initialInput = (inputData?.inputText || userInput || 'Start') + textFileContent

    if (inputNode) {
      useFlowStore.getState().setNodes(
        useFlowStore.getState().nodes.map(n =>
          n.id === inputNode.id ? { ...n, data: { ...n.data, status: 'running' } } : n
        )
      )
      await new Promise(r => setTimeout(r, 600))
      useFlowStore.getState().setNodes(
        useFlowStore.getState().nodes.map(n =>
          n.id === inputNode.id ? { ...n, data: { ...n.data, status: 'success' } } : n
        )
      )
      completedNodeIds.add(inputNode.id)
      nodeOutputs.set(inputNode.id, initialInput)
    }

    let runStatus: 'success' | 'error' = 'success'

    try {
      for (const node of sortedNodes) {
        if (node.type === 'io') continue
        if (!useFlowStore.getState().isRunning) break

        // Skip nodes on inactive branches
        if (skippedNodeIds.has(node.id)) {
          useFlowStore.getState().setNodes(
            useFlowStore.getState().nodes.map(n =>
              n.id === node.id ? { ...n, data: { ...n.data, status: 'skipped' } } : n
            )
          )
          completedNodeIds.add(node.id)
          nodeOutputs.set(node.id, '')
          continue
        }

        if (!areUpstreamsCompleteOrSkipped(node.id, edges, completedNodeIds, skippedNodeIds)) continue

        const upstreamOutputs = edges
          .filter(e => e.target === node.id)
          .map(e => nodeOutputs.get(e.source) || '')
          .filter(Boolean)
          .join('\n\n')

        const nodeInput = upstreamOutputs || initialInput

        useFlowStore.getState().setNodes(
          useFlowStore.getState().nodes.map(n =>
            n.id === node.id
              ? { ...n, data: { ...n.data, status: 'running', logs: [], currentToken: '' } }
              : n
          )
        )

        addLog({
          nodeName: (node.data?.label as string) || node.type || 'node',
          nodeType: node.type || 'unknown',
          type: 'system',
          content: 'Starting...',
        })

        try {
          let output = ''

          if (node.type === 'agent') {
            const isDirectlyAfterInput = inputNode
              ? edges.some(e => e.source === inputNode.id && e.target === node.id)
              : false
            const nodeImages = isDirectlyAfterInput ? inputImages : []
            const wsContext = await getWorkspaceContext(currentFlowId, node.id)
            if (wsContext) {
              addLog({
                nodeName: (node.data?.label as string) || 'Agent',
                nodeType: 'agent',
                type: 'system',
                content: '📂 Workspace context loaded',
              })
            }

            output = await executeAgentNode(
              node, nodeInput, nodeImages, wsContext,
              (step) => {
                const logType =
                  step.type === 'thinking' ? 'think'
                  : step.type === 'tool_call' ? 'act'
                  : step.type === 'tool_result' ? 'observe'
                  : 'system'

                addLog({
                  nodeName: (node.data?.label as string) || 'Agent',
                  nodeType: 'agent',
                  type: logType,
                  content: step.content,
                })

                useFlowStore.getState().setNodes(
                  useFlowStore.getState().nodes.map(n =>
                    n.id === node.id
                      ? { ...n, data: { ...n.data, logs: [...((n.data.logs as any[]) || []), step] } }
                      : n
                  )
                )
              },
              (token) => {
                useFlowStore.getState().setNodes(
                  useFlowStore.getState().nodes.map(n =>
                    n.id === node.id
                      ? { ...n, data: { ...n.data, currentToken: ((n.data.currentToken as string) || '') + token } }
                      : n
                  )
                )
              }
            )
          } else if (node.type === 'condition') {
            const result = await executeConditionNode(node, nodeInput)

            const inactiveHandle = result ? 'false-handle' : 'true-handle'
            markBranchSkipped(node.id, inactiveHandle, edges, completedNodeIds, skippedNodeIds)

            output = nodeInput // pass input through to active branch
            addLog({
              nodeName: (node.data?.label as string) || 'Condition',
              nodeType: 'condition',
              type: 'system',
              content: `Evaluated to ${result ? 'true ✓' : 'false ✗'}`,
            })

            // Store result on node for UI
            useFlowStore.getState().setNodes(
              useFlowStore.getState().nodes.map(n =>
                n.id === node.id
                  ? { ...n, data: { ...n.data, conditionResult: result ? 'true' : 'false' } }
                  : n
              )
            )
          } else if (node.type === 'human') {
            output = nodeInput
            addLog({
              nodeName: (node.data?.label as string) || 'Human',
              nodeType: 'human',
              type: 'system',
              content: 'Human input passthrough (not yet interactive).',
            })
          } else {
            output = nodeInput
          }

          nodeOutputs.set(node.id, output)
          completedNodeIds.add(node.id)

          useFlowStore.getState().setNodes(
            useFlowStore.getState().nodes.map(n =>
              n.id === node.id
                ? { ...n, data: { ...n.data, status: 'success', currentOutput: output, currentToken: '' } }
                : n
            )
          )

          addLog({
            nodeName: (node.data?.label as string) || node.type || 'node',
            nodeType: node.type || 'unknown',
            type: 'system',
            content: 'Completed.',
          })

          // Update workspace progress after agent node
          if (node.type === 'agent' && currentFlowId) {
            const nodeName = (node.data?.label as string) || 'Agent'
            const summary = output.slice(0, 200).replace(/\n/g, ' ')
            fetch(`/api/workspace/${currentFlowId}/progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nodeName, outcome: summary }),
            }).catch(() => {})
          }
        } catch (err) {
          runStatus = 'error'
          useFlowStore.getState().setNodes(
            useFlowStore.getState().nodes.map(n =>
              n.id === node.id ? { ...n, data: { ...n.data, status: 'error', currentToken: '' } } : n
            )
          )
          addLog({
            nodeName: (node.data?.label as string) || node.type || 'node',
            nodeType: node.type || 'unknown',
            type: 'system',
            content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
          break
        }
      }
    } finally {
      useFlowStore.getState().setIsRunning(false)

      const record = {
        id: `run-${Date.now()}`,
        startedAt,
        status: runStatus,
        duration: Date.now() - startMs,
        nodeCount: sortedNodes.length,
      }
      addRunRecord(record)

      // Persist run record
      const { flowId } = useFlowStore.getState()
      if (flowId) {
        fetch(`/api/flows/${flowId}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        }).catch(() => {})
      }
    }
  }, [nodes, edges, setIsRunning, clearLogs, setNodes, addLog, addRunRecord, flowId])

  return { runFlow }
}
