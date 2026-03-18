'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Search, BarChart3, PenTool, Code, ShieldAlert, ListChecks } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { PRESET_NODES } from '@/lib/presets/nodes';
import type { TranslationKey } from '@/lib/i18n';

const ICON_MAP: Record<string, React.ElementType> = {
  Search, BarChart3, PenTool, Code, ShieldAlert, ListChecks,
};

interface PresetNodesProps {
  search: string;
  onDragStart: (event: React.DragEvent, nodeType: string, agentName?: string, presetId?: string) => void;
}

export function PresetNodes({ search, onDragStart }: PresetNodesProps) {
  const { t } = useUIStore();
  const [open, setOpen] = useState(true);

  const filtered = PRESET_NODES.filter(p =>
    !search ||
    t(p.labelKey).toLowerCase().includes(search.toLowerCase()) ||
    t(p.descKey).toLowerCase().includes(search.toLowerCase())
  );

  const isOpen = (search && filtered.length > 0) || open;

  return (
    <div className="pt-1 border-t border-slate-100">
      <button
        className="w-full flex items-center justify-between px-1 py-2 hover:bg-slate-50 rounded-lg transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs font-medium text-slate-400">
          {t('panel.left.presets' as TranslationKey)}
        </span>
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 px-3 py-3 text-center">
            {t('panel.left.noMatchingNodes' as TranslationKey)}
          </p>
        ) : (
          <div className="space-y-1 mb-1">
            {filtered.map((preset) => {
              const Icon = ICON_MAP[preset.iconName] || Search;
              return (
                <div
                  key={preset.id}
                  className="group/preset flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-transparent
                    hover:bg-slate-50 hover:border-slate-100 hover:-translate-y-px
                    transition-all cursor-grab active:cursor-grabbing active:scale-[0.98]"
                  draggable
                  onDragStart={(e) => onDragStart(e, 'agent', undefined, preset.id)}
                  title={t(preset.descKey)}
                >
                  <div className={`p-1.5 rounded-lg ${preset.iconBg} ${preset.iconColor} shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {t(preset.labelKey)}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {t(preset.descKey)}
                    </p>
                  </div>
                  <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0 opacity-0 group-hover/preset:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
