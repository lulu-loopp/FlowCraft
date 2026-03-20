'use client'

/**
 * Shared execution engine functions extracted from useFlowExecution.
 * Contains the duplicated logic for condition handling, loop resets,
 * result application, parallel scheduling, and run finalization.
 */

import type { Node, Edge } from '@xyflow/react'
import {
  areUpstreamsCompleteOrSkipped,
  markBranchSkipped,
  DEFAULT_MAX_LOOP_ITERATIONS,
} from '@/lib/flow-executor'
import {
  getNodeLabel,
  setConditionResult,
  setNodeError,
  setNodePartial,
  setNodeSkipped,
  setNodeSuccess,
  setNodeWarning,
  setLoopCount,
} from '@/lib/flow-execution-state'
import type { HandleResult } from '@/lib/packed-executor'
import type { NodeArtifact } from '@/types/flow'
import { useFlowStore, type GlobalLog, type RunRecord } from '@/store/flowStore'

// ── Types ──

type LogEntry = Omit<GlobalLog, 'id' | 'timestamp'> & { nodeId?: string }

export interface ExecutionState {
  edges: Edge[]
  loopEdgeIds: Set<string>
  completedNodeIds: Set<string>
  skippedNodeIds: Set<string>
  nodeOutputs: Map<string, string>
  handleOutputs: Map<string, Record<string, string>>
  handleResultsMap: Map<string, Record<string, HandleResult>>
  nodeArtifacts: Map<string, NodeArtifact[]>
  loopFeedback: Map<string, string>
  addLog: (log: LogEntry) => void
}

export interface NodeResult {
  output: string
  conditionResult?: boolean
  artifacts?: NodeArtifact[]
  handleOutputs?: Record<string, string>
  handleResults?: Record<string, HandleResult>
  packOverallStatus?: 'completed' | 'partial' | 'error'
}

// ── processConditionResult ──

/**
 * Handle condition node branching & loop logic.
 * Returns the loop reset target node ID if a loop iteration should occur, or null.
 */
export function processConditionResult(
  node: Node,
  result: NodeResult,
  count: number,
  state: ExecutionState,
): string | null {
  const condResult = result.conditionResult!
  const inactiveHandle = condResult ? 'false-handle' : 'true-handle'
  let loopResetTarget: string | null = null

  const falseBackEdge = state.edges.find(
    e => e.source === node.id && e.sourceHandle === 'false-handle' && state.loopEdgeIds.has(e.id)
  )
  const isLoopIteration = !!falseBackEdge && !condResult

  if (isLoopIteration) {
    const maxLoop = (node.data?.maxLoopIterations as number) || DEFAULT_MAX_LOOP_ITERATIONS
    setLoopCount(node.id, count)

    if (count >= maxLoop) {
      const warnMsg = `Looped ${count} times, limit reached`
      setNodeWarning(node.id, warnMsg)
      state.addLog({
        nodeName: getNodeLabel(node, 'Condition'),
        nodeType: 'condition', type: 'system',
        content: `⚠ ${warnMsg}. Forcing true branch.`,
      })
      markBranchSkipped(node.id, 'false-handle', state.edges, state.completedNodeIds, state.skippedNodeIds, state.loopEdgeIds)
    } else {
      const reviewerEdge = state.edges.find(e => e.target === node.id && !state.loopEdgeIds.has(e.id))
      const reviewerOutput = reviewerEdge ? (state.nodeOutputs.get(reviewerEdge.source) || '') : ''

      const loopTarget = falseBackEdge.target
      const pathQueue = [loopTarget]
      const pathVisited = new Set<string>()
      while (pathQueue.length > 0) {
        const pid = pathQueue.shift()!
        if (pathVisited.has(pid)) continue
        pathVisited.add(pid)

        const prevOutput = state.nodeOutputs.get(pid) || ''
        const parts: string[] = []
        if (prevOutput) parts.push(`[Your Previous Output]\n${prevOutput}`)
        if (reviewerOutput) parts.push(`[Reviewer Feedback]\n${reviewerOutput}`)
        if (parts.length > 0) state.loopFeedback.set(pid, parts.join('\n\n'))

        if (pid === node.id) continue
        for (const e of state.edges) {
          if (e.source === pid && !state.loopEdgeIds.has(e.id)) pathQueue.push(e.target)
        }
      }

      if (reviewerOutput) {
        state.addLog({
          nodeName: getNodeLabel(node, 'Condition'),
          nodeType: 'condition', type: 'system',
          content: `Passing reviewer feedback + previous outputs to ${pathVisited.size} loop node(s).`,
        })
      }
      loopResetTarget = loopTarget
    }
  } else {
    markBranchSkipped(node.id, inactiveHandle, state.edges, state.completedNodeIds, state.skippedNodeIds, state.loopEdgeIds)
  }

  setConditionResult(node.id, condResult)
  state.addLog({
    nodeName: getNodeLabel(node, 'Condition'),
    nodeType: 'condition', type: 'system',
    content: `Evaluated to ${condResult ? 'true' : 'false'}`,
  })

  return loopResetTarget
}

// ── removeFromCompleted ──

/**
 * BFS from startId to stopAtId, removing visited nodes from completed/skipped sets.
 * If `scopeFilter` is provided, only nodes in that set are actually removed.
 */
export function removeFromCompleted(
  startId: string,
  stopAtId: string,
  edges: Edge[],
  loopEdgeIds: Set<string>,
  completed: Set<string>,
  skipped: Set<string>,
  scopeFilter?: Set<string>,
): void {
  const queue = [startId]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const nid = queue.shift()!
    if (visited.has(nid)) continue
    visited.add(nid)
    if (!scopeFilter || scopeFilter.has(nid)) {
      completed.delete(nid)
      skipped.delete(nid)
    }
    if (nid === stopAtId) continue
    for (const e of edges) {
      if (e.source === nid && !loopEdgeIds.has(e.id)) queue.push(e.target)
    }
  }
}

// ── applyNodeResult ──

/**
 * Apply execution result to state: store output, artifacts, handles, and set visual status.
 */
export function applyNodeResult(
  node: Node,
  result: NodeResult,
  state: ExecutionState,
): void {
  state.nodeOutputs.set(node.id, result.output)
  if (result.artifacts && result.artifacts.length > 0) {
    const existing = state.nodeArtifacts.get(node.id) || []
    state.nodeArtifacts.set(node.id, [...existing, ...result.artifacts])
  }
  if (result.handleOutputs) state.handleOutputs.set(node.id, result.handleOutputs)
  if (result.handleResults) state.handleResultsMap.set(node.id, result.handleResults)
  state.completedNodeIds.add(node.id)

  // Visual status
  if (result.packOverallStatus === 'partial') {
    setNodePartial(node.id, result.output)
  } else if (result.packOverallStatus === 'error') {
    setNodeError(node.id)
  } else if (node.type !== 'condition' || !(node.data?.status === 'warning')) {
    setNodeSuccess(node.id, result.output)
  }

  const logMsg = result.packOverallStatus === 'partial'
    ? 'Completed (partial success).'
    : result.packOverallStatus === 'error'
      ? 'Completed (all outputs failed).'
      : 'Completed.'
  state.addLog({
    nodeName: getNodeLabel(node),
    nodeType: node.type || 'unknown', type: 'system',
    content: logMsg,
  })
}

// ── createScheduler ──

export interface SchedulerConfig {
  sortedNodes: Node[]
  /** IDs of non-IO nodes eligible for execution */
  runnableIds: string[]
  /** Node ID set that may be dynamically expanded (for loop scope expansion) */
  candidatePool?: Set<string> | string[]
  hasCycles: boolean
  state: ExecutionState
  runState: { status: 'success' | 'error' | 'stopped' }
  abortController: AbortController
  executeNode: (node: Node) => Promise<void>
}

/**
 * Creates a parallel scheduler that eagerly runs nodes whose upstreams are complete.
 * Returns a `runToCompletion()` async function.
 */
export function createScheduler(config: SchedulerConfig) {
  const { sortedNodes, runnableIds, hasCycles, state, runState, abortController } = config
  const remaining = new Set(runnableIds)
  const nodeMap = new Map(sortedNodes.map(n => [n.id, n]))
  const inFlight = new Map<string, Promise<void>>()

  const nodeFinished = new Map<string, () => void>()
  const nodeFinishedPromises = new Map<string, Promise<void>>()

  function ensureFinishPromise(nid: string) {
    if (!nodeFinishedPromises.has(nid)) {
      const p = new Promise<void>(resolve => { nodeFinished.set(nid, resolve) })
      nodeFinishedPromises.set(nid, p)
    }
  }
  for (const nid of remaining) ensureFinishPromise(nid)

  const trySchedule = () => {
    if (runState.status === 'error' || runState.status === 'stopped') return
    if (!useFlowStore.getState().isRunning) { runState.status = 'stopped'; abortController.abort(); return }

    for (const nid of remaining) {
      if (inFlight.has(nid)) continue

      if (state.skippedNodeIds.has(nid)) {
        remaining.delete(nid)
        setNodeSkipped(nid)
        state.completedNodeIds.add(nid)
        state.nodeOutputs.set(nid, '')
        const resolve = nodeFinished.get(nid)
        if (resolve) resolve()
        continue
      }

      if (!areUpstreamsCompleteOrSkipped(nid, state.edges, state.completedNodeIds, state.skippedNodeIds, state.loopEdgeIds)) continue

      // Check per-handle status: if this node connects to a pack's failed handle, mark it error
      const incomingEdges = state.edges.filter(e => e.target === nid && !state.loopEdgeIds.has(e.id))
      const failedUpstreamHandle = incomingEdges.find(e => {
        const hr = state.handleResultsMap.get(e.source)
        if (!hr || !e.sourceHandle) return false
        const handleStatus = hr[e.sourceHandle]?.status
        return handleStatus === 'error' || handleStatus === 'skipped'
      })
      if (failedUpstreamHandle) {
        remaining.delete(nid)
        state.completedNodeIds.add(nid)
        state.nodeOutputs.set(nid, '')
        const node = nodeMap.get(nid)!
        setNodeError(nid)
        state.addLog({
          nodeName: getNodeLabel(node),
          nodeType: node.type || 'unknown', type: 'system',
          content: 'Skipped: upstream Pack output failed',
        })
        const resolve = nodeFinished.get(nid)
        if (resolve) resolve()
        trySchedule()
        continue
      }

      const node = nodeMap.get(nid)!
      const task = config.executeNode(node)
        .then(() => {
          const resolve = nodeFinished.get(nid)
          if (resolve) resolve()
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            runState.status = 'stopped'
          } else {
            runState.status = 'error'
            setNodeError(nid)
            state.addLog({
              nodeName: getNodeLabel(node),
              nodeType: node.type || 'unknown', type: 'system',
              content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            })
          }
          const resolve = nodeFinished.get(nid)
          if (resolve) resolve()
        })
        .finally(() => {
          inFlight.delete(nid)
          remaining.delete(nid)

          if (hasCycles) {
            // Re-add nodes that need re-execution after loop reset
            const pool = config.candidatePool
            const candidates = pool instanceof Set ? pool : (pool ? new Set(pool) : new Set(runnableIds))
            for (const nid2 of candidates) {
              const n2 = nodeMap.get(nid2)
              if (!n2 || n2.type === 'io') continue
              if (!state.completedNodeIds.has(nid2) && !state.skippedNodeIds.has(nid2) && !remaining.has(nid2)) {
                remaining.add(nid2)
                const p = new Promise<void>(resolve => { nodeFinished.set(nid2, resolve) })
                nodeFinishedPromises.set(nid2, p)
              }
            }
          }

          trySchedule()
        })

      inFlight.set(nid, task)
    }
  }

  async function runToCompletion() {
    trySchedule()

    while (remaining.size > 0 || inFlight.size > 0) {
      if (inFlight.size === 0) {
        if (remaining.size > 0) {
          console.error(`Execution stuck: unschedulable nodes: ${[...remaining].join(', ')}`)
          runState.status = 'error'
          state.addLog({
            nodeName: 'System', nodeType: 'system', type: 'system',
            content: `Execution stuck: unschedulable nodes: ${[...remaining].join(', ')}`,
          })
        }
        break
      }
      await Promise.race(inFlight.values())
      if (runState.status === 'error' || runState.status === 'stopped') break
    }
  }

  return { runToCompletion }
}

// ── handleRunFinally ──

export function handleRunFinally(
  runState: { status: 'success' | 'error' | 'stopped' },
  abortController: AbortController,
  startedAt: string,
  startMs: number,
  nodeCount: number,
  addRunRecord: (record: RunRecord) => void,
): void {
  const stoppedByUser = runState.status === 'success' && !useFlowStore.getState().isRunning
  if (stoppedByUser) { runState.status = 'stopped'; abortController.abort() }

  useFlowStore.getState().setIsRunning(false)

  // Reset visual state for nodes still running/waiting after stop or error
  if (runState.status === 'stopped' || runState.status === 'error') {
    const store = useFlowStore.getState()
    store.setNodes(store.nodes.map(n => {
      const s = n.data?.status as string | undefined
      if (s === 'running' || s === 'waiting') {
        return { ...n, data: { ...n.data, status: 'stopped', currentToken: '' } }
      }
      return n
    }))
  }

  const record = {
    id: `run-${Date.now()}`,
    startedAt,
    status: runState.status,
    duration: Date.now() - startMs,
    nodeCount,
  }
  addRunRecord(record)

  const { flowId, nodes: finalNodes, edges: finalEdges, flowName } = useFlowStore.getState()
  if (flowId) {
    fetch(`/api/flows/${flowId}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }).catch(() => {})

    fetch(`/api/flows/${flowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: flowName || 'Untitled Flow', nodes: finalNodes, edges: finalEdges }),
    }).catch(() => {})
  }
}
