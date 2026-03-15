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
    <div className="absolute inset-0 z-0 bg-slate-50/50" ref={reactFlowWrapper}>
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
        <Controls className="!mb-[100px] !ml-6" />
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
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
