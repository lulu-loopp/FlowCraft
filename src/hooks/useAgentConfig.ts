import { useState, useEffect, useRef, useCallback } from 'react';
import { useFlowStore } from '@/store/flowStore';
import type { Node } from '@xyflow/react';
import type { ModelProvider } from '@/types/model';
import { MODEL_OPTIONS } from '@/types/model';

/**
 * Encapsulates the agent-config update/sync logic previously inlined in AgentConfigPanel.
 * Returns derived data + an `updateNodeData` function that handles:
 *   - individual-reference warning interception
 *   - sibling-node sync
 *   - debounced flow save
 *   - debounced individual-agent file sync
 */
export function useAgentConfig(node: Node) {
  const data = node.data as Record<string, unknown>;
  const individualName = data.individualName as string | undefined;
  const isReference = !!(data.isReference);

  const [localSystemPrompt, setLocalSystemPrompt] = useState((data.systemPrompt as string) || '');
  const [showIndividualWarning, setShowIndividualWarning] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, unknown> | null>(null);
  const individualWarningShownRef = useRef(false);
  const promptComposingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncIndividualRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local prompt when store value changes externally
  useEffect(() => {
    if (!promptComposingRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSystemPrompt((data.systemPrompt as string) || '');
    }
  }, [data.systemPrompt]);

  /** Sync node data back to the shared individual agent definition on disk. */
  const syncToIndividual = useCallback((agentName: string) => {
    if (syncIndividualRef.current) clearTimeout(syncIndividualRef.current);
    syncIndividualRef.current = setTimeout(() => {
      const nd = useFlowStore.getState().nodes.find(n => n.id === node.id);
      if (!nd) return;
      const d = nd.data as Record<string, unknown>;
      const p = d.personality as Record<string, string> | undefined;
      const lines = [
        '---',
        `name: ${agentName}`,
        `description: ${(p?.role) || ''}`,
        `role: ${(p?.role) || ''}`,
        `provider: ${(d.provider as string) || 'anthropic'}`,
        `model: ${(d.model as string) || 'claude-sonnet-4-6'}`,
        `maxIterations: ${(d.maxIterations as number) || 10}`,
      ];
      const sp = (d.systemPrompt as string) || '';
      if (sp) lines.push(`systemPrompt_zh: "${sp.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
      const tools = (d.enabledTools as string[]) || [];
      if (tools.length) { lines.push('tools:'); tools.forEach(t => lines.push(`  - ${t}`)); }
      const skills = (d.enabledSkills as string[]) || [];
      if (skills.length) { lines.push('skills:'); skills.forEach(s => lines.push(`  - ${s}`)); }
      if (p) {
        if (p.thinkingStyle) lines.push(`thinkingStyle: ${p.thinkingStyle}`);
        if (p.communicationStyle) lines.push(`communicationStyle: ${p.communicationStyle}`);
        if (p.valueOrientation) lines.push(`valueOrientation: ${p.valueOrientation}`);
        if (p.backstory) lines.push(`backstory: "${p.backstory.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
        if (p.beliefs) lines.push(`beliefs: "${p.beliefs.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
      }
      lines.push('---');
      fetch(`/api/agents/individuals/${encodeURIComponent(agentName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: lines.join('\n'), role: p?.role }),
      }).catch(() => {});
    }, 1200);
  }, [node.id]);

  const applyUpdates = useCallback((updates: Record<string, unknown>) => {
    const store = useFlowStore.getState();
    const nd = store.nodes.find(n => n.id === node.id);
    const currentData = nd ? { ...nd.data, ...updates } : updates;
    const iName = currentData.individualName as string | undefined;
    const iRef = currentData.isReference;

    store.setNodes(store.nodes.map(n => {
      if (n.id === node.id) return { ...n, data: { ...n.data, ...updates } };
      if (iName && iRef && n.data?.individualName === iName && n.data?.isReference) {
        return { ...n, data: { ...n.data, ...updates, label: n.data.label } };
      }
      return n;
    }));

    if (iName && iRef) {
      syncToIndividual(iName);
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const { flowId, nodes: latestNodes, edges, flowName, viewStack } = useFlowStore.getState();
      if (!flowId) return;
      if (viewStack.length > 0) return;
      fetch(`/api/flows/${flowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: flowName || 'Untitled Flow', nodes: latestNodes, edges }),
      }).catch(() => {});
    }, 1000);
  }, [node.id, syncToIndividual]);

  // Intercept updates: if node is a referenced individual agent, show warning first
  const updateNodeData = useCallback((updates: Record<string, unknown>) => {
    if (individualName && isReference && !individualWarningShownRef.current) {
      setPendingUpdates(updates);
      setShowIndividualWarning(true);
      return;
    }
    applyUpdates(updates);
  }, [individualName, isReference, applyUpdates]);

  // Derived config data
  const provider           = (data.provider           as ModelProvider) || 'anthropic';
  const model              = (data.model              as string)        || MODEL_OPTIONS[provider][0];
  const enabledTools       = (data.enabledTools       as string[])      || [];
  const enabledSkills      = (data.enabledSkills      as string[])      || [];
  const completionCriteria = (data.completionCriteria as string[])      || [];
  const outputSchema       = (data.outputSchema       as { name: string; type: string }[]) || [];

  // Warning dialog handlers
  const onEditOriginal = useCallback(() => {
    setShowIndividualWarning(false);
    individualWarningShownRef.current = true;
    if (pendingUpdates) applyUpdates(pendingUpdates);
    setPendingUpdates(null);
  }, [pendingUpdates, applyUpdates]);

  const onCreateCopy = useCallback(() => {
    setShowIndividualWarning(false);
    individualWarningShownRef.current = true;
    useFlowStore.getState().detachIndividualInPack(node.id);
    if (pendingUpdates) applyUpdates(pendingUpdates);
    setPendingUpdates(null);
  }, [pendingUpdates, applyUpdates, node.id]);

  const onCancelWarning = useCallback(() => {
    setShowIndividualWarning(false);
    setPendingUpdates(null);
  }, []);

  return {
    // Config data
    data,
    provider,
    model,
    enabledTools,
    enabledSkills,
    completionCriteria,
    outputSchema,
    individualName,
    isReference,

    // System prompt
    localSystemPrompt,
    setLocalSystemPrompt,
    promptComposingRef,

    // Actions
    updateNodeData,

    // Individual warning
    showIndividualWarning,
    onEditOriginal,
    onCreateCopy,
    onCancelWarning,
  };
}
