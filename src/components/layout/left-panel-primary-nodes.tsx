'use client';

import React, { useState } from 'react';
import { Bot, User, ArrowRight, Inbox, GitBranch, GitMerge, PlayCircle, Terminal, Split, HelpCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { NODE_HELP } from '@/lib/presets/help';
import { NodeHelpModal } from '@/components/canvas/nodes/node-help-modal';
import type { TranslationKey } from '@/lib/i18n';

const PRIMARY_NODES = [
  { type: 'agent',         icon: Bot,        color: 'text-indigo-600', bg: 'bg-indigo-50',  key: 'node.agent',         descKey: 'node.agent.desc'         },
  { type: 'aiCodingAgent', icon: Terminal,    color: 'text-orange-700', bg: 'bg-orange-50',  key: 'node.aiCodingAgent', descKey: 'node.aiCodingAgent.desc' },
  { type: 'human',         icon: User,       color: 'text-rose-600',    bg: 'bg-rose-50',    key: 'node.human',         descKey: 'node.human.desc'         },
  { type: 'io',            icon: ArrowRight,  color: 'text-sky-600',    bg: 'bg-sky-50',     key: 'node.io',            descKey: 'node.io.desc'            },
  { type: 'output',        icon: Inbox,       color: 'text-emerald-600', bg: 'bg-emerald-50', key: 'node.output',        descKey: 'node.output.desc'        },
  { type: 'condition',     icon: GitBranch,   color: 'text-slate-600',  bg: 'bg-slate-100',  key: 'node.condition',     descKey: 'node.condition.desc'     },
  { type: 'merge',         icon: GitMerge,    color: 'text-purple-600', bg: 'bg-purple-50', key: 'node.merge',         descKey: 'node.merge.desc'         },
  { type: 'dispatcher',    icon: Split,       color: 'text-teal-600',   bg: 'bg-teal-50',  key: 'node.dispatcher',    descKey: 'node.dispatcher.desc'    },
  { type: 'initializer',   icon: PlayCircle,  color: 'text-violet-600', bg: 'bg-violet-50',  key: 'node.initializer',   descKey: 'node.initializer.desc'   },
] as const;

interface PrimaryNodesProps {
  search: string;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

const HELP_TYPE_MAP: Record<string, string> = {
  aiCodingAgent: 'coding-agent',
  io: 'input',
};

export function PrimaryNodes({ search, onDragStart }: PrimaryNodesProps) {
  const { t } = useUIStore();
  const [helpType, setHelpType] = useState<string | null>(null);

  const filtered = PRIMARY_NODES.filter(n =>
    !search ||
    t(n.key as TranslationKey).toLowerCase().includes(search.toLowerCase()) ||
    n.type.includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="px-1 py-2 text-xs font-medium text-slate-400">
        {t('panel.left.nodes' as TranslationKey)}
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-slate-400 px-3 py-3 text-center">
          {t('panel.left.noMatchingNodes' as TranslationKey)}
        </p>
      ) : (
        <div className="space-y-1 mb-1">
          {filtered.map((node) => {
            const Icon = node.icon;
            return (
              <div
                key={node.type}
                className="group/node flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-50 hover:border-slate-100 hover:-translate-y-px transition-all cursor-grab active:cursor-grabbing active:scale-[0.98]"
                draggable
                onDragStart={(e) => onDragStart(e, node.type)}
              >
                <div className={`p-1.5 rounded-lg ${node.bg} ${node.color} shrink-0`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-slate-700 block truncate">
                    {t(node.key as TranslationKey)}
                  </span>
                </div>
                {(() => {
                  const ht = HELP_TYPE_MAP[node.type] || node.type;
                  return NODE_HELP[ht] ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setHelpType(ht); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="p-1 rounded-full text-slate-300 hover:text-slate-500 hover:bg-white opacity-0 group-hover/node:opacity-100 transition-all shrink-0"
                      title="Help"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  ) : null;
                })()}
              </div>
            );
          })}
        </div>
      )}
      {helpType && (
        <NodeHelpModal nodeType={helpType} onClose={() => setHelpType(null)} />
      )}
    </div>
  );
}
