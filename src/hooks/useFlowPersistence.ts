'use client';
import { useCallback } from 'react';
import { useFlowStore } from '@/store/flowStore';
import type { FlowData } from '@/types/flow';

export function useFlowPersistence(flowId: string) {
  const saveFlow = useCallback(async (): Promise<boolean> => {
    const { nodes, edges, flowName } = useFlowStore.getState();
    try {
      const res = await fetch(`/api/flows/${flowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: flowName || 'Untitled Flow',
          nodes,
          edges,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [flowId]);

  const loadFlow = useCallback(async () => {
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

  return { saveFlow, loadFlow };
}
