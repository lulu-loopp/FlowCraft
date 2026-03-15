'use client';

import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFlowStore } from '@/store/flowStore';
import { nodeTypes } from './nodes';
import { CustomEdge } from './custom-edge';
import { Button } from '../ui/button';
import { Blocks } from 'lucide-react';

const edgeTypes = {
  custom: CustomEdge,
};

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNodeId } = useFlowStore();
  const { screenToFlowPosition } = useReactFlow();

  const selectedNodesCount = React.useMemo(() => nodes.filter(n => n.selected).length, [nodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: `${type} node` },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

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
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes as any}
        defaultEdgeOptions={{ type: 'custom' }}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
      >
        <Background gap={20} size={1} color="#cbd5e1" />
        <Controls className="!mb-4 !ml-4" />
        <MiniMap
          className="!bottom-4 !right-4"
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
          <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 outline-none text-white rounded-full">
            <Blocks className="w-4 h-4 mr-2" />
            Pack into Agent
          </Button>
        </div>
      )}
    </div>
  );
}

export function FlowEditor() {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  );
}
