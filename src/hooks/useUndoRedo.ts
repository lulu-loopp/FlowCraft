'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useFlowStore } from '@/store/flowStore';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

// History lives outside React so it isn't reset on re-renders
const history: Snapshot[] = [];
let cursor = -1;
let ignoreNext = false; // flag to suppress push when we're restoring

function pushSnapshot(snap: Snapshot) {
  if (ignoreNext) {
    ignoreNext = false;
    return;
  }
  // Discard any future history if we branched
  history.splice(cursor + 1);
  history.push({ nodes: [...snap.nodes], edges: [...snap.edges] });
  if (history.length > MAX_HISTORY) history.shift();
  cursor = history.length - 1;
}

export function useUndoRedo() {
  // Track previous values to detect real changes
  const prevRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    const unsub = useFlowStore.subscribe((state) => {
      const snap = { nodes: state.nodes, edges: state.edges };
      const prev = prevRef.current;
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
    ignoreNext = true;
    useFlowStore.getState().setNodes([...snap.nodes]);
    useFlowStore.getState().setEdges([...snap.edges]);
  }, []);

  const redo = useCallback(() => {
    if (cursor >= history.length - 1) return;
    cursor += 1;
    const snap = history[cursor];
    ignoreNext = true;
    useFlowStore.getState().setNodes([...snap.nodes]);
    useFlowStore.getState().setEdges([...snap.edges]);
  }, []);

  const canUndo = cursor > 0;
  const canRedo = cursor < history.length - 1;

  return { undo, redo, canUndo, canRedo };
}
