/**
 * Pack-related actions for flowStore (view stack, unpack, version update).
 * These are injected into the store via the store creator.
 */
import type { Node, Edge } from '@xyflow/react'
import { refreshIndividualNodes } from '@/hooks/useLoadIndividual'

export type ViewStackEntry = {
  nodeId: string
  label: string
  parentNodes: Node[]
  parentEdges: Edge[]
}

type StoreGet = () => {
  nodes: Node[]; edges: Edge[]; viewStack: ViewStackEntry[]
}
type StoreSet = (partial: Partial<{
  nodes: Node[]; edges: Edge[]; viewStack: ViewStackEntry[]; selectedNodeId: string | null
}>) => void

export function createPushViewStack(get: StoreGet, set: StoreSet) {
  return (nodeId: string, label: string) => {
    const { nodes, edges, viewStack } = get()
    const packedNode = nodes.find(n => n.id === nodeId)
    if (!packedNode || packedNode.type !== 'packed') return
    const packName = (packedNode.data?.packName as string) || ''
    const inlineFlow = packedNode.data?.inlineFlow as { nodes: Node[]; edges: Edge[] } | undefined
    if (!packName && !inlineFlow) return
    const internalResults = (packedNode.data?._internalResults || null) as Record<string, { status: string; currentOutput: string }> | null
    set({ viewStack: [...viewStack, { nodeId, label, parentNodes: nodes, parentEdges: edges }] })

    const applyFlow = async (flowData: { nodes: Node[]; edges: Edge[] }) => {
      let flowNodes = await refreshIndividualNodes(flowData.nodes)
      if (internalResults) {
        flowNodes = flowNodes.map(n => {
          const r = internalResults[n.id]
          return r ? { ...n, data: { ...n.data, status: r.status, currentOutput: r.currentOutput } } : n
        })
      }
      set({ nodes: flowNodes, edges: flowData.edges, selectedNodeId: null })
    }

    if (inlineFlow) {
      // Independent copy: use inline flow directly
      applyFlow(inlineFlow)
    } else {
      // Shared: fetch from API
      fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.flow?.nodes) return
          applyFlow({ nodes: data.flow.nodes as Node[], edges: (data.flow.edges || []) as Edge[] })
        })
        .catch(() => {})
    }
  }
}

export function createPopViewStack(get: StoreGet, set: StoreSet) {
  return () => {
    const { viewStack, nodes: currentInternalNodes, edges: currentInternalEdges } = get()
    if (viewStack.length === 0) return
    const last = viewStack[viewStack.length - 1]

    // Save internal changes back to the pack definition before restoring parent
    const packedNode = last.parentNodes.find(n => n.id === last.nodeId)
    if (packedNode?.type === 'packed') {
      const packName = (packedNode.data?.packName as string) || ''
      const inlineFlow = packedNode.data?.inlineFlow as { nodes: Node[]; edges: Edge[] } | undefined

      if (packName) {
        // Shared pack: save back to API
        fetch(`/api/agents/packs/${encodeURIComponent(packName)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flow: { nodes: currentInternalNodes, edges: currentInternalEdges } }),
        }).catch(() => {})
      } else if (inlineFlow) {
        // Independent copy: update the inlineFlow in parent node data
        const updatedParentNodes = last.parentNodes.map(n =>
          n.id === last.nodeId
            ? { ...n, data: { ...n.data, inlineFlow: { nodes: currentInternalNodes, edges: currentInternalEdges } } }
            : n
        )
        set({ nodes: updatedParentNodes, edges: last.parentEdges, viewStack: viewStack.slice(0, -1), selectedNodeId: null })
        return
      }
    }

    set({ nodes: last.parentNodes, edges: last.parentEdges, viewStack: viewStack.slice(0, -1), selectedNodeId: null })
  }
}

export function createPopToViewStackIndex(get: StoreGet, set: StoreSet) {
  return (index: number) => {
    const { viewStack, nodes: currentInternalNodes, edges: currentInternalEdges } = get()

    // Save current internal changes back to the innermost pack before popping
    if (viewStack.length > 0) {
      const innermost = viewStack[viewStack.length - 1]
      const packedNode = innermost.parentNodes.find(n => n.id === innermost.nodeId)
      if (packedNode?.type === 'packed') {
        const packName = (packedNode.data?.packName as string) || ''
        if (packName) {
          fetch(`/api/agents/packs/${encodeURIComponent(packName)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flow: { nodes: currentInternalNodes, edges: currentInternalEdges } }),
          }).catch(() => {})
        }
      }
    }

    if (index <= 0) {
      const first = viewStack[0]
      if (!first) return
      set({ nodes: first.parentNodes, edges: first.parentEdges, viewStack: [], selectedNodeId: null })
    } else if (index < viewStack.length) {
      const target = viewStack[index]
      set({ nodes: target.parentNodes, edges: target.parentEdges, viewStack: viewStack.slice(0, index), selectedNodeId: null })
    }
  }
}

export function createUnpackNode(get: StoreGet, set: StoreSet) {
  return (nodeId: string) => {
    const { nodes } = get()
    const packedNode = nodes.find(n => n.id === nodeId)
    if (!packedNode || packedNode.type !== 'packed') return
    const packName = (packedNode.data?.packName as string) || ''
    if (!packName) return
    fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.flow?.nodes) return
        const { nodes: currentNodes, edges: currentEdges } = get()
        const pNode = currentNodes.find(n => n.id === nodeId)
        if (!pNode) return
        const handleConfig = (pNode.data?.handleConfig as Array<{ id: string; type: string; internalNodeId: string }>) || []
        const rawNodes = data.flow.nodes as Node[]
        // Calculate centroid of internal nodes to offset them relative to packed node position
        const cx = rawNodes.reduce((s, n) => s + n.position.x, 0) / rawNodes.length
        const cy = rawNodes.reduce((s, n) => s + n.position.y, 0) / rawNodes.length
        const internalNodes = rawNodes.map(n => ({
          ...n, position: { x: n.position.x - cx + pNode.position.x, y: n.position.y - cy + pNode.position.y },
        }))
        const internalEdges = (data.flow.edges || []) as Edge[]
        const rerouted = currentEdges
          .filter(e => e.source !== nodeId || e.target !== nodeId)
          .map(e => {
            if (e.target === nodeId) {
              const m = handleConfig.find(h => h.id === e.targetHandle && h.type === 'input')
              if (m) return { ...e, target: m.internalNodeId, targetHandle: null }
              const first = internalNodes.find(n => n.type === 'io')
              if (first) return { ...e, target: first.id, targetHandle: null }
            }
            if (e.source === nodeId) {
              const m = handleConfig.find(h => h.id === e.sourceHandle && h.type === 'output')
              if (m) return { ...e, source: m.internalNodeId, sourceHandle: null }
              const first = internalNodes.find(n => n.type === 'output')
              if (first) return { ...e, source: first.id, sourceHandle: null }
            }
            return e
          })
          .filter(e => e.source !== nodeId && e.target !== nodeId)
        set({ nodes: [...currentNodes.filter(n => n.id !== nodeId), ...internalNodes], edges: [...rerouted, ...internalEdges], selectedNodeId: null })
      })
      .catch(() => {})
  }
}

/**
 * Detach an individual agent node inside a pack, making it a regular agent.
 * Removes individualName and isReference, so it becomes a plain agent node.
 */
export function createDetachIndividualInPack(get: StoreGet, set: StoreSet) {
  return (nodeId: string) => {
    set({
      nodes: get().nodes.map(n =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                individualName: undefined,
                isReference: false,
              },
            }
          : n
      ),
    })
  }
}

/**
 * Detach a packed node from its shared definition, creating an independent copy.
 * Fetches the internal flow and inlines it into the node's data.
 * Removes packName and Layers icon indicator.
 */
export function createDetachPackedNode(get: StoreGet, set: StoreSet) {
  return async (nodeId: string) => {
    const { nodes } = get()
    const packedNode = nodes.find(n => n.id === nodeId)
    if (!packedNode || packedNode.type !== 'packed') return
    const packName = (packedNode.data?.packName as string) || ''
    if (!packName) return

    try {
      const res = await fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
      if (!res.ok) return
      const data = await res.json()
      if (!data?.flow) return

      set({
        nodes: get().nodes.map(n =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  packName: '',
                  isReference: false,
                  hasPackUpdate: false,
                  inlineFlow: data.flow,
                },
              }
            : n
        ),
      })
    } catch { /* silent */ }
  }
}

export function createUpdatePackVersion(get: StoreGet, set: StoreSet) {
  return (nodeId: string) => {
    const { nodes } = get()
    const packedNode = nodes.find(n => n.id === nodeId)
    if (!packedNode || packedNode.type !== 'packed') return
    const packName = (packedNode.data?.packName as string) || ''
    if (!packName) return
    fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.flow) return
        const version = data.flow.version || Date.now()
        const internalNodes = (data.flow.nodes || []) as Node[]
        const inputNodes = internalNodes.filter(n => n.type === 'io')
        const outputNodes = internalNodes.filter(n => n.type === 'output')
        const handleConfig = [
          ...inputNodes.map((n, i) => ({ id: `input-${i}`, label: (n.data?.label as string) || `Input ${i + 1}`, type: 'input' as const, internalNodeId: n.id })),
          ...outputNodes.map((n, i) => ({ id: `output-${i}`, label: (n.data?.label as string) || `Output ${i + 1}`, type: 'output' as const, internalNodeId: n.id })),
        ]
        const internalNodeNames = internalNodes.filter(n => n.type === 'agent').map(n => (n.data?.label as string) || 'Agent')
        set({
          nodes: get().nodes.map(n => n.id === nodeId ? {
            ...n, data: { ...n.data, packVersion: version, hasPackUpdate: false, handleConfig, internalNodeNames,
              internalNodeCount: internalNodes.length, internalEdgeCount: (data.flow.edges || []).length }
          } : n)
        })
      })
      .catch(() => {})
  }
}
