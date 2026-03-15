'use client';

import React from 'react';
import { FolderOpen, Clock } from 'lucide-react';
import { Tabs } from '../ui/tabs';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { AgentConfigPanel } from './agent-config-panel';

export function RightPanel() {
  const [activeTab, setActiveTab] = React.useState('config');
  const { selectedNodeId, nodes } = useFlowStore();
  const { t } = useUIStore();

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
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col overflow-hidden shrink-0">
      {/* Tabs header */}
      <div className="px-3 py-3 border-b border-slate-200 shrink-0">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
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
