'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Node, Edge } from '@xyflow/react';
import { useFlowStore } from '@/store/flowStore';
import { nodeTypes } from './nodes';
import { CustomEdge } from './custom-edge';
import { Button } from '../ui/button';
import { Blocks } from 'lucide-react';
import { startDrag, stopDrag } from '@/hooks/useUndoRedo';
import { PackAgentDialog } from './pack-agent-dialog';

const edgeTypes = {
  custom: CustomEdge,
};

function buildInstructions(nodes: Node[]): string {
  return nodes.map((n, i) => {
    const d = n.data as any;
    const label = (d.label as string) || n.type || 'Node';
    const lines = [`### Step ${i + 1}: ${label} (${n.type})`];
    if (d.systemPrompt) lines.push(`System prompt: ${d.systemPrompt}`);
    if (d.model) lines.push(`Model: ${d.provider || 'anthropic'}/${d.model}`);
    if (d.enabledTools?.length) lines.push(`Tools: ${d.enabledTools.join(', ')}`);
    if (d.conditionValue) lines.push(`Condition (${d.conditionMode || 'natural'}): ${d.conditionValue}`);
    return lines.join('\n');
  }).join('\n\n');
}

interface FlowCanvasProps {
  onSave?: () => void;
}

function FlowCanvas({ onSave }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNodeId, setNodes, setEdges } = useFlowStore();
  const { screenToFlowPosition } = useReactFlow();
  const [packOpen, setPackOpen] = useState(false);

  const selectedNodes = React.useMemo(() => nodes.filter(n => n.selected), [nodes]);
  const selectedNodesCount = selectedNodes.length;

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const agentName = event.dataTransfer.getData('application/agent-name');

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: agentName
          ? { label: agentName, systemPrompt: '' }
          : { label: `${type} node` },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const handlePack = useCallback(async (name: string, description: string) => {
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const instructions = buildInstructions(selectedNodes);

    try {
      const res = await fetch('/api/agents/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, instructions }),
      });
      if (!res.ok) throw new Error('Failed to save agent');
    } catch (err) {
      console.error(err);
      setPackOpen(false);
      return;
    }

    // Calculate center of selected nodes
    const cx = selectedNodes.reduce((s, n) => s + n.position.x, 0) / selectedNodes.length;
    const cy = selectedNodes.reduce((s, n) => s + n.position.y, 0) / selectedNodes.length;

    const newNodeId = `agent-${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: 'agent',
      position: { x: cx, y: cy },
      data: { label: name, systemPrompt: `You are ${name}.` },
      selected: false,
    };

    // Reroute edges: external connections go through the new node
    const newEdges: Edge[] = edges
      .filter(e => !(selectedIds.has(e.source) && selectedIds.has(e.target)))
      .map(e => {
        if (selectedIds.has(e.target) && !selectedIds.has(e.source)) {
          return { ...e, id: `${e.id}-r`, target: newNodeId, targetHandle: null };
        }
        if (selectedIds.has(e.source) && !selectedIds.has(e.target)) {
          return { ...e, id: `${e.id}-r`, source: newNodeId, sourceHandle: null };
        }
        return e;
      });

    setNodes([...nodes.filter(n => !selectedIds.has(n.id)), newNode]);
    setEdges(newEdges);
    setPackOpen(false);
    onSave?.();
  }, [selectedNodes, nodes, edges, setNodes, setEdges, onSave]);

  return (
    <div className="w-full h-full relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStart={() => startDrag()}
        onNodeDragStop={() => { stopDrag(); onSave?.(); }}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes as any}
        defaultEdgeOptions={{ type: 'custom' }}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background gap={20} size={1} color="#cbd5e1" />
        <Controls className="!mb-4 !ml-4" />
        <MiniMap
          className="!bottom-4 !right-4"
          style={{ width: 128, height: 90 }}
          nodeColor={(node) => {
            const colors: Record<string, string> = {
              agent: '#6366f1', tool: '#10b981', skill: '#f59e0b',
              human: '#f43f5e', io: '#0ea5e9', condition: '#64748b',
              initializer: '#8b5cf6',
            };
            return colors[node.type ?? ''] ?? '#94a3b8';
          }}
          nodeStrokeWidth={0}
          maskColor="rgba(241,245,249,0.75)"
          zoomable
          pannable
        />
      </ReactFlow>

      {selectedNodesCount > 1 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 shadow-xl flex items-center gap-3 animate-fade-in-up">
          <span className="text-sm font-medium text-slate-200">{selectedNodesCount} nodes selected</span>
          <div className="w-[1px] h-4 bg-slate-600" />
          <Button
            size="sm"
            className="h-8 bg-teal-600 hover:bg-teal-700 outline-none text-white rounded-full"
            onClick={() => setPackOpen(true)}
          >
            <Blocks className="w-4 h-4 mr-2" />
            Pack into Agent
          </Button>
        </div>
      )}

      {packOpen && (
        <PackAgentDialog
          defaultName={selectedNodes.map(n => (n.data.label as string) || n.type || '').join('-')}
          onConfirm={handlePack}
          onClose={() => setPackOpen(false)}
        />
      )}
    </div>
  );
}

interface FlowEditorProps {
  onSave?: () => void;
}

export function FlowEditor({ onSave }: FlowEditorProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ReactFlowProvider>
        <FlowCanvas onSave={onSave} />
      </ReactFlowProvider>
    </div>
  );
}
