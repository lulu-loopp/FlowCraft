'use client';

import React from 'react';
import { FolderOpen, Clock, ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { Tabs } from '../ui/tabs';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { AgentConfigPanel } from './agent-config-panel';

interface WorkspaceFile {
  name: string;
  relativePath: string;
  size: number;
}

function FilesPanel({ flowId }: { flowId: string }) {
  const [files, setFiles] = React.useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { t } = useUIStore();

  const load = React.useCallback(async () => {
    if (!flowId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace/${flowId}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [flowId]);

  React.useEffect(() => { load(); }, [load]);

  if (!flowId) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-1">
          <FolderOpen className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700">{t('panel.right.noFiles')}</p>
        <p className="text-xs text-slate-400 leading-relaxed">{t('panel.right.runToCreateFiles')}</p>
        <button onClick={load} className="text-xs text-teal-600 hover:underline flex items-center gap-1 mt-1">
          <RefreshCw className="w-3 h-3" /> {t('panel.right.refresh')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{files.length} {t('panel.right.filesLabel')}</span>
        <button onClick={load} className="text-xs text-slate-400 hover:text-teal-600 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      {files.map(f => (
        <div key={f.relativePath} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 group">
          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-700 truncate">{f.relativePath}</p>
            <p className="text-xs text-slate-400">{(f.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RightPanel() {
  const [activeTab, setActiveTab] = React.useState('config');
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { selectedNodeId, nodes, nodeClickTick, runHistory, flowId } = useFlowStore();
  const { t } = useUIStore();

  // Auto-expand and switch to config tab when a node is clicked (including re-clicks)
  React.useEffect(() => {
    if (selectedNodeId) {
      setIsCollapsed(false);
      setActiveTab('config');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeClickTick]);

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
            <FilesPanel flowId={flowId} />
          )}

          {activeTab === 'history' && runHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-1">
                <Clock className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">{t('panel.right.noHistory')}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{t('panel.right.noHistoryHint')}</p>
            </div>
          )}

          {activeTab === 'history' && runHistory.length > 0 && (
            <div className="space-y-2">
              {runHistory.map((record) => (
                <div
                  key={record.id}
                  className="bg-white border border-slate-100 rounded-xl p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        record.status === 'success'
                          ? 'bg-emerald-50 text-emerald-700'
                          : record.status === 'error'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {record.status}
                    </span>
                    <span className="text-xs text-slate-400">{record.duration}ms</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(record.startedAt).toLocaleTimeString()} &middot; {record.nodeCount} nodes
                  </p>
                </div>
              ))}
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
        title={isCollapsed ? t('panel.left.expand') : t('panel.left.collapse')}
      >
        {isCollapsed
          ? <ChevronLeft  className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />}
      </button>
    </div>
  );
}
