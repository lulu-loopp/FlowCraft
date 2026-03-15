'use client';

import React from 'react';
import { FolderOpen, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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
    // Wrapper: zero-width when collapsed, tab overflows into canvas via absolute
    <div className="relative shrink-0 h-full">
      {/* Panel body — width animates */}
      <div
        className="h-full bg-white border-l border-slate-200 flex flex-col overflow-hidden"
        style={{ width: isCollapsed ? 0 : 320, transition: 'width 200ms ease-in-out' }}
      >
        {/* Tabs header */}
        <div className="px-3 py-3 border-b border-slate-200 shrink-0">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
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

          {activeTab === 'files' && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-1">
                <FolderOpen className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">{t('panel.right.noFiles')}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{t('panel.right.noFilesHint')}</p>
            </div>
          )}

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

      {/* Toggle tab — sits on the left border, always visible */}
      <button
        onClick={() => setIsCollapsed(o => !o)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full
                   w-4 h-10 z-10 bg-white
                   border border-r-0 border-slate-200 rounded-l-md
                   flex items-center justify-center
                   text-slate-300 hover:text-slate-600 hover:bg-slate-50
                   shadow-[-2px_0_6px_rgba(0,0,0,0.06)]
                   transition-colors cursor-pointer"
        title={isCollapsed ? 'Expand' : 'Collapse'}
      >
        {isCollapsed
          ? <ChevronLeft  className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />}
      </button>
    </div>
  );
}
