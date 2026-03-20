import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeColors, NodeType } from '@/styles/tokens';
import { Bot, Wrench, Lightbulb, User, ArrowRightLeft, Inbox, GitBranch, GitMerge, PlayCircle, CheckCircle2, AlertCircle, BookmarkPlus, Layers, Package, Terminal, Play, AlertTriangle, FastForward, Split } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { NODE_HELP } from '@/lib/presets/help';
import { NodeHelpModal } from './node-help-modal';

export interface BaseNodeProps {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  status?: 'idle' | 'running' | 'success' | 'error' | 'waiting';
  selected?: boolean;
  children?: React.ReactNode;
  onDoubleClick?: () => void;
  hideSourceHandle?: boolean;
  isReference?: boolean;
  onSaveAsAgent?: () => void;
  onRunFromHere?: () => void;
  onRunSingleNode?: (opts?: { force?: boolean }) => Promise<{ needsWarning: boolean; missingLabels: string[] } | void>;
  personalityName?: string;
  personalityRole?: string;
  memoryCount?: number;
}

const ICONS = {
  agent: Bot,
  tool: Wrench,
  skill: Lightbulb,
  human: User,
  io: ArrowRightLeft,
  control: GitBranch,
  system: PlayCircle,
  output: Inbox,
  packed: Package,
  aiCodingAgent: Terminal,
  merge: GitMerge,
  dispatcher: Split,
};

// Map NodeType (used for colors) to the actual node type key used in help/registry
const HELP_TYPE_MAP: Record<string, string> = {
  control: 'condition', system: 'initializer',
};

export function BaseNode({ id, type, label, description, status = 'idle', selected, children, onDoubleClick, hideSourceHandle, isReference, onSaveAsAgent, onRunFromHere, onRunSingleNode, personalityName, personalityRole, memoryCount }: BaseNodeProps) {
  const { removeNode, duplicateNode, toggleNodeLock, nodes, isRunning: isFlowRunning } = useFlowStore();
  const { t } = useUIStore();
  const [showHelp, setShowHelp] = useState(false);
  const [upstreamWarning, setUpstreamWarning] = useState<{ missingLabels: string[] } | null>(null);
  const theme = NodeColors[type] || NodeColors.agent;
  const Icon = ICONS[type] || Bot;
  const helpType = HELP_TYPE_MAP[type] || type;
  const handleRunSingle = async () => {
    if (!onRunSingleNode) return;
    const result = await onRunSingleNode();
    if (result?.needsWarning) {
      setUpstreamWarning({ missingLabels: result.missingLabels });
    }
  };

  const handleRunSingleForce = async () => {
    if (!onRunSingleNode) return;
    setUpstreamWarning(null);
    await onRunSingleNode({ force: true });
  };

  const currentNode = nodes.find(n => n.id === id);
  const isLocked = currentNode ? currentNode.draggable === false : false;
  const isSkeleton = !!(currentNode?.data as Record<string, unknown>)?._skeleton;
  const isAssembleIn = !!(currentNode?.data as Record<string, unknown>)?._assembleIn;

  const isRunning = status === 'running';
  const isError   = status === 'error';
  const isSuccess = status === 'success';
  const isWaiting = status === 'waiting';

  return (
    <div
      className={`group relative w-[260px] rounded-xl bg-white shadow-sm border-2 transition-all
        ${selected ? theme.border : 'border-transparent'}
        ${isWaiting ? 'opacity-60' : ''}
        ${isLocked ? 'nopan' : ''}
        ${isAssembleIn ? 'node-assemble-in' : ''}`}
      onDoubleClick={onDoubleClick}
    >
      {/* ── Inline toolbar (scales naturally with canvas) ── */}
      {selected && (
        <div
          className="absolute -top-11 left-1/2 -translate-x-1/2 z-10"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1 bg-white/95 p-1 rounded-lg shadow-xl shadow-slate-200/50 border border-slate-200 backdrop-blur-md">
            {/* Duplicate */}
            <button
              className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 active:scale-90 rounded-md transition-all"
              onClick={(e) => { e.stopPropagation(); duplicateNode(id); }}
              title={t('node.duplicate')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>

            {/* Lock / Unlock */}
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

            {/* Save as Agent (agent type only) */}
            {type === 'agent' && onSaveAsAgent && (
              <button
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 rounded-md transition-all"
                onClick={(e) => { e.stopPropagation(); onSaveAsAgent(); }}
                title={t('saveAgent.saveAsAgent')}
              >
                <BookmarkPlus className="w-4 h-4" />
              </button>
            )}

            {/* Run single node */}
            {onRunSingleNode && !isFlowRunning && !isRunning && (
              <button
                className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 active:scale-90 rounded-md transition-all"
                onClick={(e) => { e.stopPropagation(); handleRunSingle(); }}
                title={t('node.runSingle')}
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            {/* Continue run (from here to output) */}
            {onRunFromHere && !isFlowRunning && !isRunning && (
              <button
                className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 active:scale-90 rounded-md transition-all"
                onClick={(e) => { e.stopPropagation(); onRunFromHere(); }}
                title={t('node.runFromHere')}
              >
                <FastForward className="w-4 h-4" />
              </button>
            )}

            <div className="w-[1px] h-4 bg-slate-200 self-center mx-0.5" />

            {/* Delete */}
            <button
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-md transition-all"
              onClick={(e) => { e.stopPropagation(); removeNode(id); }}
              title={t('node.delete')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Running glow ring */}
      {isRunning && (
        <div
          className="node-running-ring"
          style={{ '--glow-color': theme.hex, borderColor: `${theme.hex}66` } as React.CSSProperties}
        />
      )}

      <Handle
        type="target"
        position={Position.Left}
        style={{ background: theme.hex, borderColor: 'white' }}
        className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-left-2 !shadow-md transition-transform duration-150"
      />
      {!hideSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: theme.hex, borderColor: 'white' }}
          className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-right-2 !shadow-md transition-transform duration-150"
        />
      )}

      {/* Skeleton overlay — shown when _skeleton is true */}
      {isSkeleton && (
        <div className="node-skeleton-layer" style={{ opacity: 1 }}>
          <div className={`px-4 py-3 border-b border-slate-100 rounded-t-xl ${theme.bg}`}>
            <div className="flex items-center space-x-3">
              <div className="node-skeleton-bar w-[28px] h-[28px] rounded-md shrink-0" />
              <div className="node-skeleton-bar h-[14px] rounded" style={{ width: '85%' }} />
            </div>
          </div>
          <div className="p-4">
            <div className="node-skeleton-bar h-[10px] mb-2 rounded" style={{ width: '90%' }} />
            <div className="node-skeleton-bar h-[10px] mb-2 rounded" style={{ width: '65%' }} />
            <div className="node-skeleton-bar h-[10px] rounded" style={{ width: '40%' }} />
          </div>
        </div>
      )}

      {/* Real content — hidden when skeleton, fades in when skeleton removed */}
      <div className="node-content-layer" style={{ opacity: isSkeleton ? 0 : 1 }}>
        {/* Header */}
        <div className={`px-4 py-3 border-b border-slate-100 flex items-center justify-between rounded-t-xl ${theme.bg}`}>
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className={`p-1.5 rounded-md bg-white shadow-sm shrink-0 ${theme.text}`}>
              <Icon className="w-4 h-4" />
            </div>
            {personalityName ? (
              <div className="relative group/name min-w-0 flex-1">
                <div className="font-semibold text-sm text-slate-800 truncate">
                  {personalityName}{personalityRole ? ` \u00b7 ${personalityRole}` : ''}
                </div>
                {/* Tooltip */}
                <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/name:block pointer-events-none">
                  <div className="bg-slate-800 text-white text-[10px] leading-relaxed rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                    <div className="font-medium">{personalityName}{personalityRole ? ` \u00b7 ${personalityRole}` : ''}</div>
                    {typeof memoryCount === 'number' && <div className="text-slate-300 mt-0.5">{t('memory.tooltipCount').replace('{n}', String(memoryCount))}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="font-semibold text-sm text-slate-800 truncate">{label}</div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isRunning && (
              <Badge variant="outline" className={`border-transparent ${theme.badge} px-2`}>
                <span className="thinking-dot mb-1">.</span>
                <span className="thinking-dot mb-1">.</span>
                <span className="thinking-dot mb-1">.</span>
              </Badge>
            )}
            {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            {isError   && <AlertCircle  className="w-4 h-4 text-rose-500 animate-pulse" />}
            {isReference && (
              <Layers className="w-3.5 h-3.5 text-indigo-400 ml-1" />
            )}
            {isLocked  && (
              <svg className="w-3.5 h-3.5 text-amber-400 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 bg-white/80 rounded-b-xl backdrop-blur-sm">
          {description && (
            <p className="text-xs text-slate-400 mb-2 leading-relaxed">{description}</p>
          )}
          {children}
        </div>
      </div>

      {/* Hover play button (shown when not selected, not running) */}
      {(onRunSingleNode || onRunFromHere) && !isFlowRunning && !isRunning && !selected && (
        <div
          className="absolute -bottom-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {onRunSingleNode && (
            <button
              className="p-1.5 bg-white rounded-full shadow-md border border-slate-200
                text-slate-400 hover:text-emerald-600 hover:border-emerald-300
                active:scale-90 transition-all"
              onClick={(e) => { e.stopPropagation(); handleRunSingle(); }}
              title={t('node.runSingle')}
            >
              <Play className="w-3 h-3" />
            </button>
          )}
          {onRunFromHere && (
            <button
              className="p-1.5 bg-white rounded-full shadow-md border border-slate-200
                text-slate-400 hover:text-teal-600 hover:border-teal-300
                active:scale-90 transition-all"
              onClick={(e) => { e.stopPropagation(); onRunFromHere(); }}
              title={t('node.runFromHere')}
            >
              <FastForward className="w-3 h-3" />
            </button>
          )}
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
                onClick={handleRunSingleForce}
              >
                {t('node.runAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && <NodeHelpModal nodeType={helpType} onClose={() => setShowHelp(false)} />}
    </div>
  );
}
