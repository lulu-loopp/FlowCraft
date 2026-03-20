import type { Node, Edge } from '@xyflow/react'
import type { InputFile, NodeArtifact } from '@/types/flow'
import type { AgentStep } from '@/types/agent'
import { useFlowStore } from '@/store/flowStore'
import { getWorkspaceContext, executeAgentNode, executeConditionNode, executeDispatcher } from '@/lib/node-executors'
import { executeAiCodingAgentNode } from '@/lib/ai-coding-executor'
import { executePackedNode } from '@/lib/packed-executor'
import {
  appendAgentStep,
  appendAgentToken,
  getNodeLabel,
  setNodeRunning,
} from '@/lib/flow-execution-state'

/* ── MIME type mapping for artifact detection ── */
const EXT_MIME_MAP: Record<string, string> = {
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.html': 'text/html',
  '.py': 'text/x-python',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
}
const INTERNAL_FILE_RE = /^(memory\/|progress\.md$|features\.json$|shared\.md$|docs\/)/

function getMimeType(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
  return EXT_MIME_MAP[ext] || 'application/octet-stream'
}

/** Snapshot workspace file list before agent execution */
export async function snapshotWorkspaceFiles(flowId: string): Promise<Set<string>> {
  if (!flowId) return new Set()
  try {
    const res = await fetch(`/api/workspace/${flowId}`)
    if (!res.ok) return new Set()
    const { files } = await res.json()
    return new Set((files || []).map((f: { relativePath: string }) => f.relativePath))
  } catch {
    return new Set()
  }
}

/** Detect new files in workspace after agent execution */
export async function detectNewArtifacts(
  flowId: string,
  beforeFiles: Set<string>,
  nodeId: string,
): Promise<NodeArtifact[]> {
  if (!flowId) return []
  try {
    const res = await fetch(`/api/workspace/${flowId}`)
    if (!res.ok) return []
    const { files } = await res.json()
    return (files || [])
      .filter((f: { relativePath: string }) =>
        !beforeFiles.has(f.relativePath) && !INTERNAL_FILE_RE.test(f.relativePath)
      )
      .map((f: { name: string; relativePath: string; size: number }) => ({
        fileName: f.name,
        relativePath: f.relativePath,
        mimeType: getMimeType(f.name),
        size: f.size,
        createdBy: nodeId,
      }))
  } catch {
    return []
  }
}

/** Build artifact context string for downstream nodes */
function buildArtifactContext(artifacts: NodeArtifact[], flowId: string): string {
  if (artifacts.length === 0) return ''
  const lines = artifacts.map(a =>
    `- ${a.fileName} (${a.mimeType}, ${a.size} bytes) → /api/workspace/${flowId}/file?path=${encodeURIComponent(a.relativePath)}`
  )
  return `\n\n[Upstream Artifacts]\n以下文件已由上游 Agent 生成，存放在工作区中：\n${lines.join('\n')}\n[End Upstream Artifacts]`
}

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
  const inputDocFiles = inputFiles.filter((f) => f.type === 'document')
  const textFileContent = inputTextFiles
    .map((f) => `\n\nFile content (${f.name}):\n${f.content}`)
    .join('')
  const docFileContent = inputDocFiles
    .map((f) => `\n\n[Uploaded Document: ${f.name}]\nThis file has been saved to the workspace at uploads/${f.name}. Use the read_file tool to access its contents.`)
    .join('')
  return {
    initialInput: (inputData.inputText || userInput || 'Start') + textFileContent + docFileContent,
    inputImages,
  }
}

interface ExecuteNodeWorkParams {
  node: Node
  edges: Edge[]
  inputNodeIds: Set<string>
  inputImagesMap: Map<string, InputFile[]>
  initialInput: string
  inputImages: InputFile[]
  nodeOutputs: Map<string, string>
  handleOutputs: Map<string, Record<string, string>>
  nodeArtifacts: Map<string, NodeArtifact[]>
  completedNodeIds: Set<string>
  skippedNodeIds: Set<string>
  currentFlowId: string
  defaultProvider: string
  addLog: (log: { nodeName: string; nodeType: string; type: 'think' | 'act' | 'observe' | 'system'; content: string }) => void
  loopEdgeIds: Set<string>
  /** Feedback from previous loop iteration (reviewer output injected when retrying) */
  loopFeedback?: Map<string, string>
  signal?: AbortSignal
}

interface ExecuteNodeResult {
  output: string
  conditionResult?: boolean
  handleOutputs?: Record<string, string>
  handleResults?: Record<string, import('@/lib/packed-executor').HandleResult>
  packOverallStatus?: 'completed' | 'partial' | 'error'
  artifacts?: NodeArtifact[]
}

export async function executeNodeWork(params: ExecuteNodeWorkParams): Promise<ExecuteNodeResult> {
  const {
    node, edges, inputNodeIds, inputImagesMap, initialInput, inputImages,
    nodeOutputs, handleOutputs: handleOutputsMap, nodeArtifacts,
    currentFlowId, defaultProvider, addLog, loopEdgeIds, loopFeedback, signal,
  } = params

  // Gather upstream outputs, ignoring loop back-edges
  const incomingEdges = edges.filter((e) => e.target === node.id && !loopEdgeIds.has(e.id))
  const upstreamOutputs = incomingEdges
    .map((e) => {
      const hOutputs = handleOutputsMap.get(e.source)
      if (hOutputs) {
        // 1. Explicit sourceHandle (condition/packed nodes)
        if (e.sourceHandle && hOutputs[e.sourceHandle] !== undefined) {
          return hOutputs[e.sourceHandle]
        }
        // 2. Dispatcher: target-node-ID-based routing
        if (hOutputs[node.id] !== undefined) {
          return hOutputs[node.id]
        }
      }
      return nodeOutputs.get(e.source) || ''
    })
    .filter(Boolean)
    .join('\n\n')

  // Inject loop context from the previous iteration (previous output + reviewer feedback)
  const feedback = loopFeedback?.get(node.id)
  const feedbackContext = feedback
    ? `\n\n---\n[Loop Retry Context]\nThis is a retry. Review the context below and decide whether your work needs to change.\nIf the reviewer feedback does not mention issues with YOUR specific output, you may reproduce your previous output.\n\n${feedback}\n---\n`
    : ''

  // Gather upstream artifacts and inject context
  const upstreamArtifactList = incomingEdges.flatMap((e) => nodeArtifacts.get(e.source) || [])
  const artifactContext = buildArtifactContext(upstreamArtifactList, currentFlowId)
  const nodeInput = (upstreamOutputs || initialInput) + feedbackContext + artifactContext

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
  let detectedArtifacts: NodeArtifact[] | undefined

  if (node.type === 'agent') {
    // Find the upstream io node (if any) to pass its images
    const upstreamIoEdge = edges.find(e => e.target === node.id && inputNodeIds.has(e.source))
    const isDirectlyAfterInput = !!upstreamIoEdge
    const wsContext = await getWorkspaceContext(currentFlowId, node.id)
    if (wsContext) {
      addLog({ nodeName: getNodeLabel(node, 'Agent'), nodeType: 'agent', type: 'system', content: 'Workspace context loaded' })
    }

    // Snapshot workspace files before execution (for artifact detection)
    const hasSkillsOrTools = ((node.data?.enabledSkills as string[])?.length > 0) || ((node.data?.enabledTools as string[])?.length > 0)
    const beforeFiles = hasSkillsOrTools ? await snapshotWorkspaceFiles(currentFlowId) : new Set<string>()

    const nodeWithFlowId = { ...node, data: { ...node.data, _flowId: currentFlowId } }
    const agentImages = isDirectlyAfterInput
      ? (inputImagesMap.get(upstreamIoEdge!.source) || inputImages)
      : []
    output = await executeAgentNode(
      nodeWithFlowId, nodeInput,
      agentImages,
      wsContext,
      (step: AgentStep) => {
        const logType = step.type === 'thinking' ? 'think' : step.type === 'tool_call' ? 'act' : step.type === 'tool_result' ? 'observe' : 'system'
        addLog({ nodeName: getNodeLabel(node, 'Agent'), nodeType: 'agent', type: logType, content: step.content })
        appendAgentStep(node.id, step)
      },
      (token: string) => appendAgentToken(node.id, token),
      defaultProvider,
      signal,
    )

    // Detect new artifacts after execution
    if (hasSkillsOrTools) {
      detectedArtifacts = await detectNewArtifacts(currentFlowId, beforeFiles, node.id)
      if (detectedArtifacts.length > 0) {
        const names = detectedArtifacts.map(a => a.fileName).join(', ')
        addLog({ nodeName: getNodeLabel(node, 'Agent'), nodeType: 'agent', type: 'system', content: `Generated artifacts: ${names}` })
      }
    }
  } else if (node.type === 'condition') {
    conditionResult = await executeConditionNode(node, nodeInput, defaultProvider)
  } else if (node.type === 'dispatcher') {
    // Dispatcher node: split upstream content into per-target outputs using LLM
    const downstreamEdges = edges.filter(e => e.source === node.id && !loopEdgeIds.has(e.id))

    if (downstreamEdges.length <= 1) {
      output = nodeInput
      if (downstreamEdges.length === 1) resultHandleOutputs = { [downstreamEdges[0].target]: nodeInput }
      addLog({ nodeName: getNodeLabel(node, 'Dispatcher'), nodeType: 'dispatcher', type: 'system', content: 'Single target — passing through.' })
    } else {
      const dispatchResult = await executeDispatcher(node, nodeInput, downstreamEdges, edges, defaultProvider, addLog, signal)
      output = nodeInput
      resultHandleOutputs = dispatchResult
    }
  } else if (node.type === 'merge') {
    // Merge node: upstream outputs are already concatenated in nodeInput
    output = nodeInput
    addLog({ nodeName: getNodeLabel(node, 'Merge'), nodeType: 'merge', type: 'system', content: `Merged ${edges.filter(e => e.target === node.id).length} upstream outputs.` })
  } else if (node.type === 'human') {
    addLog({ nodeName: getNodeLabel(node, 'Human'), nodeType: 'human', type: 'system', content: 'Human input passthrough (not yet interactive).' })
  } else if (node.type === 'aiCodingAgent') {
    output = await executeAiCodingAgentNode(node, nodeInput, addLog)
  } else if (node.type === 'packed') {
    const upstreamPackIoEdge = edges.find(e => e.target === node.id && inputNodeIds.has(e.source))
    const packImages = upstreamPackIoEdge
      ? (inputImagesMap.get(upstreamPackIoEdge.source) || inputImages)
      : []
    const packResult = await executePackedNode({
      node, input: nodeInput,
      inputImages: packImages,
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

  return { output, conditionResult, handleOutputs: resultHandleOutputs, artifacts: detectedArtifacts }
}
