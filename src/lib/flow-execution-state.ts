import type { Node } from '@xyflow/react';
import { useFlowStore } from '@/store/flowStore';
import type { AgentStep } from '@/types/agent';

type NodeDataPatch = Record<string, unknown>;

function patchNodeData(nodeId: string, patch: NodeDataPatch) {
  const store = useFlowStore.getState();
  store.setNodes(
    store.nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
    ),
  );
}

export function getNodeLabel(node: Node, fallback = 'node'): string {
  return (node.data?.label as string | undefined) || node.type || fallback;
}

export function resetExecutionNodes(nodes: Node[]): Node[] {
  return nodes.map((n) => ({
    ...n,
    data: { ...n.data, status: 'waiting', logs: [], currentOutput: '', currentToken: '', handleResults: undefined },
  }));
}

export function setNodeRunning(nodeId: string) {
  patchNodeData(nodeId, { status: 'running', logs: [], currentToken: '' });
}

export function setNodeSuccess(nodeId: string, output: string) {
  patchNodeData(nodeId, { status: 'success', currentOutput: output, currentToken: '' });
}

export function setNodeError(nodeId: string) {
  patchNodeData(nodeId, { status: 'error', currentToken: '' });
}

export function setNodeSkipped(nodeId: string) {
  patchNodeData(nodeId, { status: 'skipped' });
}

export function setInputNodeRunning(nodeId: string) {
  patchNodeData(nodeId, { status: 'running' });
}

export function setInputNodeSuccess(nodeId: string) {
  patchNodeData(nodeId, { status: 'success' });
}

export function setConditionResult(nodeId: string, result: boolean) {
  patchNodeData(nodeId, { conditionResult: result ? 'true' : 'false' });
}

export function setNodePartial(nodeId: string, output: string) {
  patchNodeData(nodeId, { status: 'partial', currentOutput: output, currentToken: '' });
}

export function setNodeWarning(nodeId: string, message: string) {
  patchNodeData(nodeId, { status: 'warning', warningMessage: message });
}

export function setLoopCount(nodeId: string, count: number) {
  patchNodeData(nodeId, { loopCount: count });
}

export function appendAgentStep(nodeId: string, step: AgentStep) {
  const store = useFlowStore.getState();
  store.setNodes(
    store.nodes.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, logs: [...((n.data.logs as unknown[]) || []), step] } }
        : n,
    ),
  );
}

export function appendAgentToken(nodeId: string, token: string) {
  const store = useFlowStore.getState();
  store.setNodes(
    store.nodes.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, currentToken: ((n.data.currentToken as string) || '') + token } }
        : n,
    ),
  );
}

