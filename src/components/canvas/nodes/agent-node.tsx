import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';

export function AgentNode({ id, data, selected }: NodeProps) {
  const label = (data?.label as string) || 'Agent';
  const description = (data?.description as string) || 'Executes autonomous tasks';
  const status = data?.status as string;
  const logs = data?.logs as any[];

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

      {logs && logs.length > 0 && (
        <div className={`mt-2 bg-slate-50 border border-slate-100 rounded-lg p-2 font-mono text-[10px] text-slate-600 space-y-1 transition-all ${status === 'running' ? 'ring-1 ring-indigo-200 ring-offset-1' : ''}`}>
          <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-100 text-[9px] text-slate-400 uppercase tracking-tighter">
            <span>Execution State</span>
            {status === 'running' && <span className="text-indigo-500 animate-pulse">Streaming...</span>}
          </div>
          {logs.slice(-3).map((log: any, i: number) => (
            <div key={`${log.type}-${i}`} className="flex animate-fade-in-up">
              <span className="text-indigo-500 mr-1 font-bold shrink-0">[{log.type}]</span>
              <span className="truncate">{log.content}</span>
            </div>
          ))}
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
