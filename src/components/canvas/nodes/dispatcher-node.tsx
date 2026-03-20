import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps } from '@xyflow/react';
import { Split, ChevronRight, X } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { BaseNode } from './base-node';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { useRunFromNode } from '@/hooks/useRunFromNode';

function DispatchDetailModal({ isOpen, onClose, targetLabel, content }: {
  isOpen: boolean; onClose: () => void; targetLabel: string; content: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  if (!isOpen || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Split className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-semibold text-slate-800">{targetLabel}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 prose-node text-slate-700">
          <MarkdownRenderer>{content}</MarkdownRenderer>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function DispatcherNode({ id, data, selected }: NodeProps) {
  const { edges, nodes } = useFlowStore();
  const { t } = useUIStore();
  const runCtx = useRunFromNode();
  const [viewTarget, setViewTarget] = useState<{ label: string; content: string } | null>(null);

  const status = data?.status as 'idle' | 'running' | 'success' | 'error' | 'waiting' | undefined;
  const label = (data?.label as string) || t('node.dispatcher');

  const downstreamEdges = edges.filter(e => e.source === id);
  const targets = downstreamEdges.map(e => {
    const targetNode = nodes.find(n => n.id === e.target);
    return {
      id: e.target,
      label: (targetNode?.data?.label as string) || e.target,
    };
  });

  const dispatchResults = data?.dispatchResults as Record<string, string> | undefined;

  return (
    <>
      <BaseNode
        id={id}
        type="dispatcher"
        label={label}
        description={t('node.dispatcher.connectTargets')}
        status={status}
        selected={selected}
        onRunFromHere={runCtx ? () => runCtx.runFromNode(id) : undefined}
        onRunSingleNode={runCtx ? (opts) => runCtx.runSingleNode(id, opts) : undefined}
      >
        {targets.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
              {t('node.dispatcher.targets')} ({targets.length})
            </p>
            {targets.map((target, i) => {
              const hasResult = !!dispatchResults?.[target.id];
              return (
                <button
                  key={target.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasResult) setViewTarget({ label: target.label, content: dispatchResults![target.id] });
                  }}
                  className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-left transition-colors
                    ${hasResult ? 'hover:bg-teal-50 cursor-pointer' : 'cursor-default'}
                  `}
                >
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className={`text-xs flex-1 truncate ${hasResult ? 'text-teal-700 font-medium' : 'text-slate-500'}`}>
                    {target.label}
                  </span>
                  {hasResult && <ChevronRight className="w-3 h-3 text-teal-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {status === 'success' && dispatchResults && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-100">
            <p className="text-[10px] text-emerald-600 font-medium">
              {t('node.dispatcher.dispatched')}
            </p>
          </div>
        )}
      </BaseNode>

      {viewTarget && (
        <DispatchDetailModal
          isOpen={!!viewTarget}
          onClose={() => setViewTarget(null)}
          targetLabel={viewTarget.label}
          content={viewTarget.content}
        />
      )}
    </>
  );
}
