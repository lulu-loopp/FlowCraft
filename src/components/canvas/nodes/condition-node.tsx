import React from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { GitBranch, CheckCircle2, AlertCircle } from 'lucide-react';
import { NodeColors } from '@/styles/tokens';
import { Badge } from '@/components/ui/badge';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';

type Mode = 'natural' | 'expression';

export function ConditionNode({ id, data, selected }: NodeProps) {
  const { removeNode, duplicateNode, toggleNodeLock, nodes, updateNodeData } = useFlowStore();
  const { t } = useUIStore();
  const theme = NodeColors.control;

  const currentNode = nodes.find((n) => n.id === id);
  const isLocked = currentNode ? currentNode.draggable === false : false;
  const status = data?.status as string | undefined;
  const mode: Mode = (data?.conditionMode as Mode) || 'natural';
  const value = (data?.conditionValue as string) || '';
  const [localValue, setLocalValue] = React.useState(value);
  const composingRef = React.useRef(false);

  React.useEffect(() => {
    if (!composingRef.current) setLocalValue(value);
  }, [value]);

  const conditionResult = data?.conditionResult as 'true' | 'false' | undefined;
  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isWaiting = status === 'waiting';
  const isSkipped = status === 'skipped';

  const setMode = (m: Mode) => updateNodeData(id, 'conditionMode', m);
  const setValue = (v: string) => updateNodeData(id, 'conditionValue', v);

  const placeholder =
    mode === 'natural' ? t('node.condition.placeholder') : t('node.condition.exprPlaceholder');

  return (
    <div
      className={`relative w-[260px] rounded-xl bg-white shadow-sm border-2 transition-all
        ${selected ? theme.border : 'border-transparent'}
        ${isWaiting || isSkipped ? 'opacity-60' : ''}
        ${isLocked ? 'nopan' : ''}`}
    >
      {/* Inline toolbar */}
      {selected && (
        <div
          className="absolute -top-11 left-1/2 -translate-x-1/2 z-10"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1 bg-white/95 p-1 rounded-lg shadow-xl shadow-slate-200/50 border border-slate-200 backdrop-blur-md">
            <button
              className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 active:scale-90 rounded-md transition-all"
              onClick={(e) => { e.stopPropagation(); duplicateNode(id); }}
              title={t('node.duplicate')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>
            <button
              className={`p-2 rounded-md transition-all active:scale-90 ${isLocked ? 'text-amber-500 bg-amber-50' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-50'}`}
              onClick={(e) => { e.stopPropagation(); toggleNodeLock(id); }}
              title={isLocked ? t('node.unlockPosition') : t('node.lockPosition')}
            >
              {isLocked ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                </svg>
              )}
            </button>
            <div className="w-[1px] h-4 bg-slate-200 self-center mx-0.5" />
            <button
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-md transition-all"
              onClick={(e) => { e.stopPropagation(); removeNode(id); }}
              title={t('node.delete')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

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

      {/* Header */}
      <div className={`px-4 py-3 border-b border-slate-100 flex items-center justify-between rounded-t-xl ${theme.bg}`}>
        <div className="flex items-center space-x-3">
          <div className={`p-1.5 rounded-md bg-white shadow-sm ${theme.text}`}>
            <GitBranch className="w-4 h-4" />
          </div>
          <div className="font-semibold text-sm text-slate-800">
            {(data?.label as string) || 'Condition'}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode toggle */}
          <div className="flex bg-white rounded-md border border-slate-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setMode('natural')}
              className={`px-2 py-1 transition-colors ${
                mode === 'natural'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t('node.condition.natural')}
            </button>
            <button
              onClick={() => setMode('expression')}
              className={`px-2 py-1 transition-colors ${
                mode === 'expression'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t('node.condition.expression')}
            </button>
          </div>

          {isRunning && (
            <Badge variant="outline" className={`border-transparent ${theme.badge} px-2`}>
              <span className="thinking-dot mb-1">.</span>
              <span className="thinking-dot mb-1">.</span>
              <span className="thinking-dot mb-1">.</span>
            </Badge>
          )}
          {isSuccess && conditionResult && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              conditionResult === 'true'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-600'
            }`}>
              {conditionResult === 'true' ? '✓ true' : '✗ false'}
            </span>
          )}
          {isSuccess && !conditionResult && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {isError && <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 bg-white/80 rounded-b-xl backdrop-blur-sm">
        <textarea
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            if (!composingRef.current) setValue(e.target.value);
          }}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            const val = (e.target as HTMLTextAreaElement).value;
            setLocalValue(val);
            setValue(val);
          }}
          placeholder={placeholder}
          rows={3}
          className={`w-full text-xs border border-slate-200 rounded-lg p-2.5 resize-none
                      focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent
                      placeholder:text-slate-400 bg-white
                      ${mode === 'expression' ? 'font-mono' : ''}`}
        />
        {/* True / False labels */}
        <div className="flex justify-end gap-3 mt-2 text-xs font-medium">
          <span className="text-emerald-600">✓ true</span>
          <span className="text-rose-500">✗ false</span>
        </div>
      </div>
    </div>
  );
}
