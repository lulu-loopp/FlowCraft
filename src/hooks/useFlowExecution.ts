'use client'

import { useCallback } from 'react'
import { useFlowStore } from '@/store/flowStore'
import { topologicalSort, areUpstreamsComplete } from '@/lib/flow-executor'
import type { Node } from '@xyflow/react'
import type { InputFile } from '@/components/canvas/nodes/input-node'

async function executeAgentNode(
  node: Node,
  input: string,
  inputImages: InputFile[],
  onStep: (step: any) => void,
  onToken: (token: string) => void,
): Promise<string> {
  const data = node.data as any

  const response = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        id: node.id,
        name: (data.label as string) || 'Agent',
        systemPrompt: (data.systemPrompt as string) || 'You are a helpful assistant.',
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

export function useFlowExecution() {
  const { nodes, edges, setIsRunning, addLog, clearLogs, setNodes } = useFlowStore()

  const runFlow = useCallback(async (userInput?: string) => {
    if (nodes.length === 0) return

    setIsRunning(true)
    clearLogs()

    setNodes(nodes.map(n => ({
      ...n,
      data: { ...n.data, status: 'waiting', logs: [], currentOutput: '', currentToken: '' }
    })))

    const sortedNodes = topologicalSort(nodes, edges)
    const completedNodeIds = new Set<string>()
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
      completedNodeIds.add(inputNode.id)
      nodeOutputs.set(inputNode.id, initialInput)
    }

    try {
      for (const node of sortedNodes) {
        if (node.type === 'io') continue
        if (!useFlowStore.getState().isRunning) break

        if (!areUpstreamsComplete(node.id, edges, completedNodeIds)) continue

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
            // Only pass images to the first agent node receiving from input
            const isDirectlyAfterInput = inputNode
              ? edges.some(e => e.source === inputNode.id && e.target === node.id)
              : false
            const nodeImages = isDirectlyAfterInput ? inputImages : []

            output = await executeAgentNode(
              node, nodeInput, nodeImages,
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
        } catch (err) {
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
    }
  }, [nodes, edges, setIsRunning, clearLogs, setNodes, addLog])

  return { runFlow }
}
