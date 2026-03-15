import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeColors, NodeType } from '@/styles/tokens';
import { Bot, Wrench, Lightbulb, User, ArrowRightLeft, GitBranch, PlayCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFlowStore } from '@/store/flowStore';

export interface BaseNodeProps {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  status?: 'idle' | 'running' | 'success' | 'error' | 'waiting';
  selected?: boolean;
  children?: React.ReactNode;
  onDoubleClick?: () => void;
}

const ICONS = {
  agent: Bot,
  tool: Wrench,
  skill: Lightbulb,
  human: User,
  io: ArrowRightLeft,
  control: GitBranch,
  system: PlayCircle,
};

export function BaseNode({ id, type, label, description, status = 'idle', selected, children, onDoubleClick }: BaseNodeProps) {
  const { removeNode, duplicateNode, toggleNodeLock, nodes } = useFlowStore();
  const theme = NodeColors[type] || NodeColors.agent;
  const Icon = ICONS[type] || Bot;

  const currentNode = nodes.find(n => n.id === id);
  const isLocked = currentNode ? currentNode.draggable === false : false;

  const isRunning = status === 'running';
  const isError   = status === 'error';
  const isSuccess = status === 'success';
  const isWaiting = status === 'waiting';

  return (
    <div
      className={`relative w-[260px] rounded-xl bg-white shadow-sm border-2 transition-all
        ${selected ? theme.border : 'border-transparent'}
        ${isWaiting ? 'opacity-60' : ''}
        ${isLocked ? 'nopan' : ''}`}
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
              title="Duplicate"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>

            {/* Lock / Unlock */}
            <button
              className={`p-2 rounded-md transition-all active:scale-90 ${isLocked ? 'text-amber-500 bg-amber-50' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-50'}`}
              onClick={(e) => { e.stopPropagation(); toggleNodeLock(id); }}
              title={isLocked ? 'Unlock Position' : 'Lock Position'}
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

            {/* Delete */}
            <button
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-md transition-all"
              onClick={(e) => { e.stopPropagation(); removeNode(id); }}
              title="Delete"
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
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: theme.hex, borderColor: 'white' }}
        className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-right-2 !shadow-md transition-transform duration-150"
      />

      {/* Header */}
      <div className={`px-4 py-3 border-b border-slate-100 flex items-center justify-between rounded-t-xl ${theme.bg}`}>
        <div className="flex items-center space-x-3">
          <div className={`p-1.5 rounded-md bg-white shadow-sm ${theme.text}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="font-semibold text-sm text-slate-800">{label}</div>
        </div>

        <div className="flex items-center">
          {isRunning && (
            <Badge variant="outline" className={`border-transparent ${theme.badge} px-2`}>
              <span className="thinking-dot mb-1">.</span>
              <span className="thinking-dot mb-1">.</span>
              <span className="thinking-dot mb-1">.</span>
            </Badge>
          )}
          {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {isError   && <AlertCircle  className="w-4 h-4 text-rose-500 animate-pulse" />}
          {isLocked  && (
            <svg className="w-3.5 h-3.5 text-amber-400 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 bg-white/80 rounded-b-xl backdrop-blur-sm">
        {description && <p className="text-xs text-slate-500 mb-2">{description}</p>}
        {children}
      </div>
    </div>
  );
}
