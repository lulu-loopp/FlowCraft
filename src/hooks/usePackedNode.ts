import type { Node, Edge } from '@xyflow/react'
import type { TranslationKey } from '@/lib/i18n'

export interface HandleConfigItem {
  id: string
  label: string
  type: 'input' | 'output'
  internalNodeId: string
}

/**
 * Scan selected nodes and build handle config based on internal Input/Output nodes.
 */
export function buildPackHandleConfig(selectedNodes: Node[]): HandleConfigItem[] {
  const config: HandleConfigItem[] = []

  const inputNodes = selectedNodes.filter(n => n.type === 'io')
  const outputNodes = selectedNodes.filter(n => n.type === 'output')

  inputNodes.forEach((n, i) => {
    config.push({
      id: `input-${i}`,
      label: (n.data?.label as string) || `Input ${i + 1}`,
      type: 'input',
      internalNodeId: n.id,
    })
  })

  outputNodes.forEach((n, i) => {
    config.push({
      id: `output-${i}`,
      label: (n.data?.label as string) || `Output ${i + 1}`,
      type: 'output',
      internalNodeId: n.id,
    })
  })

  return config
}

/**
 * Build packed node display data from internal flow.
 */
export function buildPackData(flow: { nodes: Node[]; edges: unknown[] }) {
  const handleConfig = buildPackHandleConfig(flow.nodes)

  const internalNodeNames = flow.nodes
    .filter(n => n.type === 'agent')
    .map(n => (n.data?.label as string) || 'Agent')

  return {
    handleConfig,
    internalNodeNames,
    internalNodeCount: flow.nodes.length,
    internalEdgeCount: flow.edges.length,
  }
}

/**
 * Check if selected nodes have warnings for packing.
 */
export function getPackWarnings(
  selectedNodes: Node[],
  edges: Edge[],
  t: (key: TranslationKey) => string
): string[] {
  const warnings: string[] = []
  const hasInput = selectedNodes.some(n => n.type === 'io')
  const hasOutput = selectedNodes.some(n => n.type === 'output')

  if (!hasInput) warnings.push(t('packed.noInputWarning'))
  if (!hasOutput) warnings.push(t('packed.noOutputWarning'))

  // Check for disconnected nodes (no internal edges connecting them)
  const selectedIds = new Set(selectedNodes.map(n => n.id))
  const internalEdges = edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target))
  const connectedIds = new Set<string>()
  for (const e of internalEdges) { connectedIds.add(e.source); connectedIds.add(e.target) }
  const disconnected = selectedNodes.filter(n => !connectedIds.has(n.id))
  if (disconnected.length > 0) {
    const names = disconnected.map(n => (n.data?.label as string) || n.type || '?').join(', ')
    warnings.push(t('packed.disconnectedWarning').replace('{names}', names))
  }

  return warnings
}
