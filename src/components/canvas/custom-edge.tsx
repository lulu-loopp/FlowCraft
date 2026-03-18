import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { useFlowStore } from '@/store/flowStore';
import { isLoopEdge as checkLoopEdge } from '@/lib/flow-executor';

/**
 * BFS forward from `targetId` along edges to collect all node IDs
 * in the loop body (up to and including `sourceId`).
 */
function collectLoopBodyIds(targetId: string, sourceId: string, edges: Edge[]): Set<string> {
  const ids = new Set<string>()
  const queue = [targetId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (ids.has(cur)) continue
    ids.add(cur)
    if (cur === sourceId) continue // don't traverse past the loop source
    for (const e of edges) {
      if (e.source === cur) queue.push(e.target)
    }
  }
  return ids
}

/**
 * Build a path for a loop back-edge that routes below the loop body nodes.
 * Only considers nodes that belong to this loop, so parallel paths are unaffected.
 * Path: source(right) → stub right → down → left (below) → up → stub left → target(left)
 */
function getLoopEdgePath(
  sx: number, sy: number, tx: number, ty: number,
  loopNodes: Node[],
): [string, number, number] {
  const gap = 40    // vertical gap below tallest node
  const stub = 24   // horizontal stub length at handles
  const r = 16      // corner radius

  // Only consider nodes that are part of this loop body
  let maxBottom = Math.max(sy, ty)
  for (const n of loopNodes) {
    const nh = (n.measured?.height ?? 200)
    const nodeBottom = (n.position?.y ?? 0) + nh
    if (nodeBottom > maxBottom) maxBottom = nodeBottom
  }

  const bottomY = maxBottom + gap
  // Source exits to the right, then goes down
  const rx = sx + stub  // right exit point
  const lx = tx - stub  // left entry point

  const path = [
    `M ${sx},${sy}`,
    // Horizontal stub right from source handle
    `L ${rx - r},${sy}`,
    // Turn down
    `Q ${rx},${sy} ${rx},${sy + r}`,
    // Vertical down
    `L ${rx},${bottomY - r}`,
    // Turn left
    `Q ${rx},${bottomY} ${rx - r},${bottomY}`,
    // Horizontal across bottom
    `L ${lx + r},${bottomY}`,
    // Turn up
    `Q ${lx},${bottomY} ${lx},${bottomY - r}`,
    // Vertical up
    `L ${lx},${ty + r}`,
    // Turn right toward target
    `Q ${lx},${ty} ${lx + r},${ty}`,
    // Horizontal stub into target handle
    `L ${tx},${ty}`,
  ].join(' ')

  const labelX = (rx + lx) / 2
  const labelY = bottomY
  return [path, labelX, labelY]
}

export function CustomEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);

  // Detect loop back-edge
  const thisEdge = edges.find(e => e.id === id);
  const isLoop = thisEdge ? checkLoopEdge(thisEdge, edges) : false;

  const [edgePath, labelX, labelY] = React.useMemo(() => {
    if (!isLoop) return getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
    // Only consider nodes belonging to this loop body (target → source in forward direction)
    const bodyIds = collectLoopBodyIds(target, source, edges);
    const loopNodes = nodes.filter(n => bodyIds.has(n.id));
    return getLoopEdgePath(sourceX, sourceY, targetX, targetY, loopNodes);
  }, [isLoop, source, target, edges, nodes, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    useFlowStore.getState().setEdges(
      useFlowStore.getState().edges.filter(e => e.id !== id)
    );
  };

  const isRunning = data?.status === 'running';
  const isError = data?.status === 'error';

  let edgeColor = '#94a3b8';
  if (isLoop) edgeColor = '#f97316';
  if (isRunning) edgeColor = isLoop ? '#f97316' : '#0d9488';
  if (isError) edgeColor = '#f43f5e';
  if (selected) edgeColor = isLoop ? '#ea580c' : '#0d9488';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={isRunning ? 'running-edge-path' : ''}
        style={{
          ...style,
          strokeWidth: isRunning || selected ? 3 : 2,
          stroke: edgeColor,
          strokeDasharray: isLoop ? '8 5' : isRunning ? '6 4' : undefined,
          filter: selected ? `drop-shadow(0 0 6px ${isLoop ? 'rgba(249,115,22,0.5)' : 'rgba(13,148,136,0.5)'})` : undefined,
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
      />

      {selected && (
        <foreignObject
          width={32}
          height={32}
          x={labelX - 16}
          y={labelY - 16}
          className="pointer-events-auto"
        >
          <div className="edge-delete-btn flex items-center justify-center w-8 h-8">
            <button
              className="flex items-center justify-center w-7 h-7 bg-white border-2 border-slate-200 rounded-full text-slate-400 hover:text-rose-500 hover:border-rose-300 hover:shadow-md transition-colors active:scale-90 cursor-pointer shadow-lg"
              onClick={onEdgeClick}
              title="Delete Edge"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </foreignObject>
      )}
    </>
  );
}
