'use client'

import { useCallback } from 'react'
import { useFlowStore } from '@/store/flowStore'
import {
  topologicalSort,
  detectCycles,
  findLoopEdgeIds,
  computeRunFromNodeSet,
} from '@/lib/flow-executor'
import type { InputFile } from '@/types/flow'
import type { PersonalityConfig } from '@/lib/personality-injector'
import {
  getNodeLabel,
  resetExecutionNodes,
  setInputNodeRunning,
  setInputNodeSuccess,
  setNodeError,
  setNodePartial,
  setNodeSuccess,
} from '@/lib/flow-execution-state'
import type { HandleResult } from '@/lib/packed-executor'
import type { NodeArtifact } from '@/types/flow'
import { executeNodeWork, buildInitialInput, getDefaultProvider } from '@/lib/flow-run-helpers'
import { distillExecutionMemory, appendMemory, incrementRunCount } from '@/lib/memory-updater'
import {
  processConditionResult,
  removeFromCompleted,
  applyNodeResult,
  createScheduler,
  handleRunFinally,
  type ExecutionState,
} from '@/lib/flow-execution-engine'

type InputNodeData = {
  inputFiles?: InputFile[]
  inputText?: string
}

export function useFlowExecution() {
  const { nodes, edges, setIsRunning, addLog, clearLogs, setNodes, addRunRecord } = useFlowStore()

  const runFlow = useCallback(async (userInput?: string) => {
    if (nodes.length === 0) return
    if (useFlowStore.getState().isRunning) return

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

    // Process IO nodes
    const inputNodes = sortedNodes.filter((n) => n.type === 'io')
    const inputNodeIds = new Set(inputNodes.map(n => n.id))
    const inputImagesMap = new Map<string, InputFile[]>()
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

    const initialInput = nodeOutputs.values().next().value ?? userInput ?? 'Start'
    const inputImages = inputImagesMap.values().next().value ?? []

    const runState = { status: 'success' as 'success' | 'error' | 'stopped' }
    const abortController = new AbortController()

    const state: ExecutionState = {
      edges, loopEdgeIds, completedNodeIds, skippedNodeIds,
      nodeOutputs, handleOutputs, handleResultsMap, nodeArtifacts, loopFeedback, addLog,
    }

    async function executeNode(node: import('@xyflow/react').Node): Promise<void> {
      const count = (executionCount.get(node.id) || 0) + 1
      executionCount.set(node.id, count)

      const result = await executeNodeWork({
        node, edges, inputNodeIds, inputImagesMap, initialInput, inputImages,
        nodeOutputs, handleOutputs, nodeArtifacts, completedNodeIds, skippedNodeIds,
        currentFlowId, defaultProvider, addLog, loopEdgeIds, loopFeedback,
        signal: abortController.signal,
      })

      let loopResetTarget: string | null = null
      if (node.type === 'condition') {
        loopResetTarget = processConditionResult(node, result, count, state)
      }

      applyNodeResult(node, result, state)

      if (loopResetTarget) {
        removeFromCompleted(loopResetTarget, node.id, edges, loopEdgeIds, completedNodeIds, skippedNodeIds)
        completedNodeIds.delete(node.id)
      }

      await postExecuteNode(node, result.output, currentFlowId)
    }

    const allNonIo = sortedNodes.filter(n => n.type !== 'io')

    try {
      const { runToCompletion } = createScheduler({
        sortedNodes,
        runnableIds: allNonIo.map(n => n.id),
        candidatePool: allNonIo.map(n => n.id),
        hasCycles,
        state,
        runState,
        abortController,
        executeNode,
      })
      await runToCompletion()
    } finally {
      handleRunFinally(runState, abortController, startedAt, startMs, sortedNodes.length, addRunRecord)
    }
  }, [nodes, edges, setIsRunning, clearLogs, setNodes, addLog, addRunRecord])

  const runFromNode = useCallback(async (startNodeId: string) => {
    const { nodes: freshNodes, edges: freshEdges, flowId: currentFlowId } = useFlowStore.getState()
    if (freshNodes.length === 0) return
    if (useFlowStore.getState().isRunning) return

    setIsRunning(true)

    const startedAt = new Date().toISOString()
    const startMs = Date.now()
    const defaultProvider = await getDefaultProvider()

    if (currentFlowId) {
      fetch(`/api/workspace/${currentFlowId}`, { method: 'POST' }).catch(() => {})
    }

    // Build set of nodes that have cached output
    const nodesWithOutput = new Set<string>()
    for (const n of freshNodes) {
      if (
        n.data?.status === 'success' ||
        (typeof n.data?.currentOutput === 'string' && (n.data.currentOutput as string).trim()) ||
        n.type === 'io'
      ) {
        nodesWithOutput.add(n.id)
      }
    }

    const { nodesToRun, preCompleted, missingUpstream } = computeRunFromNodeSet(startNodeId, freshNodes, freshEdges, nodesWithOutput)

    const startNode = freshNodes.find(n => n.id === startNodeId)
    const startLabel = (startNode?.data?.label as string) || startNodeId
    const cachedCount = preCompleted.size
    const runCount = nodesToRun.size

    clearLogs()

    if (cachedCount > 0) {
      addLog({ nodeName: 'System', nodeType: 'system', type: 'system',
        content: `▶ Run from "${startLabel}": ${runCount} node(s) will run, ${cachedCount} node(s) use cached output.` })
    } else {
      addLog({ nodeName: 'System', nodeType: 'system', type: 'system',
        content: `▶ Run from "${startLabel}": no cached outputs — all ${runCount} node(s) will run.` })
    }
    if (missingUpstream.length > 0) {
      addLog({ nodeName: 'System', nodeType: 'system', type: 'system',
        content: `⚠ Upstream node(s) without output (will receive empty input): ${missingUpstream.join(', ')}` })
    }

    // Reset only nodes that will run
    setNodes(freshNodes.map(n => {
      if (nodesToRun.has(n.id)) {
        return { ...n, data: { ...n.data, status: 'waiting', logs: [], currentOutput: '', currentToken: '' } }
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

    // Process io nodes in nodesToRun
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

    const state: ExecutionState = {
      edges: freshEdges, loopEdgeIds, completedNodeIds, skippedNodeIds,
      nodeOutputs, handleOutputs, handleResultsMap, nodeArtifacts, loopFeedback, addLog,
    }

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
        loopResetTarget = processConditionResult(node, result, count, state)
      }

      applyNodeResult(node, result, state)

      if (loopResetTarget) {
        // Expand scope if loop target is outside current execution scope
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
          useFlowStore.getState().setNodes(
            useFlowStore.getState().nodes.map(n =>
              expandVisited.has(n.id) && n.type !== 'io'
                ? { ...n, data: { ...n.data, status: 'waiting', logs: [], currentOutput: '', currentToken: '' } }
                : n
            )
          )
        }
        removeFromCompleted(loopResetTarget, node.id, freshEdges, loopEdgeIds, completedNodeIds, skippedNodeIds, nodesToRun)
        completedNodeIds.delete(node.id)
      }

      await postExecuteNode(node, result.output, currentFlowId)
    }

    const runnableNonIo = sortedNodes.filter(n => n.type !== 'io' && nodesToRun.has(n.id))

    try {
      const { runToCompletion } = createScheduler({
        sortedNodes,
        runnableIds: runnableNonIo.map(n => n.id),
        candidatePool: nodesToRun,
        hasCycles,
        state,
        runState,
        abortController,
        executeNode,
      })
      await runToCompletion()
    } finally {
      handleRunFinally(runState, abortController, startedAt, startMs, nodesToRun.size, addRunRecord)
    }
  }, [setIsRunning, clearLogs, setNodes, addLog, addRunRecord])

  /**
   * Run a single node only (no downstream).
   * Returns { needsWarning, missingLabels } if upstream has no output — caller should confirm.
   */
  const runSingleNode = useCallback(async (
    nodeId: string,
    opts?: { force?: boolean },
  ): Promise<{ needsWarning: boolean; missingLabels: string[] } | void> => {
    const { nodes: freshNodes, edges: freshEdges, flowId: currentFlowId } = useFlowStore.getState()
    if (freshNodes.length === 0) return
    const currentNode = freshNodes.find(n => n.id === nodeId)
    if (currentNode?.data?.status === 'running') return

    const node = freshNodes.find(n => n.id === nodeId)
    if (!node) return

    const hasCycles = detectCycles(freshNodes, freshEdges)
    const loopEdgeIds = hasCycles ? findLoopEdgeIds(freshEdges) : new Set<string>()

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

    setNodes(freshNodes.map(n => {
      if (n.id === nodeId) {
        return { ...n, data: { ...n.data, status: 'running', logs: [], currentOutput: '', currentToken: '' } }
      }
      return n
    }))

    const inputNodeIds = new Set(freshNodes.filter(n => n.type === 'io').map(n => n.id))
    const inputImagesMap = new Map<string, InputFile[]>()
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

  // Output node: propagate docs from upstream + scan workspace for generated files
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

    if (currentFlowId) {
      try {
        const wsRes = await fetch(`/api/workspace/${currentFlowId}`)
        if (wsRes.ok) {
          const wsData = await wsRes.json()
          const wsFiles = (wsData.files || []) as { name: string; relativePath: string; size: number }[]
          const INTERNAL_PATTERNS = /^(memory\/|progress\.md|features\.json|shared\.md|docs\/)/
          for (const f of wsFiles) {
            if (INTERNAL_PATTERNS.test(f.relativePath)) continue
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
