import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';

export function AgentNode({ id, data, selected }: NodeProps) {
  const label = (data?.label as string) || 'Agent';
  const description = (data?.description as string) || 'Executes autonomous tasks';
  const status = data?.status as string;
  const logs = data?.logs as any[];
  const currentToken = data?.currentToken as string;
  const currentOutput = data?.currentOutput as string;

  return (
    <BaseNode
      id={id}
      type="agent"
      label={label}
      description={description}
      status={status as any}
      selected={selected}
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Search Tool</span>
        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Python Env</span>
      </div>

      {/* Streaming token display while running */}
      {status === 'running' && currentToken && (
        <div className="mt-2 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg p-2 font-mono max-h-20 overflow-hidden">
          <div className="text-indigo-400 text-[9px] uppercase tracking-wider mb-1">Thinking...</div>
          <div className="line-clamp-3">
            {currentToken}
            <span className="inline-block w-1.5 h-3 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
          </div>
        </div>
      )}

      {/* Step logs while running (fallback when no token yet) */}
      {status === 'running' && !currentToken && logs && logs.length > 0 && (
        <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-2 font-mono text-[10px] text-slate-600 space-y-1 ring-1 ring-indigo-200 ring-offset-1">
          <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-100 text-[9px] text-slate-400 uppercase tracking-tighter">
            <span>Execution State</span>
            <span className="text-indigo-500 animate-pulse">Streaming...</span>
          </div>
          {logs.slice(-3).map((log: any, i: number) => (
            <div key={`${log.type}-${i}`} className="flex animate-fade-in-up">
              <span className="text-indigo-600 mr-1 font-bold shrink-0">[{log.type}]</span>
              <span className="truncate">{log.content}</span>
            </div>
          ))}
        </div>
      )}

      {/* Output summary after completion */}
      {status === 'success' && currentOutput && (
        <div className="mt-2 text-xs bg-emerald-50 border border-emerald-100 rounded-lg p-2 max-h-16 overflow-hidden">
          <div className="text-emerald-500 text-[9px] uppercase tracking-wider mb-1">Output</div>
          <div className="line-clamp-3 text-slate-700">
            {currentOutput.slice(0, 200)}
            {currentOutput.length > 200 && '...'}
          </div>
        </div>
      )}

      {status === 'running' && (
        <div className="w-full bg-slate-100 rounded-full h-1 mt-3 overflow-hidden relative">
          <div className="node-loading-bar absolute inset-y-0 left-0 w-1/3 bg-indigo-500 rounded-full" />
        </div>
      )}
    </BaseNode>
  );
}
