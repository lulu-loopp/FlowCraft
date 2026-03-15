'use client';

import React from 'react';
import { FolderOpen, Clock, ChevronRight } from 'lucide-react';
import { Tabs } from '../ui/tabs';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { AgentConfigPanel } from './agent-config-panel';

export function RightPanel() {
  const [activeTab, setActiveTab] = React.useState('config');
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { selectedNodeId, nodes } = useFlowStore();
  const { t } = useUIStore();

  // Auto-expand when a node is selected
  React.useEffect(() => {
    if (selectedNodeId) setIsCollapsed(false);
  }, [selectedNodeId]);

  const selectedNode = React.useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [selectedNodeId, nodes]
  );

  const isLocked = selectedNode ? selectedNode.draggable === false : false;

  const tabs = [
    { id: 'config',  label: t('panel.right.config') },
    { id: 'files',   label: t('panel.right.files') },
    { id: 'history', label: t('panel.right.history') },
  ];

  return (
    // Single element — width transition animates between collapsed/expanded
    <div
      className="bg-white border-l border-slate-200 flex flex-col overflow-hidden shrink-0"
      style={{ width: isCollapsed ? 36 : 320, transition: 'width 200ms ease-in-out' }}
    >
      {/* Tabs header — relative so collapse button can be absolute */}
      <div className="relative border-b border-slate-200 shrink-0 px-3 py-3">
        <div
          style={{ opacity: isCollapsed ? 0 : 1, transition: 'opacity 150ms ease-in-out', pointerEvents: isCollapsed ? 'none' : 'auto' }}
        >
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
        {/* Collapse button — absolute top-right, never takes layout space */}
        <button
          onClick={() => setIsCollapsed(o => !o)}
          className="absolute top-2 right-2 p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronRight
            className="w-3.5 h-3.5 transition-transform duration-200"
            style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto p-4"
        style={{ opacity: isCollapsed ? 0 : 1, pointerEvents: isCollapsed ? 'none' : 'auto', transition: 'opacity 120ms ease-in-out' }}
      >
        {/* Config tab */}
        {activeTab === 'config' && !selectedNode && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-1">
              <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">{t('panel.right.selectNode')}</p>
          </div>
        )}

        {activeTab === 'config' && selectedNode && (
          <div className="space-y-5">
            {isLocked && (
              <div className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                {t('panel.right.positionLocked')}
              </div>
            )}
            {selectedNode.type === 'agent' && <AgentConfigPanel node={selectedNode} />}
            {selectedNode.type !== 'agent' && (
              <p className="text-sm text-slate-400 py-4 leading-relaxed">
                {t('panel.right.noConfig')}
              </p>
            )}
          </div>
        )}

        {/* Files tab */}
        {activeTab === 'files' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-1">
              <FolderOpen className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">{t('panel.right.noFiles')}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{t('panel.right.noFilesHint')}</p>
          </div>
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-1">
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">{t('panel.right.noHistory')}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{t('panel.right.noHistoryHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
