'use client';

import React from 'react';
import { FolderOpen, Clock, ChevronLeft, ChevronRight, FileText, RefreshCw, Download, Trash2 } from 'lucide-react';
import { Tabs } from '../ui/tabs';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { AgentConfigPanel } from './agent-config-panel';
import { PersonalityConfig } from './personality-config';
import { MemoryViewer } from './memory-viewer';
import { KnowledgeTab } from './knowledge-tab';
import { AiCodingAgentConfig } from './ai-coding-agent-config';
import { ConditionConfigPanel } from './condition-config-panel';
import { FilePreviewModal } from '../ui/file-preview-modal';

interface WorkspaceFile {
  name: string;
  relativePath: string;
  size: number;
}

function FilesPanel({ flowId }: { flowId: string }) {
  const [files, setFiles] = React.useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [previewFile, setPreviewFile] = React.useState<WorkspaceFile | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const { t } = useUIStore();

  const handleDelete = React.useCallback(async (file: WorkspaceFile) => {
    if (!flowId) return;
    setDeleting(file.relativePath);
    try {
      const res = await fetch(`/api/workspace/${flowId}/file?path=${encodeURIComponent(file.relativePath)}`, { method: 'DELETE' });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.relativePath !== file.relativePath));
      }
    } catch { /* ignore */ }
    setDeleting(null);
  }, [flowId]);

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
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">{files.length} {t('panel.right.filesLabel')}</span>
          <button onClick={load} className="text-xs text-slate-400 hover:text-teal-600 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        {files.map(f => {
          return (
            <div key={f.relativePath} className="flex items-center gap-1 group">
              <button
                onClick={() => setPreviewFile(f)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-teal-50 flex-1 min-w-0 text-left transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-500 shrink-0 transition-colors" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 group-hover:text-teal-700 truncate transition-colors">{f.relativePath}</p>
                  <p className="text-xs text-slate-400">{(f.size / 1024).toFixed(1)} KB</p>
                </div>
              </button>
              <a
                href={`/api/workspace/${flowId}/file?path=${encodeURIComponent(f.relativePath)}&download=1`}
                download={f.name}
                className="p-1.5 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                title={t('file.download')}
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => handleDelete(f)}
                disabled={deleting === f.relativePath}
                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                title={t('file.delete')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      {previewFile && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          title={previewFile.name}
          flowId={flowId}
          filePath={previewFile.relativePath}
          editable
        />
      )}
    </>
  );
}

function OutputNodePanel({ node, flowId }: { node: import('@xyflow/react').Node; flowId: string }) {
  const { t } = useUIStore();
  const [previewFile, setPreviewFile] = React.useState<{ name: string; path: string } | null>(null);

  const data = node.data as Record<string, unknown>;
  const output = (data.currentOutput as string) || '';
  const documents = (data.documents as { url: string; name: string }[]) || [];
  const status = data.status as string | undefined;

  return (
    <div className="space-y-3">
      {/* Status badge */}
      {status && status !== 'idle' && (
        <div className={`text-xs font-medium px-2.5 py-1.5 rounded-lg ${
          status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            : status === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100'
            : 'bg-slate-50 text-slate-600 border border-slate-100'
        }`}>
          {status === 'success' ? t('node.output.completed') : status === 'error' ? t('node.output.error') : t('node.output.waiting')}
        </div>
      )}

      {/* Generated files */}
      {documents.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">{t('panel.right.generatedFiles')}</p>
          <div className="space-y-1">
            {documents.map((doc, i) => (
              <div key={i} className="flex items-center gap-1">
                <button
                  onClick={() => {
                    let docPath = doc.name
                    try { const u = new URL(doc.url, 'http://localhost'); docPath = u.searchParams.get('path') || doc.name } catch { /* ignore */ }
                    setPreviewFile({ name: doc.name, path: docPath })
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors flex-1 min-w-0"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </button>
                <a
                  href={doc.url}
                  download={doc.name}
                  className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors shrink-0"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text output preview */}
      {output && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">{t('node.output.textOutput')}</p>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 max-h-60 overflow-y-auto">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{output.slice(0, 2000)}</pre>
            {output.length > 2000 && (
              <p className="text-[10px] text-slate-400 mt-2">{t('node.output.truncated')}</p>
            )}
          </div>
        </div>
      )}

      {!output && documents.length === 0 && (
        <p className="text-sm text-slate-400 py-4 leading-relaxed">{t('node.output.waiting')}</p>
      )}

      {previewFile && flowId && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          title={previewFile.name}
          flowId={flowId}
          filePath={previewFile.path}
          editable
        />
      )}
    </div>
  );
}

export function RightPanel() {
  const [activeTab, setActiveTab] = React.useState('config');
  const [agentSubTab, setAgentSubTab] = React.useState('basic');
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
            <div className="space-y-4">
              {isLocked && (
                <div className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                  {t('panel.right.positionLocked')}
                </div>
              )}
              {selectedNode.type === 'agent' && (
                <>
                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg -mx-1">
                    {[
                      { id: 'basic', label: t('subtab.basic') },
                      { id: 'memory', label: t('subtab.memory') },
                      { id: 'personality', label: t('subtab.personality') },
                      { id: 'knowledge', label: t('subtab.knowledge') },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setAgentSubTab(tab.id)}
                        className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                          agentSubTab === tab.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {agentSubTab === 'basic' && <AgentConfigPanel node={selectedNode} />}
                  {agentSubTab === 'memory' && <MemoryViewer node={selectedNode} />}
                  {agentSubTab === 'personality' && <PersonalityConfig node={selectedNode} />}
                  {agentSubTab === 'knowledge' && <KnowledgeTab />}
                </>
              )}
              {selectedNode.type === 'aiCodingAgent' && (
                <AiCodingAgentConfig
                  nodeId={selectedNode.id}
                  data={selectedNode.data as Record<string, unknown>}
                />
              )}
              {selectedNode.type === 'condition' && (
                <ConditionConfigPanel node={selectedNode} />
              )}
              {selectedNode.type === 'output' && (
                <OutputNodePanel node={selectedNode} flowId={flowId} />
              )}
              {selectedNode.type !== 'agent' && selectedNode.type !== 'aiCodingAgent' && selectedNode.type !== 'condition' && selectedNode.type !== 'output' && (
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
