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

  // Auto-save: 2s debounce after nodes/edges change
  useEffect(() => {
    if (!flowId) return;
    const unsub = useFlowStore.subscribe((state, prev) => {
      if (state.isRunning) return; // skip during execution
      if (state.nodes !== prev.nodes || state.edges !== prev.edges || state.flowName !== prev.flowName) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => saveFlow(), 2000);
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
      const res = await fetch(`/api/flows/${flowId}`);
      if (!res.ok) return;
      const flow: FlowData = await res.json();
      const store = useFlowStore.getState();
      store.setNodes(flow.nodes || []);
      store.setEdges(flow.edges || []);
      store.setFlowName(flow.name || 'Untitled Flow');
      store.setFlowId(flowId);
    } catch {
      // fail silently — canvas still usable
    }
  }, [flowId]);

  return { saveFlow, loadFlow, saveStatus };
}
