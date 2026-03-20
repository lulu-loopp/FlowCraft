import React, { useState } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { GitBranch, CheckCircle2, AlertCircle, HelpCircle, AlertTriangle, RefreshCw, Play, FastForward } from 'lucide-react';
import { NodeColors } from '@/styles/tokens';
import { Badge } from '@/components/ui/badge';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { useRunFromNode } from '@/hooks/useRunFromNode';
import { NodeHelpModal } from './node-help-modal';
import { ConditionNodeToolbar } from './condition-node-toolbar';
import { ConditionNodeBody } from './condition-node-body';
import type { TranslationKey } from '@/lib/i18n';

type Mode = 'natural' | 'expression';

export function ConditionNode({ id, data, selected }: NodeProps) {
  const { nodes, updateNodeData, isRunning: isFlowRunning } = useFlowStore();
  const { t } = useUIStore();
  const runCtx = useRunFromNode();
  const [showHelp, setShowHelp] = useState(false);
  const [upstreamWarning, setUpstreamWarning] = useState<{ missingLabels: string[] } | null>(null);

  const handleRunSingle = async () => {
    if (!runCtx) return;
    const result = await runCtx.runSingleNode(id);
    if (result?.needsWarning) {
      setUpstreamWarning({ missingLabels: result.missingLabels });
    }
  };
  const theme = NodeColors.control;

  const currentNode = nodes.find((n) => n.id === id);
  const isLocked = currentNode ? currentNode.draggable === false : false;
  const status = data?.status as string | undefined;
  const mode: Mode = (data?.conditionMode as Mode) || 'natural';
  const conditionResult = data?.conditionResult as 'true' | 'false' | undefined;
  const loopCount = data?.loopCount as number | undefined;
  const maxLoop = (data?.maxLoopIterations as number) || 10;
  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isWarning = status === 'warning';
  const isWaiting = status === 'waiting';
  const isSkipped = status === 'skipped';

  return (
    <div
      className={`group relative w-[320px] rounded-xl bg-white shadow-sm border-2 transition-all
        ${isWarning ? 'border-amber-400' : selected ? theme.border : 'border-transparent'}
        ${isWaiting || isSkipped ? 'opacity-60' : ''}
        ${isLocked ? 'nopan' : ''}`}
    >
      {selected && <ConditionNodeToolbar id={id} isLocked={isLocked} />}

      {/* Running ring */}
      {isRunning && (
        <div
          className="node-running-ring"
          style={{ '--glow-color': theme.hex, borderColor: `${theme.hex}66` } as React.CSSProperties}
        />
      )}

      {/* Left target handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: theme.hex, borderColor: 'white' }}
        className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-left-2 !shadow-md transition-transform duration-150"
      />

      {/* True handle — top-right */}
      <Handle
        id="true-handle"
        type="source"
        position={Position.Right}
        style={{ background: '#10b981', borderColor: 'white', top: '35%' }}
        className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-right-2 !shadow-md transition-transform duration-150"
      />

      {/* False handle — bottom-right */}
      <Handle
        id="false-handle"
        type="source"
        position={Position.Right}
        style={{ background: '#ef4444', borderColor: 'white', top: '65%' }}
        className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-right-2 !shadow-md transition-transform duration-150"
      />

      {/* Handle labels */}
      <div className="absolute right-[-52px] text-[10px] font-semibold text-emerald-600" style={{ top: 'calc(35% - 7px)' }}>true</div>
      <div className="absolute right-[-52px] text-[10px] font-semibold text-rose-500" style={{ top: 'calc(65% - 7px)' }}>false</div>

      {/* Header */}
      <div className={`px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 rounded-t-xl ${theme.bg}`}>
        <div className="flex items-center space-x-3 min-w-0">
          <div className={`p-1.5 rounded-md bg-white shadow-sm shrink-0 ${theme.text}`}>
            <GitBranch className="w-4 h-4" />
          </div>
          <div className="font-semibold text-sm text-slate-800 truncate">
            {(data?.label as string) || 'Condition'}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowHelp(true); }}
            className="w-5 h-5 rounded-full bg-white/60 hover:bg-white text-slate-300 hover:text-slate-500
              flex items-center justify-center shrink-0 transition-all duration-200
              opacity-0 group-hover:opacity-100"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
          {/* Mode toggle */}
          <div className="flex bg-white rounded-md border border-slate-200 overflow-hidden text-xs font-medium shrink-0">
            <button
              onClick={() => updateNodeData(id, 'conditionMode', 'natural')}
              className={`px-2 py-1 transition-colors ${
                mode === 'natural' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t('node.condition.natural')}
            </button>
            <button
              onClick={() => updateNodeData(id, 'conditionMode', 'expression')}
              className={`px-2 py-1 transition-colors ${
                mode === 'expression' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t('node.condition.expression')}
            </button>
          </div>

          {/* Status badges */}
          {isRunning && (
            <Badge variant="outline" className={`border-transparent ${theme.badge} px-2`}>
              <span className="thinking-dot mb-1">.</span>
              <span className="thinking-dot mb-1">.</span>
              <span className="thinking-dot mb-1">.</span>
            </Badge>
          )}
          {isSuccess && conditionResult && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
              conditionResult === 'true'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-600'
            }`}>
              {conditionResult === 'true' ? '✓ true' : '✗ false'}
            </span>
          )}
          {isWarning && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
          {isSuccess && !conditionResult && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          {isError && <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />}
        </div>
      </div>

      {/* Body */}
      <ConditionNodeBody id={id} data={data} mode={mode} />

      {/* Loop counter & warning */}
      {loopCount != null && loopCount > 0 && (
        <div className={`px-4 pb-3 flex items-center gap-1.5 text-xs font-medium ${
          isWarning ? 'text-amber-600' : 'text-slate-500'
        }`}>
          {isWarning ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              {(t('node.condition.loopWarning' as TranslationKey) as string).replace('{count}', String(loopCount))}
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              {(t('node.condition.loopCount' as TranslationKey) as string)
                .replace('{current}', String(loopCount))
                .replace('{max}', String(maxLoop))}
            </>
          )}
        </div>
      )}

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

      {showHelp && <NodeHelpModal nodeType="condition" onClose={() => setShowHelp(false)} />}
    </div>
  );
}
