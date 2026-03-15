'use client';

import React from 'react';
import { Panel } from '../ui/panel';
import { ChevronUp, ChevronDown, Terminal, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs } from '../ui/tabs';
import { useFlowStore } from '@/store/flowStore';

const LOG_TYPE_STYLE: Record<string, string> = {
  think:   'bg-indigo-100 text-indigo-600',
  act:     'bg-emerald-100 text-emerald-700',
  observe: 'bg-amber-100  text-amber-700',
  system:  'bg-slate-100  text-slate-500',
};

export function BottomPanel() {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('execution');
  const { globalLogs, clearLogs } = useFlowStore();

  const logsEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalLogs.length]);

  const tabs = [
    { id: 'execution', label: 'Execution Logs' },
    { id: 'terminal',  label: 'Terminal' },
  ];

  return (
    <Panel
      className={`absolute bottom-4 left-[288px] right-[340px] z-40 flex flex-col transition-all duration-300 ${
        isExpanded ? 'h-64' : 'h-14'
      }`}
    >
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-4 h-14 flex-shrink-0">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="bg-transparent w-56" />

        <div className="flex items-center gap-1">
          {activeTab === 'execution' && globalLogs.length > 0 && isExpanded && (
            <Button variant="ghost" size="icon" onClick={clearLogs} title="Clear logs">
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ── Content ── */}
      {isExpanded && (
        <div className="flex-1 overflow-hidden border-t border-slate-100/60">
          {activeTab === 'execution' ? (
            <div className="h-full overflow-y-auto px-3 py-2 space-y-px">
              {globalLogs.length === 0 && (
                <p className="text-xs text-slate-400 text-center mt-8">No logs yet. Run a flow to see output.</p>
              )}
              {globalLogs.map((log) => (
                <div
                  key={log.id}
                  className="group flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50/80 transition-colors animate-fade-in-up"
                >
                  {/* Timestamp */}
                  <span className="shrink-0 text-[10px] text-slate-400 tabular-nums font-mono pt-0.5 w-[52px]">
                    {log.timestamp}
                  </span>

                  {/* Type badge */}
                  <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${LOG_TYPE_STYLE[log.type] ?? LOG_TYPE_STYLE.system}`}>
                    {log.type}
                  </span>

                  {/* Node name */}
                  <span className="shrink-0 text-xs font-semibold text-slate-700 max-w-[80px] truncate">
                    {log.nodeName}
                  </span>

                  {/* Separator */}
                  <span className="shrink-0 text-slate-300 text-xs leading-5">›</span>

                  {/* Content */}
                  <span className="text-xs text-slate-500 leading-relaxed break-all">
                    {log.content}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          ) : (
            <div className="h-full overflow-y-auto bg-slate-950/[0.03] rounded-b-xl px-4 py-3 font-mono text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Terminal ready.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
