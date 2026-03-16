'use client';
import { useEffect, useCallback } from 'react';
import { useFlowStore } from '@/store/flowStore';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

// Module-level state — survives re-renders
const history: Snapshot[] = [];
let cursor = -1;
let ignoreNext = false;
let isDragging = false;

function pushSnapshot(snap: Snapshot) {
  history.splice(cursor + 1);
  history.push({ nodes: snap.nodes, edges: snap.edges });
  if (history.length > MAX_HISTORY) history.shift();
  cursor = history.length - 1;
}

/** Call on ReactFlow onNodeDragStart */
export function startDrag() {
  isDragging = true;
}

/** Call on ReactFlow onNodeDragStop — pushes final drag position to history */
export function stopDrag() {
  isDragging = false;
  const { nodes, edges } = useFlowStore.getState();
  pushSnapshot({ nodes, edges });
}

export function useUndoRedo() {
  useEffect(() => {
    // Subscribe to store changes. Zustand passes (state, prevState).
    // Only push snapshots for structural changes (node/edge count).
    // Position changes during drag are handled by stopDrag().
    // Data changes (typing) are intentionally not tracked.
    const unsub = useFlowStore.subscribe((state, prev) => {
      if (state.nodes === prev.nodes && state.edges === prev.edges) return;
      if (isDragging) return; // position frames during drag: skip
      if (ignoreNext) { ignoreNext = false; return; } // undo/redo restoration

      if (
        state.nodes.length !== prev.nodes.length ||
        state.edges.length !== prev.edges.length
      ) {
        pushSnapshot({ nodes: state.nodes, edges: state.edges });
      }
    });
    return unsub;
  }, []);

  const undo = useCallback(() => {
    if (cursor <= 0) return;
    cursor -= 1;
    const snap = history[cursor];
    ignoreNext = true;
    useFlowStore.getState().setNodesAndEdges([...snap.nodes], [...snap.edges]);
  }, []);

  const redo = useCallback(() => {
    if (cursor >= history.length - 1) return;
    cursor += 1;
    const snap = history[cursor];
    ignoreNext = true;
    useFlowStore.getState().setNodesAndEdges([...snap.nodes], [...snap.edges]);
  }, []);

  return { undo, redo };
}
