'use client';

import React from 'react';
import { Bot, User, ArrowRight, Inbox, GitBranch, PlayCircle, Terminal } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import type { TranslationKey } from '@/lib/i18n';

const PRIMARY_NODES = [
  { type: 'agent',         icon: Bot,        color: 'text-indigo-600', bg: 'bg-indigo-50',  key: 'node.agent'         },
  { type: 'aiCodingAgent', icon: Terminal,    color: 'text-orange-700', bg: 'bg-orange-50',  key: 'node.aiCodingAgent' },
  { type: 'human',         icon: User,       color: 'text-rose-600',    bg: 'bg-rose-50',    key: 'node.human'         },
  { type: 'io',            icon: ArrowRight,  color: 'text-sky-600',    bg: 'bg-sky-50',     key: 'node.io'            },
  { type: 'output',        icon: Inbox,       color: 'text-emerald-600', bg: 'bg-emerald-50', key: 'node.output'        },
  { type: 'condition',     icon: GitBranch,   color: 'text-slate-600',  bg: 'bg-slate-100',  key: 'node.condition'     },
  { type: 'initializer',   icon: PlayCircle,  color: 'text-violet-600', bg: 'bg-violet-50',  key: 'node.initializer'   },
] as const;

interface PrimaryNodesProps {
  search: string;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

export function PrimaryNodes({ search, onDragStart }: PrimaryNodesProps) {
  const { t } = useUIStore();

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
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-50 hover:border-slate-100 hover:-translate-y-px transition-all cursor-grab active:cursor-grabbing active:scale-[0.98]"
                draggable
                onDragStart={(e) => onDragStart(e, node.type)}
              >
                <div className={`p-1.5 rounded-lg ${node.bg} ${node.color} shrink-0`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {t(node.key as TranslationKey)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
