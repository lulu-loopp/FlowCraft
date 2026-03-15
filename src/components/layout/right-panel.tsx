'use client';

import React from 'react';
import { Panel } from '../ui/panel';
import { FolderTree, History } from 'lucide-react';
import { Tabs } from '../ui/tabs';
import { useFlowStore } from '@/store/flowStore';
import { AgentConfigPanel } from './agent-config-panel';

export function RightPanel() {
  const [activeTab, setActiveTab] = React.useState('config');
  const { selectedNodeId, nodes } = useFlowStore();

  const selectedNode = React.useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [selectedNodeId, nodes]
  );

  const isLocked = selectedNode ? selectedNode.draggable === false : false;

  const tabs = [
    { id: 'config',  label: 'Configuration' },
    { id: 'files',   label: 'Files' },
    { id: 'history', label: 'History' },
  ];

  return (
    <Panel className="absolute top-24 bottom-4 right-4 w-80 flex flex-col overflow-hidden z-40 transition-transform duration-300">
      <div className="p-4 border-b border-slate-100 flex-shrink-0">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'config' && !selectedNode && (
          <p className="text-sm text-slate-500 text-center mt-10">
            Select a node to view configuration.
          </p>
        )}

        {activeTab === 'config' && selectedNode && (
          <div className="space-y-5">
            {isLocked && (
              <div className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg">
                Position Locked
              </div>
            )}

            {selectedNode.type === 'agent' && (
              <AgentConfigPanel node={selectedNode} />
            )}

            {selectedNode.type !== 'agent' && (
              <p className="text-sm text-slate-500 py-4 italic leading-relaxed">
                No specific configuration available for {selectedNode.type} node.
              </p>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="text-sm text-slate-500 flex flex-col items-center justify-center h-full gap-2">
            <FolderTree className="w-12 h-12 text-slate-200" />
            <span className="text-slate-400">No workspace files</span>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="text-sm text-slate-500 flex flex-col items-center justify-center h-full gap-2">
            <History className="w-12 h-12 text-slate-200" />
            <span className="text-slate-400">No run history yet</span>
          </div>
        )}
      </div>
    </Panel>
  );
}
