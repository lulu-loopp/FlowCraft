import type { Node, Edge } from '@xyflow/react'
import type { InputFile } from '@/types/flow'
import type { AgentStep } from '@/types/agent'
import { useFlowStore } from '@/store/flowStore'
import { getWorkspaceContext, executeAgentNode, executeConditionNode } from '@/lib/node-executors'
import { executeAiCodingAgentNode } from '@/lib/ai-coding-executor'
import { executePackedNode } from '@/lib/packed-executor'
import {
  appendAgentStep,
  appendAgentToken,
  getNodeLabel,
  setNodeRunning,
} from '@/lib/flow-execution-state'

type InputNodeData = {
  inputFiles?: InputFile[]
  inputText?: string
}

export async function getDefaultProvider(): Promise<string> {
  try {
    const settingsRes = await fetch('/api/settings')
    if (!settingsRes.ok) return 'anthropic'
    const settings = await settingsRes.json()
    return settings.defaultProvider || 'anthropic'
  } catch {
    return 'anthropic'
  }
}

export function buildInitialInput(inputData: InputNodeData, userInput?: string): {
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

interface ExecuteNodeWorkParams {
  node: Node
  edges: Edge[]
  inputNode: Node | undefined
  initialInput: string
  inputImages: InputFile[]
  nodeOutputs: Map<string, string>
  handleOutputs: Map<string, Record<string, string>>
  completedNodeIds: Set<string>
  skippedNodeIds: Set<string>
  currentFlowId: string
  defaultProvider: string
  addLog: (log: { nodeName: string; nodeType: string; type: 'think' | 'act' | 'observe' | 'system'; content: string }) => void
  loopEdgeIds: Set<string>
}

interface ExecuteNodeResult {
  output: string
  conditionResult?: boolean
  handleOutputs?: Record<string, string>
  handleResults?: Record<string, import('@/lib/packed-executor').HandleResult>
  packOverallStatus?: 'completed' | 'partial' | 'error'
}

export async function executeNodeWork(params: ExecuteNodeWorkParams): Promise<ExecuteNodeResult> {
  const {
    node, edges, inputNode, initialInput, inputImages,
    nodeOutputs, handleOutputs: handleOutputsMap,
    currentFlowId, defaultProvider, addLog, loopEdgeIds,
  } = params

  // Gather upstream outputs, ignoring loop back-edges
  const upstreamOutputs = edges
    .filter((e) => e.target === node.id && !loopEdgeIds.has(e.id))
    .map((e) => {
      const hOutputs = handleOutputsMap.get(e.source)
      if (hOutputs && e.sourceHandle && hOutputs[e.sourceHandle] !== undefined) {
        return hOutputs[e.sourceHandle]
      }
      return nodeOutputs.get(e.source) || ''
    })
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

  let output = nodeInput
  let conditionResult: boolean | undefined
  let resultHandleOutputs: Record<string, string> | undefined

  if (node.type === 'agent') {
    const isDirectlyAfterInput = inputNode
      ? edges.some((e) => e.source === inputNode.id && e.target === node.id)
      : false
    const wsContext = await getWorkspaceContext(currentFlowId, node.id)
    if (wsContext) {
      addLog({ nodeName: getNodeLabel(node, 'Agent'), nodeType: 'agent', type: 'system', content: 'Workspace context loaded' })
    }

    const nodeWithFlowId = { ...node, data: { ...node.data, _flowId: currentFlowId } }
    output = await executeAgentNode(
      nodeWithFlowId, nodeInput,
      isDirectlyAfterInput ? inputImages : [],
      wsContext,
      (step: AgentStep) => {
        const logType = step.type === 'thinking' ? 'think' : step.type === 'tool_call' ? 'act' : step.type === 'tool_result' ? 'observe' : 'system'
        addLog({ nodeName: getNodeLabel(node, 'Agent'), nodeType: 'agent', type: logType, content: step.content })
        appendAgentStep(node.id, step)
      },
      (token: string) => appendAgentToken(node.id, token),
      defaultProvider,
    )
  } else if (node.type === 'condition') {
    conditionResult = await executeConditionNode(node, nodeInput, defaultProvider)
  } else if (node.type === 'human') {
    addLog({ nodeName: getNodeLabel(node, 'Human'), nodeType: 'human', type: 'system', content: 'Human input passthrough (not yet interactive).' })
  } else if (node.type === 'aiCodingAgent') {
    output = await executeAiCodingAgentNode(node, nodeInput, addLog)
  } else if (node.type === 'packed') {
    const isPackAfterInput = inputNode ? edges.some(e => e.source === inputNode.id && e.target === node.id) : false
    const packResult = await executePackedNode({
      node, input: nodeInput,
      inputImages: isPackAfterInput ? inputImages : [],
      flowId: currentFlowId, defaultProvider, addLog,
      onStep: (step: AgentStep) => {
        const logType = step.type === 'thinking' ? 'think' : step.type === 'tool_call' ? 'act' : step.type === 'tool_result' ? 'observe' : 'system'
        addLog({ nodeName: getNodeLabel(node, 'Pack'), nodeType: 'packed', type: logType as 'think' | 'act' | 'observe' | 'system', content: step.content })
        appendAgentStep(node.id, step)
      },
      onToken: (token: string) => appendAgentToken(node.id, token),
      onProgress: (packedNodeId, runningNames, completedNames, total) => {
        const store = useFlowStore.getState()
        store.setNodes(store.nodes.map(n =>
          n.id === packedNodeId ? { ...n, data: { ...n.data, runningInnerNodes: runningNames, completedInnerNodes: completedNames, innerProgress: { completed: completedNames.length, total } } } : n
        ))
      },
      onInternalResults: (packedNodeId, results) => {
        const store = useFlowStore.getState()
        store.setNodes(store.nodes.map(n =>
          n.id === packedNodeId ? { ...n, data: { ...n.data, _internalResults: results } } : n
        ))
      },
    })
    // Store handleResults on the node data so the UI can render partial status
    if (Object.keys(packResult.handleResults).length > 0) {
      const store = useFlowStore.getState()
      store.setNodes(store.nodes.map(n =>
        n.id === node.id ? { ...n, data: { ...n.data, handleResults: packResult.handleResults } } : n
      ))
    }

    output = packResult.output
    if (Object.keys(packResult.handleOutputs).length > 0) {
      resultHandleOutputs = packResult.handleOutputs
    }
    return {
      output,
      handleOutputs: resultHandleOutputs,
      handleResults: packResult.handleResults,
      packOverallStatus: packResult.overallStatus,
    }
  }

  return { output, conditionResult, handleOutputs: resultHandleOutputs }
}
