import type { Node, Edge } from '@xyflow/react'

// 找到 flow 的起点（没有入边的节点）
export function findStartNodes(nodes: Node[], edges: Edge[]): Node[] {
  const targetIds = new Set(edges.map(e => e.target))
  return nodes.filter(n => !targetIds.has(n.id))
}

// 拓扑排序，返回执行顺序
export function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
  const result: Node[] = []
  const visited = new Set<string>()
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const incomingEdges = edges.filter(e => e.target === nodeId)
    for (const edge of incomingEdges) {
      visit(edge.source)
    }
    const node = nodeMap.get(nodeId)
    if (node) result.push(node)
  }

  for (const node of nodes) {
    visit(node.id)
  }

  return result
}

// 获取节点的所有下游节点
export function getDownstreamNodes(
  nodeId: string,
  edges: Edge[],
  nodeMap: Map<string, Node>
): Node[] {
  return edges
    .filter(e => e.source === nodeId)
    .map(e => nodeMap.get(e.target))
    .filter(Boolean) as Node[]
}

// 判断节点的所有上游是否都已完成
export function areUpstreamsComplete(
  nodeId: string,
  edges: Edge[],
  completedNodeIds: Set<string>
): boolean {
  const upstreams = edges
    .filter(e => e.target === nodeId)
    .map(e => e.source)
  return upstreams.every(id => completedNodeIds.has(id))
}

// 判断节点的所有上游是否都已完成或被跳过
export function areUpstreamsCompleteOrSkipped(
  nodeId: string,
  edges: Edge[],
  completedIds: Set<string>,
  skippedIds: Set<string>,
): boolean {
  const upstreams = edges.filter(e => e.target === nodeId).map(e => e.source)
  return upstreams.every(id => completedIds.has(id) || skippedIds.has(id))
}

// 将条件节点未激活分支的所有下游节点标记为已跳过
export function markBranchSkipped(
  conditionNodeId: string,
  inactiveHandle: string,
  edges: Edge[],
  completedIds: Set<string>,
  skippedIds: Set<string>,
): void {
  const isBlockedEdge = (e: Edge) =>
    e.source === conditionNodeId && e.sourceHandle === inactiveHandle

  let changed = true
  while (changed) {
    changed = false
    // Collect candidate nodes: direct targets of inactive handle + downstream of already-skipped
    const candidates = new Set<string>()
    edges
      .filter(e => e.source === conditionNodeId && e.sourceHandle === inactiveHandle)
      .forEach(e => candidates.add(e.target))
    skippedIds.forEach(sid => {
      edges.filter(e => e.source === sid).forEach(e => candidates.add(e.target))
    })

    for (const nodeId of candidates) {
      if (skippedIds.has(nodeId)) continue
      const incoming = edges.filter(e => e.target === nodeId)
      if (incoming.length === 0) continue
      const allBlocked = incoming.every(
        e => isBlockedEdge(e) || skippedIds.has(e.source)
      )
      if (allBlocked) {
        skippedIds.add(nodeId)
        changed = true
      }
    }
  }
}
