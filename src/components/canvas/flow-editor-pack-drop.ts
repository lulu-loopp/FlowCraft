import type { Node } from '@xyflow/react'
import { useFlowStore } from '@/store/flowStore'
import { buildPackData } from '@/hooks/usePackedNode'

/**
 * Handle dropping a pack from the left panel onto the canvas.
 */
export function handleDropPack(
  packName: string,
  position: { x: number; y: number },
  addNode: (node: Node) => void,
) {
  const nodeId = `packed-${Date.now()}`
  const data: Record<string, unknown> = { label: packName, packName, isSharedPack: true }
  const newNode: Node = { id: nodeId, type: 'packed', position, data, selected: false }
  addNode(newNode)

  // Async load pack data to populate handles
  fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
    .then(r => r.ok ? r.json() : null)
    .then(packData => {
      if (!packData?.flow) return
      const { handleConfig, internalNodeNames, internalNodeCount, internalEdgeCount } = buildPackData(packData.flow)
      const store = useFlowStore.getState()
      store.setNodes(store.nodes.map(n => n.id === nodeId ? {
        ...n,
        data: {
          ...n.data,
          handleConfig,
          internalNodeNames,
          internalNodeCount,
          internalEdgeCount,
          packVersion: packData.flow.version || Date.now(),
        },
      } : n))
    })
    .catch(() => {})
}
