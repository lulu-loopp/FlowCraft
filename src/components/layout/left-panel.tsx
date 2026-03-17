'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Wrench, Lightbulb, User, ArrowRight, Inbox, GitBranch, PlayCircle, Layers, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

const NODE_TYPES = [
  { type: 'agent',       icon: Bot,           color: 'text-indigo-600', bg: 'bg-indigo-50',  key: 'node.agent'       },
  { type: 'tool',        icon: Wrench,         color: 'text-emerald-600', bg: 'bg-emerald-50', key: 'node.tool'        },
  { type: 'skill',       icon: Lightbulb,      color: 'text-amber-600',  bg: 'bg-amber-50',   key: 'node.skill'       },
  { type: 'human',       icon: User,           color: 'text-rose-600',   bg: 'bg-rose-50',    key: 'node.human'       },
  { type: 'io',          icon: ArrowRight,     color: 'text-sky-600',    bg: 'bg-sky-50',     key: 'node.io'          },
  { type: 'output',      icon: Inbox,          color: 'text-slate-500',  bg: 'bg-slate-50',   key: 'node.output'      },
  { type: 'condition',   icon: GitBranch,      color: 'text-slate-600',  bg: 'bg-slate-100',  key: 'node.condition'   },
  { type: 'initializer', icon: PlayCircle,     color: 'text-violet-600', bg: 'bg-violet-50',  key: 'node.initializer' },
] as const;

interface AgentEntry {
  name: string;
  description: string;
}

export function LeftPanel() {
  const { t } = useUIStore();
  const [search, setSearch] = useState('');
  const [nodesOpen, setNodesOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [agents, setAgents] = useState<AgentEntry[]>([]);

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data?.agents)) setAgents(data.agents);
      })
      .catch(() => {});
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: string, agentName?: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (agentName) event.dataTransfer.setData('application/agent-name', agentName);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredNodes = NODE_TYPES.filter(n =>
    !search ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t(n.key as any).toLowerCase().includes(search.toLowerCase()) ||
    n.type.includes(search.toLowerCase())
  );

  const filteredAgents = agents.filter(a =>
    !search || a.name.includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase())
  );

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
                <p className="text-xs text-slate-400 px-3 py-3 text-center">{t('panel.left.noMatchingNodes')}</p>
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
                    <span className="text-sm font-medium text-slate-700">{t(node.key as import('@/lib/i18n').TranslationKey)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-1">
            <button
              className="w-full flex items-center justify-between px-1 py-2 border-t border-slate-100 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setAgentsOpen(o => !o)}
            >
              <span>{t('panel.left.savedAgents')}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${agentsOpen ? '' : '-rotate-90'}`} />
            </button>
            {agentsOpen && (
              filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-5 gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                  <Bot className="w-5 h-5 text-slate-300" />
                  <p className="text-xs text-slate-400">{t('panel.left.noAgents')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredAgents.map(agent => (
                    <div
                      key={agent.name}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:bg-indigo-50 hover:border-indigo-100 hover:-translate-y-px transition-all cursor-grab active:cursor-grabbing active:scale-[0.98]"
                      draggable
                      onDragStart={(e) => onDragStart(e, 'agent', agent.name)}
                      title={agent.description}
                    >
                      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{agent.name}</p>
                        {agent.description && (
                          <p className="text-xs text-slate-400 truncate">{agent.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
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
