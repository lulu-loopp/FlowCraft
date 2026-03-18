'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Node, Edge } from '@xyflow/react';
import { useFlowStore } from '@/store/flowStore';
import { nodeTypes } from './nodes';
import { CustomEdge } from './custom-edge';
import { PRESET_NODES } from '@/lib/presets/nodes';
import { Button } from '../ui/button';
import { Blocks } from 'lucide-react';
import { startDrag, stopDrag } from '@/hooks/useUndoRedo';
import { PackAgentDialog } from './pack-agent-dialog';
import { BreadcrumbNav } from './breadcrumb-nav';
import { useUIStore } from '@/store/uiStore';
import { buildPackHandleConfig, buildPackData } from '@/hooks/usePackedNode';
import { useLoadIndividual } from '@/hooks/useLoadIndividual';
import { handleDropPack } from './flow-editor-pack-drop';
import { PreviewTypesProvider } from './preview-types-context';

const edgeTypes = { custom: CustomEdge };

function FlowCanvas({ onSave }: { onSave?: () => void }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNodeId, setNodes, setEdges } = useFlowStore();
  const viewStack = useFlowStore(s => s.viewStack);
  const popViewStack = useFlowStore(s => s.popViewStack);
  const { screenToFlowPosition } = useReactFlow();
  const { t } = useUIStore();
  const [packOpen, setPackOpen] = useState(false);
  const loadIndividualData = useLoadIndividual();
  const selectedNodes = React.useMemo(() => nodes.filter(n => n.selected), [nodes]);
  const selectedNodesCount = selectedNodes.length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewStack.length > 0) { e.preventDefault(); popViewStack() }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewStack, popViewStack]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const packName = event.dataTransfer.getData('application/pack-name');
    if (packName && type === 'packed') { handleDropPack(packName, position, addNode); return }
    const agentName = event.dataTransfer.getData('application/agent-name');
    const presetId = event.dataTransfer.getData('application/preset-id');
    let data: Record<string, unknown>;
    if (presetId) {
      const preset = PRESET_NODES.find(p => p.id === presetId);
      if (preset) {
        const lang = useUIStore.getState().lang;
        data = { label: t(preset.labelKey), systemPrompt: preset.data.systemPrompt[lang] ?? preset.data.systemPrompt.zh,
          enabledTools: preset.data.enabledTools, maxIterations: preset.data.maxIterations, provider: preset.data.provider, model: preset.data.model };
      } else { data = { label: `${type} node` } }
    } else if (agentName) { data = { label: agentName, systemPrompt: '', isReference: true, individualName: agentName } }
    else { data = { label: `${type} node` } }
    const nodeId = `${type}-${Date.now()}`;
    const newNode: Node = { id: nodeId, type, position, data, selected: !!presetId };
    addNode(newNode);
    if (presetId) setSelectedNodeId(newNode.id);
    if (agentName) loadIndividualData(nodeId, agentName);
  }, [screenToFlowPosition, addNode, setSelectedNodeId, t, loadIndividualData]);

  const handlePack = useCallback(async (name: string, description: string, isShared: boolean) => {
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const internalEdges = edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target));
    const flow = {
      nodes: selectedNodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      edges: internalEdges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
    };
    let cleanName = name;
    try {
      const instructions = selectedNodes.map((n, i) => `### Step ${i + 1}: ${(n.data?.label as string) || n.type}`).join('\n');
      const res = await fetch('/api/agents/packs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, instructions, flow }) });
      if (!res.ok) throw new Error('Failed');
      const resJson = await res.json();
      cleanName = resJson.name || name;
    } catch (err) { console.error(err); setPackOpen(false); return }
    const handleConfig = buildPackHandleConfig(selectedNodes);
    const { internalNodeNames, internalNodeCount, internalEdgeCount } = buildPackData(flow);
    const cx = selectedNodes.reduce((s, n) => s + n.position.x, 0) / selectedNodes.length;
    const cy = selectedNodes.reduce((s, n) => s + n.position.y, 0) / selectedNodes.length;
    const newNodeId = `packed-${Date.now()}`;
    const newNode: Node = { id: newNodeId, type: 'packed', position: { x: cx, y: cy },
      data: { label: name, packName: cleanName, isSharedPack: isShared, handleConfig, internalNodeNames, internalNodeCount, internalEdgeCount, packVersion: Date.now() }, selected: false };
    const currentNodes = useFlowStore.getState().nodes;
    const currentEdges = useFlowStore.getState().edges;
    const newEdges: Edge[] = currentEdges.filter(e => !(selectedIds.has(e.source) && selectedIds.has(e.target))).map(e => {
      if (selectedIds.has(e.target) && !selectedIds.has(e.source)) {
        const m = handleConfig.find(h => h.type === 'input' && h.internalNodeId === e.target);
        return { ...e, id: `${e.id}-r`, target: newNodeId, targetHandle: m?.id || null };
      }
      if (selectedIds.has(e.source) && !selectedIds.has(e.target)) {
        const m = handleConfig.find(h => h.type === 'output' && h.internalNodeId === e.source);
        return { ...e, id: `${e.id}-r`, source: newNodeId, sourceHandle: m?.id || null };
      }
      return e;
    });
    setNodes([...currentNodes.filter(n => !selectedIds.has(n.id)), newNode]);
    setEdges(newEdges); setPackOpen(false); onSave?.();
  }, [selectedNodes, edges, setNodes, setEdges, onSave]);

  return (
    <div className="w-full h-full relative flex flex-col" ref={reactFlowWrapper}>
      <BreadcrumbNav />
      <div className="flex-1 min-h-0 relative">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          onDrop={onDrop} onDragOver={onDragOver} onNodeDragStart={() => startDrag()} onNodeDragStop={() => { stopDrag(); onSave?.() }}
          deleteKeyCode={['Backspace', 'Delete']}
          /* eslint-disable @typescript-eslint/no-explicit-any */
          nodeTypes={nodeTypes as any} edgeTypes={edgeTypes as any}
          defaultEdgeOptions={{ type: 'custom' }} onNodeClick={(_, node) => setSelectedNodeId(node.id)} onPaneClick={() => setSelectedNodeId(null)}
          proOptions={{ hideAttribution: true }} fitView>
          <Background gap={20} size={1} color="#cbd5e1" />
          <Controls className="!mb-4 !ml-4" />
          <MiniMap className="!bottom-4 !right-4" style={{ width: 128, height: 90 }}
            nodeColor={n => {
              if (n.type === 'aiCodingAgent') return n.data?.cli === 'codex' ? '#0D0D0D' : '#D97757';
              return ({ agent: '#6366f1', tool: '#06b6d4', skill: '#f59e0b', human: '#f43f5e', io: '#0ea5e9', condition: '#64748b', initializer: '#8b5cf6', packed: '#7c3aed', output: '#10b981' }[n.type ?? ''] ?? '#94a3b8');
            }}
            nodeStrokeWidth={0} maskColor="rgba(241,245,249,0.75)" zoomable pannable />
        </ReactFlow>
        {selectedNodesCount > 1 && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 shadow-xl flex items-center gap-3 animate-fade-in-up">
            <span className="text-sm font-medium text-slate-200">{t('canvas.nodesSelected').replace('{count}', String(selectedNodesCount))}</span>
            <div className="w-[1px] h-4 bg-slate-600" />
            <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 outline-none text-white rounded-full" onClick={() => setPackOpen(true)}>
              <Blocks className="w-4 h-4 mr-2" />{t('canvas.packIntoAgent')}</Button>
          </div>
        )}
        {packOpen && <PackAgentDialog selectedNodes={selectedNodes} edges={edges} defaultName={selectedNodes.map(n => (n.data.label as string) || n.type || '').join('-')} onConfirm={handlePack} onClose={() => setPackOpen(false)} />}
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const previewTypes = { nodeTypes: nodeTypes as any, edgeTypes: edgeTypes as any };

export function FlowEditor({ onSave }: { onSave?: () => void }) {
  return <div className="flex-1 min-h-0 overflow-hidden"><ReactFlowProvider><PreviewTypesProvider value={previewTypes}><FlowCanvas onSave={onSave} /></PreviewTypesProvider></ReactFlowProvider></div>;
}
