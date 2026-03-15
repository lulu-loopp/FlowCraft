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
