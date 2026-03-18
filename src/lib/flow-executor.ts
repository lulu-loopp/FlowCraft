import type { Node, Edge } from '@xyflow/react'

// 找到 flow 的起点（没有入边的节点）
export function findStartNodes(nodes: Node[], edges: Edge[]): Node[] {
  const targetIds = new Set(edges.map(e => e.target))
  return nodes.filter(n => !targetIds.has(n.id))
}

// 拓扑排序，返回执行顺序（跳过环中的回边）
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
// loopEdgeIds: edges to ignore when checking (back-edges in a loop)
export function areUpstreamsCompleteOrSkipped(
  nodeId: string,
  edges: Edge[],
  completedIds: Set<string>,
  skippedIds: Set<string>,
  loopEdgeIds?: Set<string>,
): boolean {
  const upstreams = edges
    .filter(e => e.target === nodeId && !(loopEdgeIds && loopEdgeIds.has(e.id)))
    .map(e => e.source)
  return upstreams.every(id => completedIds.has(id) || skippedIds.has(id))
}

// 将条件节点未激活分支的所有下游节点标记为已跳过
// loopEdgeIds: back-edges to exclude from skip propagation
export function markBranchSkipped(
  conditionNodeId: string,
  inactiveHandle: string,
  edges: Edge[],
  completedIds: Set<string>,
  skippedIds: Set<string>,
  loopEdgeIds?: Set<string>,
): void {
  const isBlockedEdge = (e: Edge) =>
    e.source === conditionNodeId && e.sourceHandle === inactiveHandle

  let changed = true
  while (changed) {
    changed = false
    const candidates = new Set<string>()
    edges
      .filter(e => e.source === conditionNodeId && e.sourceHandle === inactiveHandle)
      // Skip loop back-edges — they point to upstream nodes that should NOT be skipped
      .filter(e => !(loopEdgeIds && loopEdgeIds.has(e.id)))
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

// ── Cycle / loop utilities ──

/** Detect whether the graph contains any cycles */
export function detectCycles(nodes: Node[], edges: Edge[]): boolean {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  nodes.forEach(n => color.set(n.id, WHITE))

  const adj = new Map<string, string[]>()
  nodes.forEach(n => adj.set(n.id, []))
  edges.forEach(e => adj.get(e.source)?.push(e.target))

  function dfs(id: string): boolean {
    color.set(id, GRAY)
    for (const next of adj.get(id) || []) {
      const c = color.get(next)
      if (c === GRAY) return true  // back edge → cycle
      if (c === WHITE && dfs(next)) return true
    }
    color.set(id, BLACK)
    return false
  }

  for (const n of nodes) {
    if (color.get(n.id) === WHITE && dfs(n.id)) return true
  }
  return false
}

/**
 * Find all loop back-edge IDs using DFS.
 * A back-edge is an edge whose target is on the current DFS path (GRAY node).
 * This correctly distinguishes forward/cross edges from true back-edges.
 */
export function findLoopEdgeIds(edges: Edge[]): Set<string> {
  const nodeIds = new Set<string>()
  edges.forEach(e => { nodeIds.add(e.source); nodeIds.add(e.target) })

  const adj = new Map<string, Edge[]>()
  nodeIds.forEach(id => adj.set(id, []))
  edges.forEach(e => adj.get(e.source)?.push(e))

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  nodeIds.forEach(id => color.set(id, WHITE))
  const backEdges = new Set<string>()

  function dfs(id: string) {
    color.set(id, GRAY)
    for (const edge of adj.get(id) || []) {
      const tc = color.get(edge.target)
      if (tc === GRAY) {
        backEdges.add(edge.id) // target is on current path → back-edge
      } else if (tc === WHITE) {
        dfs(edge.target)
      }
    }
    color.set(id, BLACK)
  }

  for (const id of nodeIds) {
    if (color.get(id) === WHITE) dfs(id)
  }
  return backEdges
}

/** Check if a specific edge is a loop back-edge */
export function isLoopEdge(edge: Edge, edges: Edge[]): boolean {
  return findLoopEdgeIds(edges).has(edge.id)
}

/**
 * Get the nodes on a loop path: from the condition's false-handle back-edge target
 * up to (and including) the condition node itself.
 */
export function getLoopNodeIds(
  conditionNodeId: string,
  falseHandle: string,
  edges: Edge[],
): Set<string> {
  const loopTarget = edges.find(
    e => e.source === conditionNodeId && e.sourceHandle === falseHandle && isLoopEdge(e, edges)
  )
  if (!loopTarget) return new Set()

  // BFS forward from loopTarget.target until we reach conditionNodeId
  const loopNodes = new Set<string>()
  const queue = [loopTarget.target]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (loopNodes.has(current)) continue
    loopNodes.add(current)
    if (current === conditionNodeId) continue
    for (const e of edges) {
      if (e.source === current) queue.push(e.target)
    }
  }
  return loopNodes
}

export const DEFAULT_MAX_LOOP_ITERATIONS = 10
