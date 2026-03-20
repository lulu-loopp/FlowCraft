'use client';

import React, { useState, useCallback } from 'react';
import { Wrench, Lightbulb, ChevronRight, ChevronDown } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import type { TranslationKey } from '@/lib/i18n';

const ADVANCED_NODES = [
  { type: 'tool',  icon: Wrench,    color: 'text-cyan-600', bg: 'bg-cyan-50', key: 'node.tool'  },
  { type: 'skill', icon: Lightbulb, color: 'text-amber-600',   bg: 'bg-amber-50',   key: 'node.skill' },
] as const;

const STORAGE_KEY = 'flowcraft-advanced-nodes-open';

interface AdvancedNodesProps {
  search: string;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

export function AdvancedNodes({ search, onDragStart }: AdvancedNodesProps) {
  const { t } = useUIStore();
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const toggleOpen = useCallback(() => {
    setOpen(o => {
      const next = !o;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const filtered = ADVANCED_NODES.filter(n =>
    !search ||
    t(n.key as TranslationKey).toLowerCase().includes(search.toLowerCase()) ||
    n.type.includes(search.toLowerCase())
  );

  // When searching and there are matches, force open
  const isOpen = (search && filtered.length > 0) || open;

  return (
    <div className="pt-1 border-t border-slate-100">
      <button
        className="w-full flex items-center justify-between px-1 py-2 hover:bg-slate-50 rounded-lg transition-colors"
        onClick={toggleOpen}
      >
        <span className="text-xs font-medium text-slate-400">
          {t('panel.left.advanced' as TranslationKey)}
        </span>
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        }
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-[11px] text-slate-400 px-2 pb-2 leading-relaxed">
          {t('panel.left.advancedDesc' as TranslationKey)}
        </p>
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
    </div>
  );
}
