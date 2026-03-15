'use client';

import React from 'react';
import { Panel } from '../ui/panel';
import { ChevronUp, ChevronDown, Terminal, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs } from '../ui/tabs';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';

const LOG_TYPE_STYLE: Record<string, string> = {
  think:   'bg-teal-100 text-teal-600',
  act:     'bg-teal-100 text-teal-700',
  observe: 'bg-amber-100 text-amber-700',
  system:  'bg-slate-100 text-slate-500',
};

export function BottomPanel() {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('execution');
  const { globalLogs, clearLogs } = useFlowStore();
  const { t } = useUIStore();

  const logsEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalLogs.length]);

  const tabs = [
    { id: 'execution', label: t('panel.bottom.logs') },
    { id: 'terminal',  label: t('panel.bottom.terminal') },
  ];

  return (
    <Panel
      className={`absolute bottom-4 flex flex-col transition-all duration-300 ${isExpanded ? 'h-64' : 'h-14'}`}
      style={{
        left: 'var(--panel-left-offset)',
        right: 'var(--panel-right-offset)',
        zIndex: 'var(--z-panel)',
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="bg-transparent w-52" />

        <div className="flex items-center gap-1">
          {activeTab === 'execution' && globalLogs.length > 0 && isExpanded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearLogs}
              title={t('panel.bottom.clearLogs')}
              className="h-7 w-7"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7"
          >
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-slate-400" />
              : <ChevronUp   className="w-4 h-4 text-slate-400" />}
          </Button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="flex-1 overflow-hidden border-t border-slate-100/60">
          {activeTab === 'execution' ? (
            <div className="h-full overflow-y-auto px-3 py-2 space-y-px">
              {globalLogs.length === 0 && (
                <p className="text-xs text-slate-400 text-center mt-8">
                  {t('panel.bottom.noLogs')}
                </p>
              )}
              {globalLogs.map((log) => (
                <div
                  key={log.id}
                  className="group flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50/80 transition-colors animate-fade-in-up"
                >
                  <span className="shrink-0 text-[10px] text-slate-400 tabular-nums font-mono pt-0.5 w-[52px]">
                    {log.timestamp}
                  </span>
                  <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${LOG_TYPE_STYLE[log.type] ?? LOG_TYPE_STYLE.system}`}>
                    {log.type}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-700 max-w-[80px] truncate">
                    {log.nodeName}
                  </span>
                  <span className="shrink-0 text-slate-300 text-xs leading-5">›</span>
                  <span className="text-xs text-slate-500 leading-relaxed break-all">
                    {log.content}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          ) : (
            <div className="h-full overflow-y-auto bg-slate-950/[0.02] rounded-b-xl px-4 py-3 font-mono text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{t('panel.bottom.terminalReady')}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
