'use client';
import { useEffect, useCallback } from 'react';
import { useFlowStore } from '@/store/flowStore';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

interface FlowHistoryState {
  history: Snapshot[];
  cursor: number;
  ignoreNext: boolean;
  isDragging: boolean;
}

const MAX_HISTORY = 50;
const DEFAULT_FLOW_KEY = '__default_flow__';
const historyByFlow = new Map<string, FlowHistoryState>();

function getFlowKey(): string {
  return useFlowStore.getState().flowId || DEFAULT_FLOW_KEY;
}

function getFlowHistoryState(flowKey = getFlowKey()): FlowHistoryState {
  const existing = historyByFlow.get(flowKey);
  if (existing) return existing;
  const created: FlowHistoryState = {
    history: [],
    cursor: -1,
    ignoreNext: false,
    isDragging: false,
  };
  historyByFlow.set(flowKey, created);
  return created;
}

function cloneSnapshot(snap: Snapshot): Snapshot {
  return {
    nodes: [...snap.nodes],
    edges: [...snap.edges],
  };
}

function pushSnapshot(snap: Snapshot, flowKey = getFlowKey()) {
  const state = getFlowHistoryState(flowKey);
  state.history.splice(state.cursor + 1);
  state.history.push(cloneSnapshot(snap));
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.cursor = state.history.length - 1;
}

function resetHistory(flowKey: string) {
  const state = getFlowHistoryState(flowKey);
  state.history = [];
  state.cursor = -1;
  state.ignoreNext = false;
  state.isDragging = false;
  const { nodes, edges } = useFlowStore.getState();
  pushSnapshot({ nodes, edges }, flowKey);
}

/** Call on ReactFlow onNodeDragStart */
export function startDrag() {
  const state = getFlowHistoryState();
  state.isDragging = true;
}

/** Call on ReactFlow onNodeDragStop - pushes final drag position to history */
export function stopDrag() {
  const flowKey = getFlowKey();
  const state = getFlowHistoryState(flowKey);
  state.isDragging = false;
  const { nodes, edges } = useFlowStore.getState();
  pushSnapshot({ nodes, edges }, flowKey);
}

export function useUndoRedo() {
  const flowId = useFlowStore((s) => s.flowId);

  useEffect(() => {
    resetHistory(flowId || DEFAULT_FLOW_KEY);
  }, [flowId]);

  useEffect(() => {
    const unsub = useFlowStore.subscribe((state, prev) => {
      if (state.nodes === prev.nodes && state.edges === prev.edges) return;

      const flowKey = getFlowKey();
      const historyState = getFlowHistoryState(flowKey);
      if (historyState.isDragging) return;
      if (historyState.ignoreNext) {
        historyState.ignoreNext = false;
        return;
      }

      if (
        state.nodes.length !== prev.nodes.length ||
        state.edges.length !== prev.edges.length
      ) {
        pushSnapshot({ nodes: state.nodes, edges: state.edges }, flowKey);
      }
    });
    return unsub;
  }, []);

  const undo = useCallback(() => {
    const flowKey = getFlowKey();
    const state = getFlowHistoryState(flowKey);
    if (state.cursor <= 0) return;
    state.cursor -= 1;
    const snap = state.history[state.cursor];
    state.ignoreNext = true;
    useFlowStore.getState().setNodesAndEdges([...snap.nodes], [...snap.edges]);
  }, []);

  const redo = useCallback(() => {
    const flowKey = getFlowKey();
    const state = getFlowHistoryState(flowKey);
    if (state.cursor >= state.history.length - 1) return;
    state.cursor += 1;
    const snap = state.history[state.cursor];
    state.ignoreNext = true;
    useFlowStore.getState().setNodesAndEdges([...snap.nodes], [...snap.edges]);
  }, []);

  return { undo, redo };
}

