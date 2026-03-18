'use client';

import React, { useState } from 'react';
import { Layers, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAgentLibrary } from '@/hooks/useAgentLibrary';
import { PrimaryNodes } from './left-panel-primary-nodes';
import { PresetNodes } from './left-panel-preset-nodes';
import { AdvancedNodes } from './left-panel-advanced-nodes';
import { IndividualsSection } from './left-panel-individuals';
import { PacksSection } from './left-panel-packs';

export function LeftPanel() {
  const { t } = useUIStore();
  const [search, setSearch] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { individuals, packs, deleteIndividual, deletePack } = useAgentLibrary();

  const onDragStart = (event: React.DragEvent, nodeType: string, agentName?: string, presetId?: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (agentName) event.dataTransfer.setData('application/agent-name', agentName);
    if (presetId) event.dataTransfer.setData('application/preset-id', presetId);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="relative shrink-0 h-full">
      <div
        className="h-full bg-white border-r border-slate-200 flex flex-col overflow-hidden"
        style={{ width: isCollapsed ? 0 : 256, transition: 'width 200ms ease-in-out' }}
      >
        <div className="h-[49px] border-b border-slate-200 flex items-center px-4 gap-2 shrink-0">
          <Layers className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate flex-1">{t('panel.left.title')}</span>
        </div>

        <div className="px-3 py-2 border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('panel.left.searchPlaceholder')}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-slate-400 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <PrimaryNodes search={search} onDragStart={onDragStart} />
          <PresetNodes search={search} onDragStart={onDragStart} />
          <AdvancedNodes search={search} onDragStart={onDragStart} />
          <IndividualsSection individuals={individuals} search={search} onDragStart={onDragStart} onDelete={deleteIndividual} />
          <PacksSection packs={packs} search={search} onDragStart={onDragStart} onDelete={deletePack} />
        </div>
      </div>

      <button
        onClick={() => setIsCollapsed(o => !o)}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full
                   w-4 h-10 z-10 bg-white
                   border border-l-0 border-slate-200 rounded-r-md
                   flex items-center justify-center
                   text-slate-300 hover:text-slate-600 hover:bg-slate-50
                   shadow-[2px_0_6px_rgba(0,0,0,0.06)]
                   transition-colors cursor-pointer"
        title={isCollapsed ? t('panel.left.expand') : t('panel.left.collapse')}
      >
        {isCollapsed
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronLeft  className="w-3 h-3" />}
      </button>
    </div>
  );
}
