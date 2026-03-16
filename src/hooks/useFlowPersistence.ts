'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlowStore } from '@/store/flowStore';
import type { FlowData } from '@/types/flow';

export type SaveStatus = 'idle' | 'saving' | 'saved';

export function useFlowPersistence(flowId: string) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveFlow = useCallback(async (): Promise<boolean> => {
    if (!flowId) return false;
    setSaveStatus('saving');
    try {
      const { nodes, edges, flowName } = useFlowStore.getState();
      const res = await fetch(`/api/flows/${flowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: flowName || 'Untitled Flow', nodes, edges }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('idle');
      }
      return res.ok;
    } catch {
      setSaveStatus('idle');
      return false;
    }
  }, [flowId]);

  // Auto-save: immediate for structural changes, 800ms debounce for data changes.
  // Drag-end saves are triggered externally via saveFlow() from onNodeDragStop.
  useEffect(() => {
    if (!flowId) return;
    const unsub = useFlowStore.subscribe((state, prev) => {
      if (state.isRunning) return;
      if (state.nodes === prev.nodes && state.edges === prev.edges && state.flowName === prev.flowName) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      // Structural change (node/edge added or removed, name changed): save immediately
      if (
        state.nodes.length !== prev.nodes.length ||
        state.edges.length !== prev.edges.length ||
        state.flowName !== prev.flowName
      ) {
        saveFlow();
      } else {
        // Data or position change: short debounce so typing feels responsive
        timerRef.current = setTimeout(() => saveFlow(), 800);
      }
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flowId, saveFlow]);

  const loadFlow = useCallback(async () => {
    if (!flowId) return;
    try {
      const [flowRes, runsRes] = await Promise.all([
        fetch(`/api/flows/${flowId}`),
        fetch(`/api/flows/${flowId}/runs`),
      ]);
      if (!flowRes.ok) return;
      const flow: FlowData = await flowRes.json();
      const store = useFlowStore.getState();
      // Single batch update → one Zustand event → one history snapshot
      store.setNodesAndEdges(flow.nodes || [], flow.edges || []);
      store.setFlowName(flow.name || 'Untitled Flow');
      store.setFlowId(flowId);
      if (runsRes.ok) {
        const runs = await runsRes.json();
        store.setRunHistory(Array.isArray(runs) ? runs : []);
      }
    } catch {
      // fail silently — canvas still usable
    }
  }, [flowId]);

  return { saveFlow, loadFlow, saveStatus };
}
