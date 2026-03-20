import React from 'react';
import { createPortal } from 'react-dom';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { GitMerge, CheckCircle2, AlertCircle, Play, FastForward, AlertTriangle, Copy, Maximize2, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { useRunFromNode } from '@/hooks/useRunFromNode';

const HANDLE_COLOR = '#a855f7';

function MergeOutputModal({ isOpen, onClose, content }: { isOpen: boolean; onClose: () => void; content: string }) {
  const [mounted, setMounted] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  if (!isOpen || !mounted) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-slate-800">Merged Output</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 prose-node text-slate-700">
          <MarkdownRenderer>{content}</MarkdownRenderer>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function MergeNode({ id, data, selected }: NodeProps) {
  const { edges, isRunning: isFlowRunning } = useFlowStore();
  const { t } = useUIStore();
  const runCtx = useRunFromNode();
  const [upstreamWarning, setUpstreamWarning] = React.useState<{ missingLabels: string[] } | null>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleRunSingle = async () => {
    if (!runCtx) return;
    const result = await runCtx.runSingleNode(id);
    if (result?.needsWarning) {
      setUpstreamWarning({ missingLabels: result.missingLabels });
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const output = (data?.currentOutput as string) || '';
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const upstreamCount = edges.filter(e => e.target === id).length;

  const status = data?.status as string | undefined;
  const currentOutput = (data?.currentOutput as string) || '';
  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isWaiting = status === 'waiting';
  const isSkipped = status === 'skipped';

  return (
    <>
      <div
        className={`group relative w-[220px] rounded-xl bg-white shadow-sm border-2 transition-all
          ${selected ? 'border-purple-500' : 'border-transparent'}
          ${isWaiting || isSkipped ? 'opacity-60' : ''}`}
      >
        {/* Running ring */}
        {isRunning && (
          <div
            className="node-running-ring"
            style={{ '--glow-color': HANDLE_COLOR, borderColor: `${HANDLE_COLOR}66` } as React.CSSProperties}
          />
        )}

        {/* Left target handle */}
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: HANDLE_COLOR, borderColor: 'white' }}
          className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-left-2 !shadow-md transition-transform duration-150"
        />

        {/* Right source handle */}
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: HANDLE_COLOR, borderColor: 'white' }}
          className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-right-2 !shadow-md transition-transform duration-150"
        />

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 rounded-t-xl bg-purple-50">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-1.5 rounded-md bg-white shadow-sm shrink-0 text-purple-700">
              <GitMerge className="w-4 h-4" />
            </div>
            <div className="font-semibold text-sm text-slate-800 truncate">
              {(data?.label as string) || 'Merge'}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isRunning && (
              <Badge variant="outline" className="border-transparent bg-purple-100 text-purple-700 px-2">
                <span className="thinking-dot mb-1">.</span>
                <span className="thinking-dot mb-1">.</span>
                <span className="thinking-dot mb-1">.</span>
              </Badge>
            )}
            {isSuccess && <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />}
            {isError && <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {isError ? (
            <span className="text-xs text-rose-500">{(data?.error as string) || 'Error'}</span>
          ) : isSuccess && currentOutput ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-slate-400">
                  {t('node.merge')} · {upstreamCount} 路输入
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className="p-1 text-slate-300 hover:text-purple-500 transition-colors rounded"
                    title="Copy"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                    className="p-1 text-slate-300 hover:text-purple-500 transition-colors rounded"
                    title="View full"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 max-h-24 overflow-y-auto">
                <div className="prose-node text-slate-700 text-xs">
                  <MarkdownRenderer>{currentOutput.slice(0, 300)}</MarkdownRenderer>
                  {currentOutput.length > 300 && (
                    <p className="text-slate-400 text-[10px] mt-1">Double-click to view full…</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-500">等待 {upstreamCount} 路输入</span>
          )}
        </div>

        {/* Hover play buttons */}
        {runCtx && !isFlowRunning && !isRunning && !selected && (
          <div
            className="absolute -bottom-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              className="p-1.5 bg-white rounded-full shadow-md border border-slate-200
                text-slate-400 hover:text-emerald-600 hover:border-emerald-300
                active:scale-90 transition-all"
              onClick={(e) => { e.stopPropagation(); handleRunSingle(); }}
              title={t('node.runSingle')}
            >
              <Play className="w-3 h-3" />
            </button>
            <button
              className="p-1.5 bg-white rounded-full shadow-md border border-slate-200
                text-slate-400 hover:text-teal-600 hover:border-teal-300
                active:scale-90 transition-all"
              onClick={(e) => { e.stopPropagation(); runCtx.runFromNode(id); }}
              title={t('node.runFromHere')}
            >
              <FastForward className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Upstream missing warning popup */}
        {upstreamWarning && (
          <div
            className="absolute -bottom-[88px] left-1/2 -translate-x-1/2 z-50 w-[240px]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-lg shadow-xl border border-amber-200 p-3">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {t('node.upstreamMissing').replace('{nodes}', upstreamWarning.missingLabels.join(', '))}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  className="text-[11px] px-2 py-1 text-slate-500 hover:text-slate-700 rounded transition-colors"
                  onClick={() => setUpstreamWarning(null)}
                >
                  {t('node.cancel')}
                </button>
                <button
                  className="text-[11px] px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors"
                  onClick={async () => { setUpstreamWarning(null); if (runCtx) await runCtx.runSingleNode(id, { force: true }); }}
                >
                  {t('node.runAnyway')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <MergeOutputModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          content={currentOutput}
        />
      )}
    </>
  );
}
