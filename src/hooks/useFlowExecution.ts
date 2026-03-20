'use client'

import { useCallback } from 'react'
import { useFlowStore } from '@/store/flowStore'
import {
  topologicalSort,
  areUpstreamsCompleteOrSkipped,
  markBranchSkipped,
  detectCycles,
  findLoopEdgeIds,
  computeRunFromNodeSet,
  DEFAULT_MAX_LOOP_ITERATIONS,
} from '@/lib/flow-executor'
import type { InputFile } from '@/types/flow'
import { distillExecutionMemory, appendMemory, incrementRunCount } from '@/lib/memory-updater'
import type { PersonalityConfig } from '@/lib/personality-injector'
import {
  getNodeLabel,
  resetExecutionNodes,
  setConditionResult,
  setInputNodeRunning,
  setInputNodeSuccess,
  setNodeError,
  setNodePartial,
  setNodeSkipped,
  setNodeSuccess,
  setNodeWarning,
  setLoopCount,
} from '@/lib/flow-execution-state'
import type { HandleResult } from '@/lib/packed-executor'
import type { NodeArtifact } from '@/types/flow'
import { executeNodeWork, buildInitialInput, getDefaultProvider } from '@/lib/flow-run-helpers'

type InputNodeData = {
  inputFiles?: InputFile[]
  inputText?: string
}

export function useFlowExecution() {
  const { nodes, edges, setIsRunning, addLog, clearLogs, setNodes, addRunRecord } = useFlowStore()

  const runFlow = useCallback(async (userInput?: string) => {
    if (nodes.length === 0) return
    if (useFlowStore.getState().isRunning) return

    // Set isRunning immediately as a mutex — BEFORE any await
    setIsRunning(true)

    const startedAt = new Date().toISOString()
    const startMs = Date.now()
    const currentFlowId = useFlowStore.getState().flowId
    const defaultProvider = await getDefaultProvider()

    if (currentFlowId) {
      fetch(`/api/workspace/${currentFlowId}`, { method: 'POST' }).catch(() => {})
    }

    clearLogs()
    setNodes(resetExecutionNodes(nodes))

    const hasCycles = detectCycles(nodes, edges)
    const loopEdgeIds = hasCycles ? findLoopEdgeIds(edges) : new Set<string>()
    const sortedNodes = topologicalSort(nodes, edges)
    const completedNodeIds = new Set<string>()
    const skippedNodeIds = new Set<string>()
    const nodeOutputs = new Map<string, string>()
    const handleOutputs = new Map<string, Record<string, string>>()
    const handleResultsMap = new Map<string, Record<string, HandleResult>>()
    const nodeArtifacts = new Map<string, NodeArtifact[]>()
    const executionCount = new Map<string, number>()
    const loopFeedback = new Map<string, string>()
    // Process ALL io nodes — each is an independent entry point
    const inputNodes = sortedNodes.filter((n) => n.type === 'io')
    const inputNodeIds = new Set(inputNodes.map(n => n.id))
    // Per-io-node images map for downstream image passing
    const inputImagesMap = new Map<string, InputFile[]>()
    // The first io node (or the one without text) receives userInput from the dialog
    let firstInputUsed = false

    for (const ioNode of inputNodes) {
      const ioData = (ioNode.data || {}) as InputNodeData
      const applyUserInput = !firstInputUsed && (!ioData.inputText?.trim() || inputNodes.length === 1)
      const { initialInput: ioInput, inputImages: ioImages } = buildInitialInput(
        ioData,
        applyUserInput ? userInput : undefined,
      )
      if (applyUserInput) firstInputUsed = true

      inputImagesMap.set(ioNode.id, ioImages)
      setInputNodeRunning(ioNode.id)
      await new Promise((r) => setTimeout(r, 300))
      setInputNodeSuccess(ioNode.id)
      completedNodeIds.add(ioNode.id)
      nodeOutputs.set(ioNode.id, ioInput)
    }

    // Fallback for flows without any io node
    const initialInput = nodeOutputs.values().next().value ?? userInput ?? 'Start'
    const inputImages = inputImagesMap.values().next().value ?? []

    const runState = { status: 'success' as 'success' | 'error' | 'stopped' }
    const abortController = new AbortController()

    // ── Execute a single non-IO node ──
    async function executeNode(node: import('@xyflow/react').Node): Promise<void> {
      const count = (executionCount.get(node.id) || 0) + 1
      executionCount.set(node.id, count)

      const result = await executeNodeWork({
        node, edges, inputNodeIds, inputImagesMap, initialInput, inputImages,
        nodeOutputs, handleOutputs, nodeArtifacts, completedNodeIds, skippedNodeIds,
        currentFlowId, defaultProvider, addLog, loopEdgeIds, loopFeedback,
        signal: abortController.signal,
      })

      // Track whether this condition triggers a loop reset (deferred to after completedNodeIds.add)
      let loopResetTarget: string | null = null

      // Condition node: handle branching & loops
      if (node.type === 'condition') {
        const condResult = result.conditionResult!
        const inactiveHandle = condResult ? 'false-handle' : 'true-handle'

        // Check if false-handle leads to a loop back-edge
        const falseBackEdge = edges.find(
          e => e.source === node.id && e.sourceHandle === 'false-handle' && loopEdgeIds.has(e.id)
        )
        const isLoopIteration = !!falseBackEdge && !condResult

        if (isLoopIteration) {
          // false → loop: re-enqueue loop path nodes
          const maxLoop = (node.data?.maxLoopIterations as number) || DEFAULT_MAX_LOOP_ITERATIONS
          setLoopCount(node.id, count)

          if (count >= maxLoop) {
            // Exceeded limit: warning, force true path
            const warnMsg = `Looped ${count} times, limit reached`
            setNodeWarning(node.id, warnMsg)
            addLog({
              nodeName: getNodeLabel(node, 'Condition'),
              nodeType: 'condition', type: 'system',
              content: `⚠ ${warnMsg}. Forcing true branch.`,
            })
            markBranchSkipped(node.id, 'false-handle', edges, completedNodeIds, skippedNodeIds, loopEdgeIds)
          } else {
            // Capture reviewer feedback for ALL nodes on the loop path.
            // Each node gets its own previous output + reviewer feedback,
            // so it can decide whether to redo its work or keep it.
            const reviewerEdge = edges.find(e => e.target === node.id && !loopEdgeIds.has(e.id))
            const reviewerOutput = reviewerEdge ? (nodeOutputs.get(reviewerEdge.source) || '') : ''

            const loopTarget = falseBackEdge.target
            const pathQueue = [loopTarget]
            const pathVisited = new Set<string>()
            while (pathQueue.length > 0) {
              const pid = pathQueue.shift()!
              if (pathVisited.has(pid)) continue
              pathVisited.add(pid)

              const prevOutput = nodeOutputs.get(pid) || ''
              const parts: string[] = []
              if (prevOutput) parts.push(`[Your Previous Output]\n${prevOutput}`)
              if (reviewerOutput) parts.push(`[Reviewer Feedback]\n${reviewerOutput}`)
              if (parts.length > 0) loopFeedback.set(pid, parts.join('\n\n'))

              if (pid === node.id) continue
              for (const e of edges) {
                if (e.source === pid && !loopEdgeIds.has(e.id)) pathQueue.push(e.target)
              }
            }

            if (reviewerOutput) {
              addLog({
                nodeName: getNodeLabel(node, 'Condition'),
                nodeType: 'condition', type: 'system',
                content: `Passing reviewer feedback + previous outputs to ${pathVisited.size} loop node(s).`,
              })
            }
            loopResetTarget = loopTarget
          }
        } else {
          // Normal branching (no loop, or condition was true)
          markBranchSkipped(node.id, inactiveHandle, edges, completedNodeIds, skippedNodeIds, loopEdgeIds)
        }

        setConditionResult(node.id, condResult)
        addLog({
          nodeName: getNodeLabel(node, 'Condition'),
          nodeType: 'condition', type: 'system',
          content: `Evaluated to ${condResult ? 'true' : 'false'}`,
        })
      }

      nodeOutputs.set(node.id, result.output)
      if (result.artifacts && result.artifacts.length > 0) {
        // Merge with any existing artifacts (from prior loop iterations)
        const existing = nodeArtifacts.get(node.id) || []
        nodeArtifacts.set(node.id, [...existing, ...result.artifacts])
      }
      if (result.handleOutputs) {
        handleOutputs.set(node.id, result.handleOutputs)
      }
      if (result.handleResults) {
        handleResultsMap.set(node.id, result.handleResults)
      }
      completedNodeIds.add(node.id)

      // Now remove loop-path nodes (including this condition) so they re-execute
      if (loopResetTarget) {
        removeFromCompleted(loopResetTarget, node.id, completedNodeIds)
        completedNodeIds.delete(node.id)
      }

      // Set node visual status based on pack overall status or normal success
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
      addLog({
        nodeName: getNodeLabel(node),
        nodeType: node.type || 'unknown', type: 'system',
        content: logMsg,
      })

      // Post-execution: save docs, memory, etc.
      await postExecuteNode(node, result.output, currentFlowId)
    }

    /** Remove loop-path nodes from completedNodeIds so they can re-execute */
    function removeFromCompleted(startId: string, stopAtId: string, completed: Set<string>) {
      const queue = [startId]
      const visited = new Set<string>()
      while (queue.length > 0) {
        const nid = queue.shift()!
        if (visited.has(nid)) continue
        visited.add(nid)
        completed.delete(nid)
        skippedNodeIds.delete(nid)
        if (nid === stopAtId) continue
        for (const e of edges) {
          if (e.source === nid && !loopEdgeIds.has(e.id)) {
            queue.push(e.target)
          }
        }
      }
    }

    // ── Eager parallel execution ──
    try {
      const allNonIo = sortedNodes.filter(n => n.type !== 'io')
      const remaining = new Set(allNonIo.map(n => n.id))
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

          if (skippedNodeIds.has(nid)) {
            remaining.delete(nid)
            setNodeSkipped(nid)
            completedNodeIds.add(nid)
            nodeOutputs.set(nid, '')
            const resolve = nodeFinished.get(nid)
            if (resolve) resolve()
            continue
          }

          if (!areUpstreamsCompleteOrSkipped(nid, edges, completedNodeIds, skippedNodeIds, loopEdgeIds)) continue

          // Check per-handle status: if this node connects to a pack's failed handle, mark it error
          const incomingEdges = edges.filter(e => e.target === nid && !loopEdgeIds.has(e.id))
          const failedUpstreamHandle = incomingEdges.find(e => {
            const hr = handleResultsMap.get(e.source)
            if (!hr || !e.sourceHandle) return false
            const handleStatus = hr[e.sourceHandle]?.status
            return handleStatus === 'error' || handleStatus === 'skipped'
          })
          if (failedUpstreamHandle) {
            remaining.delete(nid)
            completedNodeIds.add(nid)
            nodeOutputs.set(nid, '')
            const node = nodeMap.get(nid)!
            setNodeError(nid)
            addLog({
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
          const task = executeNode(node)
            .then(() => {
              const resolve = nodeFinished.get(nid)
              if (resolve) resolve()
            })
            .catch((err) => {
              // Abort errors are expected when user clicks Stop — don't treat as failure
              if (err instanceof DOMException && err.name === 'AbortError') {
                runState.status = 'stopped'
              } else {
                runState.status = 'error'
                setNodeError(nid)
                addLog({
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

              // If this node triggered a loop, re-add loop nodes to remaining
              if (hasCycles) {
                for (const nid2 of allNonIo.map(n => n.id)) {
                  if (!completedNodeIds.has(nid2) && !skippedNodeIds.has(nid2) && !remaining.has(nid2)) {
                    remaining.add(nid2)
                    // Create new finish promise for re-enqueued node
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

      trySchedule()

      while (remaining.size > 0 || inFlight.size > 0) {
        if (inFlight.size === 0) {
          if (remaining.size > 0) {
            const stuckNodes = [...remaining].join(', ')
            console.error(`Execution stuck: unschedulable nodes: ${stuckNodes}`)
            runState.status = 'error'
            addLog({
              nodeName: 'System', nodeType: 'system', type: 'system',
              content: `Execution stuck: unschedulable nodes: ${stuckNodes}`,
            })
          }
          break
        }
        await Promise.race(inFlight.values())
        if (runState.status === 'error' || runState.status === 'stopped') break
      }
    } finally {
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
        nodeCount: sortedNodes.length,
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
  }, [nodes, edges, setIsRunning, clearLogs, setNodes, addLog, addRunRecord])

  const runFromNode = useCallback(async (startNodeId: string) => {
    // IMPORTANT: Read fresh state from store, not from the closure.
    // React batching can make closure `nodes`/`edges` stale after a prior run.
    const { nodes: freshNodes, edges: freshEdges, flowId: currentFlowId } = useFlowStore.getState()
    if (freshNodes.length === 0) return
    if (useFlowStore.getState().isRunning) return

    // Set isRunning immediately as a mutex — BEFORE any await — to prevent
    // concurrent invocations from passing the guard above.
    setIsRunning(true)

    const startedAt = new Date().toISOString()
    const startMs = Date.now()
    const defaultProvider = await getDefaultProvider()

    if (currentFlowId) {
      fetch(`/api/workspace/${currentFlowId}`, { method: 'POST' }).catch(() => {})
    }

    // Build set of nodes that have cached output from a previous run
    const nodesWithOutput = new Set<string>()
    for (const n of freshNodes) {
      if (
        n.data?.status === 'success' ||
        (typeof n.data?.currentOutput === 'string' && (n.data.currentOutput as string).trim()) ||
        n.type === 'io'  // io nodes always count as having output
      ) {
        nodesWithOutput.add(n.id)
      }
    }

    const { nodesToRun, preCompleted, missingUpstream } = computeRunFromNodeSet(startNodeId, freshNodes, freshEdges, nodesWithOutput)

    // Inform the user which nodes will be (re-)run
    const startNode = freshNodes.find(n => n.id === startNodeId)
    const startLabel = (startNode?.data?.label as string) || startNodeId
    const cachedCount = preCompleted.size
    const runCount = nodesToRun.size
    if (cachedCount > 0) {
      addLog({
        nodeName: 'System', nodeType: 'system', type: 'system',
        content: `▶ Run from "${startLabel}": ${runCount} node(s) will run, ${cachedCount} node(s) use cached output.`,
      })
    } else {
      addLog({
        nodeName: 'System', nodeType: 'system', type: 'system',
        content: `▶ Run from "${startLabel}": no cached outputs — all ${runCount} node(s) will run.`,
      })
    }
    if (missingUpstream.length > 0) {
      addLog({
        nodeName: 'System', nodeType: 'system', type: 'system',
        content: `⚠ Upstream node(s) without output (will receive empty input): ${missingUpstream.join(', ')}`,
      })
    }

    clearLogs()

    // Selectively reset only nodes that will run; preserve others
    setNodes(freshNodes.map(n => {
      if (nodesToRun.has(n.id)) {
        return {
          ...n,
          data: {
            ...n.data,
            status: 'waiting',
            logs: [],
            currentOutput: '',
            currentToken: '',
          },
        }
      }
      return n
    }))

    const hasCycles = detectCycles(freshNodes, freshEdges)
    const loopEdgeIds = hasCycles ? findLoopEdgeIds(freshEdges) : new Set<string>()
    const sortedNodes = topologicalSort(freshNodes, freshEdges)
    const completedNodeIds = new Set<string>(preCompleted)
    const skippedNodeIds = new Set<string>()
    const nodeOutputs = new Map<string, string>()
    const handleOutputs = new Map<string, Record<string, string>>()
    const handleResultsMap = new Map<string, Record<string, HandleResult>>()
    const nodeArtifacts = new Map<string, NodeArtifact[]>()
    const executionCount = new Map<string, number>()
    const loopFeedback = new Map<string, string>()

    // Pre-populate outputs from cached node data
    const inputImagesMap = new Map<string, InputFile[]>()
    for (const nid of preCompleted) {
      const n = freshNodes.find(nd => nd.id === nid)
      if (!n) continue
      if (n.type === 'io') {
        const ioData = (n.data || {}) as InputNodeData
        const { initialInput, inputImages: ioImages } = buildInitialInput(ioData, undefined)
        nodeOutputs.set(nid, initialInput)
        inputImagesMap.set(nid, ioImages)
      } else {
        nodeOutputs.set(nid, (n.data?.currentOutput as string) || '')
      }
    }

    // Also process io nodes that are in nodesToRun (missing output)
    const inputNodeIds = new Set(sortedNodes.filter(n => n.type === 'io').map(n => n.id))
    for (const ioNode of sortedNodes.filter(n => n.type === 'io' && nodesToRun.has(n.id))) {
      const ioData = (ioNode.data || {}) as InputNodeData
      const { initialInput: ioInput, inputImages: ioImages } = buildInitialInput(ioData, undefined)
      inputImagesMap.set(ioNode.id, ioImages)
      setInputNodeRunning(ioNode.id)
      await new Promise(r => setTimeout(r, 300))
      setInputNodeSuccess(ioNode.id)
      completedNodeIds.add(ioNode.id)
      nodeOutputs.set(ioNode.id, ioInput)
    }

    const initialInput = nodeOutputs.values().next().value ?? 'Start'
    const inputImages = inputImagesMap.values().next().value ?? []

    const runState = { status: 'success' as 'success' | 'error' | 'stopped' }
    const abortController = new AbortController()

    async function executeNode(node: import('@xyflow/react').Node): Promise<void> {
      const count = (executionCount.get(node.id) || 0) + 1
      executionCount.set(node.id, count)

      const result = await executeNodeWork({
        node, edges: freshEdges, inputNodeIds, inputImagesMap, initialInput, inputImages,
        nodeOutputs, handleOutputs, nodeArtifacts, completedNodeIds, skippedNodeIds,
        currentFlowId, defaultProvider, addLog, loopEdgeIds, loopFeedback,
        signal: abortController.signal,
      })

      let loopResetTarget: string | null = null

      if (node.type === 'condition') {
        const condResult = result.conditionResult!
        const inactiveHandle = condResult ? 'false-handle' : 'true-handle'

        const falseBackEdge = freshEdges.find(
          e => e.source === node.id && e.sourceHandle === 'false-handle' && loopEdgeIds.has(e.id)
        )
        const isLoopIteration = !!falseBackEdge && !condResult

        if (isLoopIteration) {
          const maxLoop = (node.data?.maxLoopIterations as number) || DEFAULT_MAX_LOOP_ITERATIONS
          setLoopCount(node.id, count)

          if (count >= maxLoop) {
            const warnMsg = `Looped ${count} times, limit reached`
            setNodeWarning(node.id, warnMsg)
            addLog({
              nodeName: getNodeLabel(node, 'Condition'),
              nodeType: 'condition', type: 'system',
              content: `⚠ ${warnMsg}. Forcing true branch.`,
            })
            markBranchSkipped(node.id, 'false-handle', freshEdges, completedNodeIds, skippedNodeIds, loopEdgeIds)
          } else {
            // Capture reviewer feedback for ALL nodes on the loop path,
            // not just the loop target. Each node gets:
            //   - Its own previous output (so it can decide whether to redo)
            //   - The reviewer's feedback (so it knows what went wrong)
            const reviewerEdge = freshEdges.find(e => e.target === node.id && !loopEdgeIds.has(e.id))
            const reviewerOutput = reviewerEdge ? (nodeOutputs.get(reviewerEdge.source) || '') : ''

            // BFS the loop path: from loop target forward to this condition
            const loopTarget = falseBackEdge.target
            const pathQueue = [loopTarget]
            const pathVisited = new Set<string>()
            while (pathQueue.length > 0) {
              const pid = pathQueue.shift()!
              if (pathVisited.has(pid)) continue
              pathVisited.add(pid)

              const prevOutput = nodeOutputs.get(pid) || ''
              // Build per-node feedback: own previous output + reviewer feedback
              const parts: string[] = []
              if (prevOutput) {
                parts.push(`[Your Previous Output]\n${prevOutput}`)
              }
              if (reviewerOutput) {
                parts.push(`[Reviewer Feedback]\n${reviewerOutput}`)
              }
              if (parts.length > 0) {
                loopFeedback.set(pid, parts.join('\n\n'))
              }

              if (pid === node.id) continue // don't walk past the condition
              for (const e of freshEdges) {
                if (e.source === pid && !loopEdgeIds.has(e.id)) pathQueue.push(e.target)
              }
            }

            if (reviewerOutput) {
              addLog({
                nodeName: getNodeLabel(node, 'Condition'),
                nodeType: 'condition', type: 'system',
                content: `Passing reviewer feedback + previous outputs to ${pathVisited.size} loop node(s).`,
              })
            }
            loopResetTarget = loopTarget
          }
        } else {
          markBranchSkipped(node.id, inactiveHandle, freshEdges, completedNodeIds, skippedNodeIds, loopEdgeIds)
        }

        setConditionResult(node.id, condResult)
        addLog({
          nodeName: getNodeLabel(node, 'Condition'),
          nodeType: 'condition', type: 'system',
          content: `Evaluated to ${condResult ? 'true' : 'false'}`,
        })
      }

      nodeOutputs.set(node.id, result.output)
      if (result.artifacts && result.artifacts.length > 0) {
        const existing = nodeArtifacts.get(node.id) || []
        nodeArtifacts.set(node.id, [...existing, ...result.artifacts])
      }
      if (result.handleOutputs) handleOutputs.set(node.id, result.handleOutputs)
      if (result.handleResults) handleResultsMap.set(node.id, result.handleResults)
      completedNodeIds.add(node.id)

      if (loopResetTarget) {
        // If the loop target is outside the current execution scope (e.g. when
        // runFromNode started mid-chain), expand the scope to include the full
        // loop path so those nodes can be re-run.
        if (!nodesToRun.has(loopResetTarget)) {
          const expandQueue = [loopResetTarget]
          const expandVisited = new Set<string>()
          while (expandQueue.length > 0) {
            const eid = expandQueue.shift()!
            if (expandVisited.has(eid)) continue
            expandVisited.add(eid)
            nodesToRun.add(eid)
            if (eid === node.id) continue
            for (const e of freshEdges) {
              if (e.source === eid && !loopEdgeIds.has(e.id)) expandQueue.push(e.target)
            }
          }
          // Reset visual state for expanded nodes
          useFlowStore.getState().setNodes(
            useFlowStore.getState().nodes.map(n =>
              expandVisited.has(n.id) && n.type !== 'io'
                ? { ...n, data: { ...n.data, status: 'waiting', logs: [], currentOutput: '', currentToken: '' } }
                : n
            )
          )
        }
        removeFromCompleted(loopResetTarget, node.id, completedNodeIds)
        completedNodeIds.delete(node.id)
      }

      if (result.packOverallStatus === 'partial') {
        setNodePartial(node.id, result.output)
      } else if (result.packOverallStatus === 'error') {
        setNodeError(node.id)
      } else if (node.type !== 'condition' || !(node.data?.status === 'warning')) {
        setNodeSuccess(node.id, result.output)
      }

      addLog({
        nodeName: getNodeLabel(node),
        nodeType: node.type || 'unknown', type: 'system',
        content: result.packOverallStatus === 'partial' ? 'Completed (partial success).'
          : result.packOverallStatus === 'error' ? 'Completed (all outputs failed).'
          : 'Completed.',
      })

      await postExecuteNode(node, result.output, currentFlowId)
    }

    function removeFromCompleted(startId: string, stopAtId: string, completed: Set<string>) {
      const queue = [startId]
      const visited = new Set<string>()
      while (queue.length > 0) {
        const nid = queue.shift()!
        if (visited.has(nid)) continue
        visited.add(nid)
        // Only reset nodes within the current execution scope (nodesToRun).
        // Pre-completed nodes (cached upstream outputs) must stay in completedNodeIds
        // otherwise downstream merge nodes will never see their upstreams as satisfied.
        if (nodesToRun.has(nid)) {
          completed.delete(nid)
          skippedNodeIds.delete(nid)
        }
        if (nid === stopAtId) continue
        for (const e of freshEdges) {
          if (e.source === nid && !loopEdgeIds.has(e.id)) queue.push(e.target)
        }
      }
    }

    // ── Eager parallel execution (only runs nodes in nodesToRun) ──
    try {
      const runnableNonIo = sortedNodes.filter(n => n.type !== 'io' && nodesToRun.has(n.id))
      const remaining = new Set(runnableNonIo.map(n => n.id))
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

          if (skippedNodeIds.has(nid)) {
            remaining.delete(nid)
            setNodeSkipped(nid)
            completedNodeIds.add(nid)
            nodeOutputs.set(nid, '')
            const resolve = nodeFinished.get(nid)
            if (resolve) resolve()
            continue
          }

          if (!areUpstreamsCompleteOrSkipped(nid, freshEdges, completedNodeIds, skippedNodeIds, loopEdgeIds)) continue

          const incomingEdges = freshEdges.filter(e => e.target === nid && !loopEdgeIds.has(e.id))
          const failedUpstreamHandle = incomingEdges.find(e => {
            const hr = handleResultsMap.get(e.source)
            if (!hr || !e.sourceHandle) return false
            const handleStatus = hr[e.sourceHandle]?.status
            return handleStatus === 'error' || handleStatus === 'skipped'
          })
          if (failedUpstreamHandle) {
            remaining.delete(nid)
            completedNodeIds.add(nid)
            nodeOutputs.set(nid, '')
            const node = nodeMap.get(nid)!
            setNodeError(nid)
            addLog({ nodeName: getNodeLabel(node), nodeType: node.type || 'unknown', type: 'system', content: 'Skipped: upstream Pack output failed' })
            const resolve = nodeFinished.get(nid)
            if (resolve) resolve()
            trySchedule()
            continue
          }

          const node = nodeMap.get(nid)!
          const task = executeNode(node)
            .then(() => { const resolve = nodeFinished.get(nid); if (resolve) resolve() })
            .catch((err) => {
              if (err instanceof DOMException && err.name === 'AbortError') {
                runState.status = 'stopped'
              } else {
                runState.status = 'error'
                setNodeError(nid)
                addLog({ nodeName: getNodeLabel(node), nodeType: node.type || 'unknown', type: 'system', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` })
              }
              const resolve = nodeFinished.get(nid); if (resolve) resolve()
            })
            .finally(() => {
              inFlight.delete(nid)
              remaining.delete(nid)
              if (hasCycles) {
                // Use nodesToRun (which may have been dynamically expanded during
                // loop iterations) instead of the static runnableNonIo array.
                for (const nid2 of nodesToRun) {
                  const n2 = nodeMap.get(nid2)
                  if (!n2 || n2.type === 'io') continue
                  if (!completedNodeIds.has(nid2) && !skippedNodeIds.has(nid2) && !remaining.has(nid2)) {
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

      trySchedule()

      while (remaining.size > 0 || inFlight.size > 0) {
        if (inFlight.size === 0) {
          if (remaining.size > 0) {
            console.error(`Execution stuck: unschedulable nodes: ${[...remaining].join(', ')}`)
            runState.status = 'error'
            addLog({ nodeName: 'System', nodeType: 'system', type: 'system', content: `Execution stuck: unschedulable nodes: ${[...remaining].join(', ')}` })
          }
          break
        }
        await Promise.race(inFlight.values())
        if (runState.status === 'error' || runState.status === 'stopped') break
      }
    } finally {
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
        nodeCount: nodesToRun.size,
      }
      addRunRecord(record)

      const { flowId, nodes: finalNodes, edges: finalEdges, flowName } = useFlowStore.getState()
      if (flowId) {
        fetch(`/api/flows/${flowId}/runs`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        }).catch(() => {})
        fetch(`/api/flows/${flowId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: flowName || 'Untitled Flow', nodes: finalNodes, edges: finalEdges }),
        }).catch(() => {})
      }
    }
  }, [setIsRunning, clearLogs, setNodes, addLog, addRunRecord])

  /**
   * Run a single node only (no downstream).
   * Returns { needsWarning, missingLabels } if upstream has no output — caller should confirm.
   * Pass `force: true` to skip the warning and run anyway.
   */
  const runSingleNode = useCallback(async (
    nodeId: string,
    opts?: { force?: boolean },
  ): Promise<{ needsWarning: boolean; missingLabels: string[] } | void> => {
    const { nodes: freshNodes, edges: freshEdges, flowId: currentFlowId } = useFlowStore.getState()
    if (freshNodes.length === 0) return
    // Allow running single nodes even while other single nodes are running
    // Only block if a full flow run is in progress
    const currentNode = freshNodes.find(n => n.id === nodeId)
    if (currentNode?.data?.status === 'running') return

    const node = freshNodes.find(n => n.id === nodeId)
    if (!node) return

    // Detect loop back-edges
    const hasCycles = detectCycles(freshNodes, freshEdges)
    const loopEdgeIds = hasCycles ? findLoopEdgeIds(freshEdges) : new Set<string>()

    // Check upstream outputs (skip loop back-edges)
    const incomingEdges = freshEdges.filter(e => e.target === nodeId && !loopEdgeIds.has(e.id))
    const missingUpstream: string[] = []
    for (const e of incomingEdges) {
      const src = freshNodes.find(n => n.id === e.source)
      if (!src) continue
      const hasOutput = src.type === 'io' ||
        src.data?.status === 'success' ||
        (typeof src.data?.currentOutput === 'string' && (src.data.currentOutput as string).trim())
      if (!hasOutput) {
        missingUpstream.push((src.data?.label as string) || src.id)
      }
    }

    if (missingUpstream.length > 0 && !opts?.force) {
      return { needsWarning: true, missingLabels: missingUpstream }
    }

    // Gather upstream outputs as input
    const upstreamOutputs = incomingEdges
      .map(e => {
        const src = freshNodes.find(n => n.id === e.source)
        if (!src) return ''
        if (src.type === 'io') {
          const ioData = (src.data || {}) as { inputText?: string; inputFiles?: InputFile[] }
          const inputFiles = ioData.inputFiles || []
          const textFiles = inputFiles.filter(f => f.type === 'text').map(f => `\n\nFile content (${f.name}):\n${f.content}`).join('')
          const docFiles = inputFiles.filter(f => f.type === 'document').map(f => `\n\n[Uploaded Document: ${f.name}]\nThis file has been saved to the workspace at uploads/${f.name}. Use the read_file tool to access its contents.`).join('')
          return (ioData.inputText || '') + textFiles + docFiles
        }
        return (src.data?.currentOutput as string) || ''
      })
      .filter(Boolean)
      .join('\n\n')

    const defaultProvider = await getDefaultProvider()
    const startedAt = new Date().toISOString()
    const startMs = Date.now()

    if (currentFlowId) {
      fetch(`/api/workspace/${currentFlowId}`, { method: 'POST' }).catch(() => {})
    }

    const nodeLabel = (node.data?.label as string) || nodeId
    addLog({
      nodeName: 'System', nodeType: 'system', type: 'system',
      content: `▶ Running single node: "${nodeLabel}"${missingUpstream.length > 0 ? ' (some upstream missing output)' : ''}`,
    })

    // Don't set global isRunning — single node runs are independent
    // Reset only this node's state
    setNodes(freshNodes.map(n => {
      if (n.id === nodeId) {
        return { ...n, data: { ...n.data, status: 'running', logs: [], currentOutput: '', currentToken: '' } }
      }
      return n
    }))

    const inputNodeIds = new Set(freshNodes.filter(n => n.type === 'io').map(n => n.id))
    const inputImagesMap = new Map<string, InputFile[]>()
    // Collect images from io nodes
    for (const e of incomingEdges) {
      const src = freshNodes.find(n => n.id === e.source)
      if (src?.type === 'io') {
        const ioFiles = ((src.data as Record<string, unknown>)?.inputFiles as InputFile[]) || []
        inputImagesMap.set(src.id, ioFiles.filter(f => f.type === 'image'))
      }
    }

    const initialInput = upstreamOutputs || 'Start'
    const inputImages = inputImagesMap.values().next().value || []
    const nodeOutputs = new Map<string, string>()
    const handleOutputs = new Map<string, Record<string, string>>()
    const nodeArtifacts = new Map<string, NodeArtifact[]>()
    const completedNodeIds = new Set<string>()
    const skippedNodeIds = new Set<string>()

    // Pre-populate upstream outputs
    for (const e of incomingEdges) {
      const src = freshNodes.find(n => n.id === e.source)
      if (src) {
        if (src.type === 'io') {
          const ioData = (src.data || {}) as { inputText?: string }
          nodeOutputs.set(src.id, ioData.inputText || '')
        } else {
          nodeOutputs.set(src.id, (src.data?.currentOutput as string) || '')
        }
        completedNodeIds.add(src.id)
      }
    }

    const abortController = new AbortController()
    let runStatus: 'success' | 'error' | 'stopped' = 'success'

    try {
      const result = await executeNodeWork({
        node, edges: freshEdges, inputNodeIds, inputImagesMap, initialInput, inputImages,
        nodeOutputs, handleOutputs, nodeArtifacts, completedNodeIds, skippedNodeIds,
        currentFlowId, defaultProvider, addLog,
        loopEdgeIds: new Set<string>(),
        signal: abortController.signal,
      })

      if (result.packOverallStatus === 'partial') {
        setNodePartial(node.id, result.output)
      } else if (result.packOverallStatus === 'error') {
        setNodeError(node.id)
      } else {
        setNodeSuccess(node.id, result.output)
      }
      addLog({
        nodeName: (node.data?.label as string) || 'Node',
        nodeType: node.type || 'unknown', type: 'system',
        content: 'Completed.',
      })
      await postExecuteNode(node, result.output, currentFlowId)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        runStatus = 'stopped'
      } else {
        runStatus = 'error'
        setNodeError(node.id)
        addLog({
          nodeName: (node.data?.label as string) || 'Node',
          nodeType: node.type || 'unknown', type: 'system',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      }
    } finally {
      addRunRecord({
        id: `run-${Date.now()}`,
        startedAt,
        status: runStatus,
        duration: Date.now() - startMs,
        nodeCount: 1,
      })
    }
  }, [setNodes, addLog, addRunRecord])

  return { runFlow, runFromNode, runSingleNode }
}

// ── Post-execution side effects (docs, memory) ──
async function postExecuteNode(
  node: import('@xyflow/react').Node,
  output: string,
  currentFlowId: string,
) {
  const edges = useFlowStore.getState().edges

  // Auto-save document — disabled (generated too many .md files in workspace)
  // Agents that need to produce files should use tools (python_execute / js_execute) explicitly.

  // Output node: propagate docs from upstream + scan workspace for generated files
  if (node.type === 'output') {
    const upstreamIds = edges.filter(e => e.target === node.id).map(e => e.source)
    const store = useFlowStore.getState()
    const docs: { url: string; name: string }[] = []

    // 1. Collect explicit documents from upstream agent nodes
    for (const uid of upstreamIds) {
      const upNode = store.nodes.find(n => n.id === uid)
      if (upNode?.data?.documentUrl) {
        docs.push({ url: upNode.data.documentUrl as string, name: upNode.data.documentName as string })
      }
    }

    // 2. Scan workspace for generated files (pptx, pdf, xlsx, images, etc.)
    if (currentFlowId) {
      try {
        const wsRes = await fetch(`/api/workspace/${currentFlowId}`)
        if (wsRes.ok) {
          const wsData = await wsRes.json()
          const wsFiles = (wsData.files || []) as { name: string; relativePath: string; size: number }[]
          // Exclude internal files (memory, progress, features, etc.)
          const INTERNAL_PATTERNS = /^(memory\/|progress\.md|features\.json|shared\.md|docs\/)/
          for (const f of wsFiles) {
            if (INTERNAL_PATTERNS.test(f.relativePath)) continue
            // Avoid duplicates if already in docs
            if (docs.some(d => d.name === f.name)) continue
            docs.push({
              url: `/api/workspace/${currentFlowId}/file?path=${encodeURIComponent(f.relativePath)}&download=1`,
              name: f.name,
            })
          }
        }
      } catch { /* non-critical */ }
    }

    if (docs.length > 0) {
      store.setNodes(
        store.nodes.map(n =>
          n.id === node.id ? { ...n, data: { ...n.data, documentUrl: docs[0].url, documentName: docs[0].name, documents: docs } } : n
        )
      )
    }
  }

  // Agent memory
  if (node.type === 'agent' && currentFlowId) {
    const nodeName = getNodeLabel(node, 'Agent')
    const summary = output.slice(0, 200).replace(/\n/g, ' ')
    fetch(`/api/workspace/${currentFlowId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeName, outcome: summary }),
    }).catch(() => {})

    const nodePersonality = node.data?.personality as PersonalityConfig | undefined
    const individualName = node.data?.individualName as string | undefined
    if (individualName) {
      incrementRunCount(individualName).catch(() => {})
    }
    if (nodePersonality?.name) {
      distillExecutionMemory(
        output, (node.data?.systemPrompt as string) || ''
      ).then(result => {
        if (result) {
          appendMemory(
            { flowId: currentFlowId, nodeId: node.id, individualName },
            result,
            nodePersonality.name,
          )
        }
      }).catch(() => {})
    }
  }
}
