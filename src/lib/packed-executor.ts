/**
 * Executes a packed node's internal sub-flow with parallel scheduling.
 * Nodes whose upstreams are all complete start immediately (same as main flow executor).
 */
import type { Node, Edge } from '@xyflow/react'
import type { AgentStep } from '@/types/agent'
import type { InputFile } from '@/types/flow'
import { topologicalSort, areUpstreamsCompleteOrSkipped, markBranchSkipped } from '@/lib/flow-executor'
import { executeAgentNode, executeConditionNode, getWorkspaceContext } from '@/lib/node-executors'
import { readPackMemory, buildPackedNodePrompt } from '@/lib/packed-memory-injector'
import { writePackedMemories } from '@/lib/packed-memory-writer'
import { incrementRunCount } from '@/lib/memory-updater'
import { refreshIndividualNodes } from '@/hooks/useLoadIndividual'

type LogType = 'think' | 'act' | 'observe' | 'system'
type LogFn = (entry: { nodeName: string; nodeType: string; type: LogType; content: string }) => void
type StepFn = (step: AgentStep) => void

interface PackedExecOptions {
  node: Node
  input: string
  inputImages: InputFile[]
  flowId: string
  defaultProvider: string
  addLog: LogFn
  onStep: StepFn
  onToken: (token: string) => void
  onInternalResults?: (nodeId: string, results: Record<string, InternalNodeResult>) => void
  /** Called when a node starts or completes. runningNames = currently in-flight labels. */
  onProgress?: (nodeId: string, runningNames: string[], completedNames: string[], total: number) => void
  /** Parent pack's memory, passed down for nested packs (not penetrating deeper). */
  parentPackMemory?: string
}

export type InternalNodeResult = { status: string; currentOutput: string }

export interface HandleResult {
  status: 'completed' | 'error' | 'skipped'
  output?: string
  error?: string
}

export interface PackedExecResult {
  output: string
  handleOutputs: Record<string, string>
  handleResults: Record<string, HandleResult>
  overallStatus: 'completed' | 'partial' | 'error'
}

export async function executePackedNode(opts: PackedExecOptions): Promise<PackedExecResult> {
  const { node, input, inputImages, flowId, defaultProvider, addLog, onStep, onToken } = opts
  const packName = (node.data?.packName as string) || ''
  const nodeLabel = (node.data?.label as string) || 'Pack'
  const inlineFlow = node.data?.inlineFlow as { nodes: Node[]; edges: Edge[] } | undefined

  // Independent copy uses inline flow; shared uses API
  if (!packName && !inlineFlow) return { output: input, handleOutputs: {}, handleResults: {}, overallStatus: 'completed' }

  // 1. Load internal flow (inline or from API)
  let internalNodes: Node[]
  let internalEdges: Edge[]
  let packMemory = ''

  if (inlineFlow) {
    internalNodes = inlineFlow.nodes || []
    internalEdges = inlineFlow.edges || []
  } else {
    const res = await fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
    if (!res.ok) throw new Error(`Failed to load pack "${packName}"`)
    const packData = await res.json()
    internalNodes = (packData.flow?.nodes || []) as Node[]
    internalEdges = (packData.flow?.edges || []) as Edge[]
    packMemory = packData.memory || ''
  }

  // Refresh individual agent nodes with latest shared definitions (model, prompt, etc.)
  internalNodes = await refreshIndividualNodes(internalNodes)

  // If no API memory, try reading directly
  if (!packMemory && packName) {
    packMemory = await readPackMemory(packName)
  }

  if (internalNodes.length === 0) return { output: input, handleOutputs: {}, handleResults: {}, overallStatus: 'completed' }

  addLog({ nodeName: nodeLabel, nodeType: 'packed', type: 'system',
    content: `Executing sub-flow: ${internalNodes.length} nodes, ${internalEdges.length} edges` })

  const sorted = topologicalSort(internalNodes, internalEdges)
  const completedIds = new Set<string>()
  const skippedIds = new Set<string>()
  const failedIds = new Set<string>()
  const nodeOutputs = new Map<string, string>()
  const completedNames: string[] = []
  const runningNames: string[] = []

  // Execute a single internal node and return its output
  async function runInternalNode(iNode: Node): Promise<string> {
    const iLabel = (iNode.data?.label as string) || iNode.type || '?'
    const subLabel = `${nodeLabel} › ${iLabel}`

    const upstreamOutputs = internalEdges
      .filter(e => e.target === iNode.id)
      .map(e => nodeOutputs.get(e.source) || '')
      .filter(Boolean)
      .join('\n\n')
    const nodeInput = upstreamOutputs || input

    let output = nodeInput

    if (iNode.type === 'io') {
      output = input
      addLog({ nodeName: subLabel, nodeType: 'io', type: 'system', content: 'Input received' })
    } else if (iNode.type === 'agent') {
      addLog({ nodeName: subLabel, nodeType: 'agent', type: 'system', content: 'Starting...' })
      const isFirstAgent = internalEdges.some(e => {
        const src = internalNodes.find(n => n.id === e.source)
        return src?.type === 'io' && e.target === iNode.id
      })
      const wsContext = await getWorkspaceContext(flowId, iNode.id)

      // Build prompt with pack memory injection (only for the first agent connected to input)
      const packCtx = isFirstAgent
        ? { packMemory, parentPackMemory: opts.parentPackMemory }
        : { packMemory: '', parentPackMemory: undefined }
      const packedPrompt = isFirstAgent
        ? await buildPackedNodePrompt(iNode, flowId, packCtx)
        : undefined

      const nodeWithFlowId = {
        ...iNode,
        data: {
          ...iNode.data,
          _flowId: flowId,
          ...(packedPrompt ? { _overrideSystemPrompt: packedPrompt } : {}),
        },
      }
      output = await executeAgentNode(
        nodeWithFlowId, nodeInput,
        isFirstAgent ? inputImages : [],
        wsContext,
        (step: AgentStep) => {
          const logType: LogType = step.type === 'thinking' ? 'think' : step.type === 'tool_call' ? 'act' : step.type === 'tool_result' ? 'observe' : 'system'
          addLog({ nodeName: subLabel, nodeType: 'agent', type: logType, content: step.content })
          onStep(step)
        },
        onToken,
        defaultProvider,
      )
      addLog({ nodeName: subLabel, nodeType: 'agent', type: 'system', content: 'Completed.' })

      // Increment run count for individual agents inside the pack
      const individualName = iNode.data?.individualName as string | undefined
      if (individualName) {
        incrementRunCount(individualName).catch(() => {})
      }
    } else if (iNode.type === 'condition') {
      const result = await executeConditionNode(iNode, nodeInput, defaultProvider)
      markBranchSkipped(iNode.id, result ? 'false-handle' : 'true-handle', internalEdges, completedIds, skippedIds)
      addLog({ nodeName: subLabel, nodeType: 'condition', type: 'system', content: `Evaluated to ${result}` })
    } else if (iNode.type === 'output') {
      output = nodeInput
      addLog({ nodeName: subLabel, nodeType: 'output', type: 'system', content: 'Output collected' })
    } else if (iNode.type === 'packed') {
      // Pass current pack memory as parentPackMemory to nested pack (not penetrating deeper)
      const nested = await executePackedNode({
        ...opts, node: iNode, input: nodeInput,
        parentPackMemory: packMemory,
      })
      output = nested.output
    }

    return output
  }

  // 2. Parallel scheduler (mirrors main flow executor)
  const remaining = new Set(sorted.map(n => n.id))
  const inFlight = new Map<string, Promise<void>>()
  const nodeMap = new Map(sorted.map(n => [n.id, n]))

  const trySchedule = () => {
    for (const nid of remaining) {
      if (inFlight.has(nid)) continue

      if (skippedIds.has(nid)) {
        remaining.delete(nid)
        completedIds.add(nid)
        nodeOutputs.set(nid, '')
        continue
      }

      // If any upstream failed, propagate failure — do not execute this node
      const upstreamIds = internalEdges.filter(e => e.target === nid).map(e => e.source)
      if (upstreamIds.some(id => failedIds.has(id))) {
        failedIds.add(nid)
        remaining.delete(nid)
        const iNode = nodeMap.get(nid)!
        const iLabel = (iNode.data?.label as string) || iNode.type || '?'
        addLog({ nodeName: `${nodeLabel} › ${iLabel}`, nodeType: iNode.type || 'unknown', type: 'system', content: 'Skipped due to upstream failure' })
        trySchedule()
        continue
      }

      if (!areUpstreamsCompleteOrSkipped(nid, internalEdges, completedIds, skippedIds)) continue

      const iNode = nodeMap.get(nid)!
      const iLabel = (iNode.data?.label as string) || iNode.type || '?'

      runningNames.push(iLabel)
      opts.onProgress?.(node.id, [...runningNames], [...completedNames], sorted.length)

      const task = runInternalNode(iNode)
        .then(output => {
          nodeOutputs.set(nid, output)
          completedIds.add(nid)
          const idx = runningNames.indexOf(iLabel)
          if (idx >= 0) runningNames.splice(idx, 1)
          completedNames.push(iLabel)
          opts.onProgress?.(node.id, [...runningNames], [...completedNames], sorted.length)
        })
        .catch(err => {
          addLog({ nodeName: `${nodeLabel} › ${iLabel}`, nodeType: iNode.type || 'unknown', type: 'system', content: `Error: ${err instanceof Error ? err.message : 'Unknown'}` })
          failedIds.add(nid)
          const idx = runningNames.indexOf(iLabel)
          if (idx >= 0) runningNames.splice(idx, 1)
        })
        .finally(() => {
          inFlight.delete(nid)
          remaining.delete(nid)
          trySchedule()
        })

      inFlight.set(nid, task)
    }
  }

  trySchedule()

  while (remaining.size > 0 || inFlight.size > 0) {
    if (inFlight.size === 0) break
    await Promise.race(inFlight.values())
    await new Promise(r => setTimeout(r, 0))
  }

  // 3. Save internal node results
  if (opts.onInternalResults) {
    const results: Record<string, InternalNodeResult> = {}
    for (const iNode of sorted) {
      results[iNode.id] = {
        status: failedIds.has(iNode.id) ? 'error' : skippedIds.has(iNode.id) ? 'skipped' : completedIds.has(iNode.id) ? 'success' : 'waiting',
        currentOutput: nodeOutputs.get(iNode.id) || '',
      }
    }
    opts.onInternalResults(node.id, results)
  }

  // 4. Per-handle outputs and per-handle status
  const handleConfig = (node.data?.handleConfig as Array<{ id: string; type: string; internalNodeId: string }>) || []
  const handleOutputs: Record<string, string> = {}
  const handleResults: Record<string, HandleResult> = {}
  for (const h of handleConfig) {
    if (h.type === 'output') {
      const internalId = h.internalNodeId
      if (failedIds.has(internalId)) {
        handleResults[h.id] = { status: 'error', error: 'Internal node failed' }
        handleOutputs[h.id] = ''
      } else if (skippedIds.has(internalId)) {
        handleResults[h.id] = { status: 'skipped' }
        handleOutputs[h.id] = ''
      } else {
        handleResults[h.id] = { status: 'completed', output: nodeOutputs.get(internalId) || '' }
        handleOutputs[h.id] = nodeOutputs.get(internalId) || ''
      }
    }
  }

  // 5. Determine overall status from handle results
  const outputHandleResults = Object.values(handleResults)
  let overallStatus: 'completed' | 'partial' | 'error'
  if (outputHandleResults.length === 0) {
    // No output handles defined — fall back to simple check
    overallStatus = failedIds.size === 0 ? 'completed' : 'error'
  } else {
    const allCompleted = outputHandleResults.every(r => r.status === 'completed')
    const allFailed = outputHandleResults.every(r => r.status === 'error' || r.status === 'skipped')
    overallStatus = allCompleted ? 'completed' : allFailed ? 'error' : 'partial'
  }

  // 6. Combined output from internal output nodes (only successful ones)
  const outputNodes = sorted.filter(n => n.type === 'output')
  const combined = outputNodes.length > 0
    ? outputNodes
        .filter(n => !failedIds.has(n.id))
        .map(n => nodeOutputs.get(n.id) || '').filter(Boolean).join('\n\n')
    : nodeOutputs.get(sorted[sorted.length - 1]?.id || '') || input

  // 7. Write memories + increment pack run count (async, non-blocking)
  writePackedMemories({
    packName,
    flowId,
    internalNodes: sorted,
    nodeOutputs,
    success: overallStatus === 'completed',
  }).catch(() => {})

  // Increment pack run count
  if (packName) {
    fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.entry) return
        const currentCount = data.entry.runCount || 0
        return fetch(`/api/agents/packs/${encodeURIComponent(packName)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runCount: currentCount + 1 }),
        })
      })
      .catch(() => {})
  }

  return { output: combined, handleOutputs, handleResults, overallStatus }
}
