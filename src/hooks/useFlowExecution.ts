'use client'

import { useCallback } from 'react'
import { useFlowStore } from '@/store/flowStore'
import {
  topologicalSort,
  areUpstreamsCompleteOrSkipped,
  markBranchSkipped,
  detectCycles,
  findLoopEdgeIds,
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
import { executeNodeWork, buildInitialInput, getDefaultProvider } from '@/lib/flow-run-helpers'

type InputNodeData = {
  inputFiles?: InputFile[]
  inputText?: string
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

    const hasCycles = detectCycles(nodes, edges)
    const loopEdgeIds = hasCycles ? findLoopEdgeIds(edges) : new Set<string>()
    const sortedNodes = topologicalSort(nodes, edges)
    const completedNodeIds = new Set<string>()
    const skippedNodeIds = new Set<string>()
    const nodeOutputs = new Map<string, string>()
    const handleOutputs = new Map<string, Record<string, string>>()
    const handleResultsMap = new Map<string, Record<string, HandleResult>>()
    const executionCount = new Map<string, number>()
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

    const runState = { status: 'success' as 'success' | 'error' | 'stopped' }

    // ── Execute a single non-IO node ──
    async function executeNode(node: import('@xyflow/react').Node): Promise<void> {
      const count = (executionCount.get(node.id) || 0) + 1
      executionCount.set(node.id, count)

      const result = await executeNodeWork({
        node, edges, inputNode, initialInput, inputImages,
        nodeOutputs, handleOutputs, completedNodeIds, skippedNodeIds,
        currentFlowId, defaultProvider, addLog, loopEdgeIds,
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
            // Defer removeFromCompleted until after completedNodeIds.add(node.id)
            loopResetTarget = falseBackEdge.target
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
        if (runState.status === 'error') return
        if (!useFlowStore.getState().isRunning) { runState.status = 'stopped'; return }

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
              runState.status = 'error'
              setNodeError(nid)
              addLog({
                nodeName: getNodeLabel(node),
                nodeType: node.type || 'unknown', type: 'system',
                content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
              })
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
      if (stoppedByUser) runState.status = 'stopped'

      useFlowStore.getState().setIsRunning(false)

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

  return { runFlow }
}

// ── Post-execution side effects (docs, memory) ──
async function postExecuteNode(
  node: import('@xyflow/react').Node,
  output: string,
  currentFlowId: string,
) {
  const edges = useFlowStore.getState().edges

  // Auto-save document
  const DOC_KEYWORDS = /writ|文档|写手|report|报告|draft|撰写|手册|guide|manual/i
  const agentLabel = getNodeLabel(node, 'Agent')
  const agentPrompt = (node.data?.systemPrompt as string) || ''
  const isDocNode = DOC_KEYWORDS.test(agentLabel) || DOC_KEYWORDS.test(agentPrompt)
  if (node.type === 'agent' && currentFlowId && output.length > 500 && isDocNode) {
    const filename = `${agentLabel.replace(/\s+/g, '-')}-${Date.now()}.md`
    try {
      const docRes = await fetch(`/api/workspace/${currentFlowId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: output }),
      })
      if (docRes.ok) {
        const docData = await docRes.json()
        const store = useFlowStore.getState()
        store.setNodes(
          store.nodes.map(n =>
            n.id === node.id ? { ...n, data: { ...n.data, documentUrl: docData.downloadUrl, documentName: docData.filename } } : n
          )
        )
      }
    } catch { /* non-critical */ }
  }

  // Output node: propagate docs
  if (node.type === 'output') {
    const upstreamIds = edges.filter(e => e.target === node.id).map(e => e.source)
    const store = useFlowStore.getState()
    const docs: { url: string; name: string }[] = []
    for (const uid of upstreamIds) {
      const upNode = store.nodes.find(n => n.id === uid)
      if (upNode?.data?.documentUrl) {
        docs.push({ url: upNode.data.documentUrl as string, name: upNode.data.documentName as string })
      }
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
