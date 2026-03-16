'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useFlowStore } from '@/store/flowStore';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

// Module-level history — survives re-renders
const history: Snapshot[] = [];
let cursor = -1;
let ignoreNext = false;

function pushSnapshot(snap: Snapshot) {
  if (ignoreNext) {
    ignoreNext = false;
    return;
  }
  history.splice(cursor + 1);
  history.push({ nodes: snap.nodes, edges: snap.edges });
  if (history.length > MAX_HISTORY) history.shift();
  cursor = history.length - 1;
}

export function useUndoRedo() {
  const prevRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    const unsub = useFlowStore.subscribe((state) => {
      const snap = { nodes: state.nodes, edges: state.edges };
      const prev = prevRef.current;
      // Only push when nodes OR edges reference actually changed
      if (!prev || prev.nodes !== snap.nodes || prev.edges !== snap.edges) {
        prevRef.current = snap;
        pushSnapshot(snap);
      }
    });
    return unsub;
  }, []);

  const undo = useCallback(() => {
    if (cursor <= 0) return;
    cursor -= 1;
    const snap = history[cursor];
    // setNodesAndEdges fires one subscription event → one pushSnapshot call
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
