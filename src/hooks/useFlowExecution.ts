'use client'

import { useCallback } from 'react'
import { useFlowStore } from '@/store/flowStore'
import { topologicalSort, areUpstreamsCompleteOrSkipped, markBranchSkipped } from '@/lib/flow-executor'
import type { InputFile } from '@/components/canvas/nodes/input-node'
import type { AgentStep } from '@/types/agent'
import { getWorkspaceContext, executeAgentNode, executeConditionNode } from '@/lib/node-executors'
import {
  appendAgentStep,
  appendAgentToken,
  getNodeLabel,
  resetExecutionNodes,
  setConditionResult,
  setInputNodeRunning,
  setInputNodeSuccess,
  setNodeError,
  setNodeRunning,
  setNodeSkipped,
  setNodeSuccess,
} from '@/lib/flow-execution-state'

type InputNodeData = {
  inputFiles?: InputFile[]
  inputText?: string
}

async function getDefaultProvider(): Promise<string> {
  try {
    const settingsRes = await fetch('/api/settings')
    if (!settingsRes.ok) return 'anthropic'
    const settings = await settingsRes.json()
    return settings.defaultProvider || 'anthropic'
  } catch {
    return 'anthropic'
  }
}

function buildInitialInput(inputData: InputNodeData, userInput?: string): {
  initialInput: string
  inputImages: InputFile[]
} {
  const inputFiles = inputData.inputFiles || []
  const inputImages = inputFiles.filter((f) => f.type === 'image')
  const inputTextFiles = inputFiles.filter((f) => f.type === 'text')
  const textFileContent = inputTextFiles
    .map((f) => `\n\nFile content (${f.name}):\n${f.content}`)
    .join('')
  return {
    initialInput: (inputData.inputText || userInput || 'Start') + textFileContent,
    inputImages,
  }
}

export function useFlowExecution() {
  const { nodes, edges, setIsRunning, addLog, clearLogs, setNodes, addRunRecord } = useFlowStore()

  const runFlow = useCallback(async (userInput?: string) => {
    if (nodes.length === 0) return

    const startedAt = new Date().toISOString()
    const startMs = Date.now()
    const currentFlowId = useFlowStore.getState().flowId
    const defaultProvider = await getDefaultProvider()

    if (currentFlowId) {
      fetch(`/api/workspace/${currentFlowId}`, { method: 'POST' }).catch(() => {})
    }

    setIsRunning(true)
    clearLogs()
    setNodes(resetExecutionNodes(nodes))

    const sortedNodes = topologicalSort(nodes, edges)
    const completedNodeIds = new Set<string>()
    const skippedNodeIds = new Set<string>()
    const nodeOutputs = new Map<string, string>()
    const inputNode = sortedNodes.find((n) => n.type === 'io')
    const inputData = (inputNode?.data || {}) as InputNodeData
    const { initialInput, inputImages } = buildInitialInput(inputData, userInput)

    if (inputNode) {
      setInputNodeRunning(inputNode.id)
      await new Promise((r) => setTimeout(r, 600))
      setInputNodeSuccess(inputNode.id)
      completedNodeIds.add(inputNode.id)
      nodeOutputs.set(inputNode.id, initialInput)
    }

    let runStatus: 'success' | 'error' | 'stopped' = 'success'

    try {
      for (const node of sortedNodes) {
        if (node.type === 'io') continue
        if (!useFlowStore.getState().isRunning) {
          runStatus = 'stopped'
          break
        }
        if (skippedNodeIds.has(node.id)) {
          setNodeSkipped(node.id)
          completedNodeIds.add(node.id)
          nodeOutputs.set(node.id, '')
          continue
        }
        if (!areUpstreamsCompleteOrSkipped(node.id, edges, completedNodeIds, skippedNodeIds)) continue

        const upstreamOutputs = edges
          .filter((e) => e.target === node.id)
          .map((e) => nodeOutputs.get(e.source) || '')
          .filter(Boolean)
          .join('\n\n')
        const nodeInput = upstreamOutputs || initialInput

        setNodeRunning(node.id)
        addLog({
          nodeName: getNodeLabel(node),
          nodeType: node.type || 'unknown',
          type: 'system',
          content: 'Starting...',
        })

        try {
          let output = nodeInput

          if (node.type === 'agent') {
            const isDirectlyAfterInput = inputNode
              ? edges.some((e) => e.source === inputNode.id && e.target === node.id)
              : false
            const wsContext = await getWorkspaceContext(currentFlowId, node.id)
            if (wsContext) {
              addLog({
                nodeName: getNodeLabel(node, 'Agent'),
                nodeType: 'agent',
                type: 'system',
                content: 'Workspace context loaded',
              })
            }

            output = await executeAgentNode(
              node,
              nodeInput,
              isDirectlyAfterInput ? inputImages : [],
              wsContext,
              (step: AgentStep) => {
                const logType =
                  step.type === 'thinking'
                    ? 'think'
                    : step.type === 'tool_call'
                      ? 'act'
                      : step.type === 'tool_result'
                        ? 'observe'
                        : 'system'

                addLog({
                  nodeName: getNodeLabel(node, 'Agent'),
                  nodeType: 'agent',
                  type: logType,
                  content: step.content,
                })
                appendAgentStep(node.id, step)
              },
              (token: string) => appendAgentToken(node.id, token),
              defaultProvider,
            )
          } else if (node.type === 'condition') {
            const result = await executeConditionNode(node, nodeInput, defaultProvider)
            markBranchSkipped(node.id, result ? 'false-handle' : 'true-handle', edges, completedNodeIds, skippedNodeIds)
            setConditionResult(node.id, result)
            addLog({
              nodeName: getNodeLabel(node, 'Condition'),
              nodeType: 'condition',
              type: 'system',
              content: `Evaluated to ${result ? 'true' : 'false'}`,
            })
          } else if (node.type === 'human') {
            addLog({
              nodeName: getNodeLabel(node, 'Human'),
              nodeType: 'human',
              type: 'system',
              content: 'Human input passthrough (not yet interactive).',
            })
          }

          nodeOutputs.set(node.id, output)
          completedNodeIds.add(node.id)
          setNodeSuccess(node.id, output)
          addLog({
            nodeName: getNodeLabel(node),
            nodeType: node.type || 'unknown',
            type: 'system',
            content: 'Completed.',
          })

          if (node.type === 'agent' && currentFlowId) {
            const nodeName = getNodeLabel(node, 'Agent')
            const summary = output.slice(0, 200).replace(/\n/g, ' ')
            fetch(`/api/workspace/${currentFlowId}/progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nodeName, outcome: summary }),
            }).catch(() => {})
          }
        } catch (err) {
          runStatus = 'error'
          setNodeError(node.id)
          addLog({
            nodeName: getNodeLabel(node),
            nodeType: node.type || 'unknown',
            type: 'system',
            content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
          break
        }
      }
    } finally {
      const stoppedByUser = runStatus === 'success' && !useFlowStore.getState().isRunning
      if (stoppedByUser) runStatus = 'stopped'

      useFlowStore.getState().setIsRunning(false)

      const record = {
        id: `run-${Date.now()}`,
        startedAt,
        status: runStatus,
        duration: Date.now() - startMs,
        nodeCount: sortedNodes.length,
      }
      addRunRecord(record)

      const { flowId } = useFlowStore.getState()
      if (flowId) {
        fetch(`/api/flows/${flowId}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        }).catch(() => {})
      }
    }
  }, [nodes, edges, setIsRunning, clearLogs, setNodes, addLog, addRunRecord])

  return { runFlow }
}

