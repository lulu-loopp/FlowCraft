'use client';

import React, { useState } from 'react';
import { Bot, Wrench, Lightbulb, User, ArrowRightLeft, GitBranch, PlayCircle, Layers, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

const NODE_TYPES = [
  { type: 'agent',       icon: Bot,           color: 'text-indigo-600', bg: 'bg-indigo-50',  key: 'node.agent'       },
  { type: 'tool',        icon: Wrench,         color: 'text-emerald-600', bg: 'bg-emerald-50', key: 'node.tool'        },
  { type: 'skill',       icon: Lightbulb,      color: 'text-amber-600',  bg: 'bg-amber-50',   key: 'node.skill'       },
  { type: 'human',       icon: User,           color: 'text-rose-600',   bg: 'bg-rose-50',    key: 'node.human'       },
  { type: 'io',          icon: ArrowRightLeft, color: 'text-sky-600',    bg: 'bg-sky-50',     key: 'node.io'          },
  { type: 'condition',   icon: GitBranch,      color: 'text-slate-600',  bg: 'bg-slate-100',  key: 'node.condition'   },
  { type: 'initializer', icon: PlayCircle,     color: 'text-violet-600', bg: 'bg-violet-50',  key: 'node.initializer' },
] as const;

export function LeftPanel() {
  const { t } = useUIStore();
  const [search, setSearch] = useState('');
  const [nodesOpen, setNodesOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredNodes = NODE_TYPES.filter(n =>
    !search ||
    t(n.key as any).toLowerCase().includes(search.toLowerCase()) ||
    n.type.includes(search.toLowerCase())
  );

  return (
    // Single element — width transition animates between collapsed/expanded
    <div
      className="bg-white border-r border-slate-200 flex flex-col overflow-hidden shrink-0"
      style={{ width: isCollapsed ? 36 : 256, transition: 'width 200ms ease-in-out' }}
    >
      {/* Header — always visible */}
      <div className="h-[49px] border-b border-slate-200 flex items-center shrink-0 px-2 gap-2">
        {/* Title — fades out when collapsing */}
        <div
          className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden"
          style={{ opacity: isCollapsed ? 0 : 1, transition: 'opacity 150ms ease-in-out' }}
        >
          <Layers className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate">{t('panel.left.title')}</span>
        </div>
        {/* Collapse/expand button */}
        <button
          onClick={() => setIsCollapsed(o => !o)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft  className="w-4 h-4" />}
        </button>
      </div>

      {/* Scrollable content — hidden when collapsed */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ opacity: isCollapsed ? 0 : 1, pointerEvents: isCollapsed ? 'none' : 'auto', transition: 'opacity 120ms ease-in-out' }}
      >
        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search nodes..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-slate-400 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {/* Node Types section */}
          <button
            className="w-full flex items-center justify-between px-1 py-2 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => setNodesOpen(o => !o)}
          >
            <span>{t('panel.left.nodeTypes')}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${nodesOpen ? '' : '-rotate-90'}`} />
          </button>

          {nodesOpen && (
            <div className="space-y-1 mb-1">
              {filteredNodes.length === 0 ? (
                <p className="text-xs text-slate-400 px-3 py-3 text-center">No matching nodes</p>
              ) : filteredNodes.map((node) => {
                const Icon = node.icon;
                return (
                  <div
                    key={node.type}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-50 hover:border-slate-100 hover:-translate-y-px transition-all cursor-grab active:cursor-grabbing active:scale-[0.98]"
                    draggable
                    onDragStart={(e) => onDragStart(e, node.type)}
                  >
                    <div className={`p-1.5 rounded-lg ${node.bg} ${node.color} shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{t(node.key as any)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Saved agents section */}
          <div className="pt-1">
            <button
              className="w-full flex items-center justify-between px-1 py-2 border-t border-slate-100 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setAgentsOpen(o => !o)}
            >
              <span>{t('panel.left.savedAgents')}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${agentsOpen ? '' : '-rotate-90'}`} />
            </button>
            {agentsOpen && (
              <div className="flex flex-col items-center justify-center py-5 gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <Bot className="w-5 h-5 text-slate-300" />
                <p className="text-xs text-slate-400">{t('panel.left.noAgents')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
