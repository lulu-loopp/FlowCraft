'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/button';
import { Plus, X, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useFlowStore } from '@/store/flowStore';
import { useAgentStore } from '@/store/agent-store';
import { useUIStore } from '@/store/uiStore';
import { MODEL_OPTIONS, ModelProvider } from '@/types/model';
import type { Node } from '@xyflow/react';

const AVAILABLE_TOOLS = [
  { id: 'web_search',     label: 'Web Search' },
  { id: 'calculator',     label: 'Calculator' },
  { id: 'url_fetch',      label: 'URL Fetch' },
  { id: 'code_execute',   label: 'Code Execute' },
  { id: 'python_execute', label: 'Python Execute' },
  { id: 'brave_search',   label: 'Brave Search' },
];

const SCHEMA_TYPES = ['string', 'number', 'boolean', 'object', 'array'];

// ── Custom dropdown with portal (avoids overflow-y-auto clipping) ───────────
interface DropdownOption { value: string; label: string }

function DropdownSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // close on outside pointer
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as unknown as globalThis.Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  // close on scroll (so dropdown doesn't float away from trigger)
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    document.addEventListener('scroll', handler, true);
    return () => document.removeEventListener('scroll', handler, true);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };

  const currentLabel = options.find(o => o.value === value)?.label ?? value;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between p-2.5 text-sm rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-white focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer transition-all"
      >
        <span className="text-slate-700">{currentLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 'var(--z-dropdown)', animation: 'dropdown-in 0.12s ease-out' } as React.CSSProperties}
          className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                opt.value === value
                  ? 'text-indigo-600 font-medium bg-indigo-50/80'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Dot-style toggle chip (mirrors Playground skill card style) ──────────────
function ToggleChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 border transition-all text-left ${
        checked
          ? 'bg-slate-800 text-white border-slate-700'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {checked && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_4px_1px_rgba(99,102,241,0.6)]" />
      )}
      <span className="truncate pr-2">{label}</span>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
interface AgentConfigPanelProps { node: Node }

export function AgentConfigPanel({ node }: AgentConfigPanelProps) {
  const { nodes, setNodes } = useFlowStore();
  const { skillRegistry, fetchSkills } = useAgentStore();
  const { t } = useUIStore();

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const data = node.data as Record<string, unknown>;

  const updateNodeData = (updates: Record<string, unknown>) => {
    setNodes(nodes.map(n =>
      n.id === node.id ? { ...n, data: { ...n.data, ...updates } } : n
    ));
  };

  const provider           = (data.provider           as ModelProvider) || 'anthropic';
  const model              = (data.model              as string)        || MODEL_OPTIONS[provider][0];
  const enabledTools       = (data.enabledTools       as string[])      || [];
  const enabledSkills      = (data.enabledSkills      as string[])      || [];
  const completionCriteria = (data.completionCriteria as string[])      || [];
  const outputSchema       = (data.outputSchema       as { name: string; type: string }[]) || [];

  const providerOptions: DropdownOption[] = [
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai',    label: 'OpenAI' },
    { value: 'deepseek',  label: 'DeepSeek' },
  ];

  return (
    <div className="space-y-5">
      {/* Node Name */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('config.nodeName')}</label>
        <input
          type="text"
          className="w-full p-2.5 text-sm rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-400 outline-none transition-colors"
          value={(data.label as string) || ''}
          onChange={(e) => updateNodeData({ label: e.target.value })}
        />
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('config.systemPrompt')}</label>
        <textarea
          className="w-full h-28 p-3 text-sm leading-relaxed rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-400 outline-none resize-none transition-colors"
          placeholder={t('config.systemPromptPlaceholder')}
          value={(data.systemPrompt as string) || ''}
          onChange={(e) => updateNodeData({ systemPrompt: e.target.value })}
        />
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('config.model')}</label>
        <div className="space-y-2">
          <DropdownSelect
            value={provider}
            options={providerOptions}
            onChange={(p) => updateNodeData({ provider: p, model: MODEL_OPTIONS[p as ModelProvider][0] })}
          />
          <DropdownSelect
            value={model}
            options={MODEL_OPTIONS[provider].map(m => ({ value: m, label: m }))}
            onChange={(m) => updateNodeData({ model: m })}
          />
        </div>
      </div>

      {/* Max Iterations */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('config.maxIterations')}</label>
        <input
          type="number"
          min={1}
          max={50}
          className="w-full p-2.5 text-sm rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-colors"
          value={(data.maxIterations as number) ?? 5}
          onChange={(e) => updateNodeData({ maxIterations: parseInt(e.target.value) })}
        />
      </div>

      {/* Capabilities */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-2">{t('config.capabilities')}</label>
        <div className="grid grid-cols-2 gap-1.5">
          {AVAILABLE_TOOLS.map((tool) => (
            <ToggleChip
              key={tool.id}
              label={tool.label}
              checked={enabledTools.includes(tool.id)}
              onChange={(checked) => {
                const next = checked
                  ? [...enabledTools, tool.id]
                  : enabledTools.filter(t => t !== tool.id);
                updateNodeData({ enabledTools: next });
              }}
            />
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-2">{t('config.skills')}</label>
        {skillRegistry.length === 0 ? (
          <p className="text-xs text-slate-400">
            {t('config.noSkills')}{' '}
            <Link href="/playground" className="text-teal-600 hover:underline">{t('config.installSkills')}</Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {skillRegistry.map((skill) => (
              <ToggleChip
                key={skill.name}
                label={skill.name}
                checked={enabledSkills.includes(skill.name)}
                onChange={(checked) => {
                  const next = checked
                    ? [...enabledSkills, skill.name]
                    : enabledSkills.filter(s => s !== skill.name);
                  updateNodeData({ enabledSkills: next });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completion Criteria */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-2">{t('config.completionCriteria')}</label>
        <div className="space-y-2 mb-2">
          {completionCriteria.map((criterion, index) => (
            <div key={index} className="flex items-center gap-2 border border-slate-200 rounded-lg bg-white/50 px-2.5 py-2">
              <input
                type="text"
                className="flex-1 text-sm bg-transparent outline-none placeholder-slate-400"
                placeholder={t('config.completionCriteriaPlaceholder')}
                value={criterion}
                onChange={(e) => {
                  const next = [...completionCriteria];
                  next[index] = e.target.value;
                  updateNodeData({ completionCriteria: next });
                }}
              />
              <button
                className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                onClick={() => updateNodeData({ completionCriteria: completionCriteria.filter((_, i) => i !== index) })}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="outline" size="sm"
          className="w-full text-teal-700 border-teal-100 hover:bg-teal-50 bg-white shadow-none"
          onClick={() => updateNodeData({ completionCriteria: [...completionCriteria, ''] })}
        >
          <Plus className="w-4 h-4 mr-1" /> {t('config.addCriteria')}
        </Button>
      </div>

      {/* Output Schema */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-2">{t('config.outputSchema')}</label>
        <div className="space-y-2 mb-2">
          {outputSchema.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 min-w-0 p-2 text-sm rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 outline-none focus:ring-2 focus:ring-teal-500 placeholder-slate-400 transition-colors"
                placeholder={t('config.outputSchemaFieldPlaceholder')}
                value={field.name}
                onChange={(e) => {
                  const next = [...outputSchema];
                  next[index] = { ...next[index], name: e.target.value };
                  updateNodeData({ outputSchema: next });
                }}
              />
              <div className="relative w-24 flex-shrink-0">
                <select
                  value={field.type}
                  onChange={(e) => {
                    const next = [...outputSchema];
                    next[index] = { ...next[index], type: e.target.value };
                    updateNodeData({ outputSchema: next });
                  }}
                  className="w-full appearance-none p-2 pr-6 text-sm rounded-lg border border-slate-200 bg-white/50 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer transition-colors"
                >
                  {SCHEMA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
              <button
                className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                onClick={() => updateNodeData({ outputSchema: outputSchema.filter((_, i) => i !== index) })}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="outline" size="sm"
          className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 bg-white shadow-none"
          onClick={() => updateNodeData({ outputSchema: [...outputSchema, { name: '', type: 'string' }] })}
        >
          <Plus className="w-4 h-4 mr-1" /> {t('config.defineSchema')}
        </Button>
      </div>
    </div>
  );
}
