'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { refreshIndividualNodes } from '@/hooks/useLoadIndividual';
import type { FlowData } from '@/types/flow';

export type SaveStatus = 'idle' | 'saving' | 'saved';

export function useFlowPersistence(flowId: string) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const saveFlow = useCallback(async (): Promise<boolean> => {
    if (!flowId) return false;
    // Don't save while viewing a packed node's internals
    if (useFlowStore.getState().viewStack.length > 0) return false;

    // Cancel any in-flight save to prevent stale state from overwriting newer state
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setSaveStatus('saving');
    try {
      const { nodes, edges, flowName } = useFlowStore.getState();
      const res = await fetch(`/api/flows/${flowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: flowName || 'Untitled Flow', nodes, edges }),
        signal,
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('idle');
      }
      return res.ok;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      setSaveStatus('idle');
      return false;
    }
  }, [flowId]);

  // Auto-save on store changes.
  // Uses an inline save function (not the stateful saveFlow) to avoid any closure issues.
  useEffect(() => {
    if (!flowId) return;

    const doSave = () => {
      const { nodes, edges, flowName, isRunning, viewStack } = useFlowStore.getState();
      if (isRunning) return;
      // CRITICAL: never auto-save while viewing a packed node's internals —
      // the store's nodes/edges are the pack's internal flow, not the real flow.
      if (viewStack.length > 0) return;

      // Cancel any in-flight save to prevent stale state from overwriting newer state
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      setSaveStatus('saving');
      fetch(`/api/flows/${flowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: flowName || 'Untitled Flow', nodes, edges }),
        signal,
      }).then((res) => {
        if (res.ok) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('idle');
        }
      }).catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setSaveStatus('idle');
      });
    };

    const unsub = useFlowStore.subscribe((state, prev) => {
      if (state.isRunning) return;
      // Skip when inside a viewStack (pack internals, not the real flow)
      if (state.viewStack.length > 0) return;

      const nodesChanged = state.nodes !== prev.nodes;
      const edgesChanged = state.edges !== prev.edges;
      const nameChanged = state.flowName !== prev.flowName;

      if (!nodesChanged && !edgesChanged && !nameChanged) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      const structural =
        (nodesChanged && state.nodes.length !== prev.nodes.length) ||
        (edgesChanged && state.edges.length !== prev.edges.length) ||
        nameChanged;

      if (structural) {
        doSave();
      } else {
        timerRef.current = setTimeout(doSave, 800);
      }
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flowId]);

  const loadFlow = useCallback(async () => {
    if (!flowId) return;
    try {
      // Reset transient state FIRST to prevent stale viewStack/logs bleeding across flows
      useFlowStore.getState().resetForNewFlow();

      const [flowRes, runsRes] = await Promise.all([
        fetch(`/api/flows/${flowId}`),
        fetch(`/api/flows/${flowId}/runs`),
      ]);
      if (!flowRes.ok) return;
      const flow: FlowData = await flowRes.json();
      const store = useFlowStore.getState();
      // Refresh referenced individual agents with latest shared definitions
      const lang = useUIStore.getState().lang;
      const freshNodes = await refreshIndividualNodes(flow.nodes || [], lang);
      store.setNodesAndEdges(freshNodes, flow.edges || []);
      store.setFlowName(flow.name || 'Untitled Flow');
      store.setFlowId(flowId);
      if (runsRes.ok) {
        const runs = await runsRes.json();
        store.setRunHistory(Array.isArray(runs) ? runs : []);
      }
    } catch {
      // fail silently
    }
  }, [flowId]);

  return { saveFlow, loadFlow, saveStatus };
}
