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

// ── Per-node-type theme for config panel interactions ────────────────────────
interface ConfigTheme {
  focusRing: string;
  chipActive: string;
  chipHover: string;
  dropdownSelected: string;
  linkText: string;
  addCriteriaBtn: string;
}

const NODE_CONFIG_THEMES: Record<string, ConfigTheme> = {
  agent: {
    focusRing: 'focus:ring-indigo-500 focus:border-indigo-400',
    chipActive: 'bg-indigo-600 text-white border-indigo-500 shadow-sm',
    chipHover: 'hover:border-indigo-200 hover:bg-indigo-50/50',
    dropdownSelected: 'text-indigo-700 font-medium bg-indigo-50',
    linkText: 'text-indigo-600',
    addCriteriaBtn: 'text-indigo-700 border-indigo-100 hover:bg-indigo-50',
  },
  tool: {
    focusRing: 'focus:ring-emerald-500 focus:border-emerald-400',
    chipActive: 'bg-emerald-600 text-white border-emerald-500 shadow-sm',
    chipHover: 'hover:border-emerald-200 hover:bg-emerald-50/50',
    dropdownSelected: 'text-emerald-700 font-medium bg-emerald-50',
    linkText: 'text-emerald-600',
    addCriteriaBtn: 'text-emerald-700 border-emerald-100 hover:bg-emerald-50',
  },
  skill: {
    focusRing: 'focus:ring-amber-500 focus:border-amber-400',
    chipActive: 'bg-amber-600 text-white border-amber-500 shadow-sm',
    chipHover: 'hover:border-amber-200 hover:bg-amber-50/50',
    dropdownSelected: 'text-amber-700 font-medium bg-amber-50',
    linkText: 'text-amber-600',
    addCriteriaBtn: 'text-amber-700 border-amber-100 hover:bg-amber-50',
  },
  human: {
    focusRing: 'focus:ring-rose-500 focus:border-rose-400',
    chipActive: 'bg-rose-600 text-white border-rose-500 shadow-sm',
    chipHover: 'hover:border-rose-200 hover:bg-rose-50/50',
    dropdownSelected: 'text-rose-700 font-medium bg-rose-50',
    linkText: 'text-rose-600',
    addCriteriaBtn: 'text-rose-700 border-rose-100 hover:bg-rose-50',
  },
  io: {
    focusRing: 'focus:ring-sky-500 focus:border-sky-400',
    chipActive: 'bg-sky-600 text-white border-sky-500 shadow-sm',
    chipHover: 'hover:border-sky-200 hover:bg-sky-50/50',
    dropdownSelected: 'text-sky-700 font-medium bg-sky-50',
    linkText: 'text-sky-600',
    addCriteriaBtn: 'text-sky-700 border-sky-100 hover:bg-sky-50',
  },
  condition: {
    focusRing: 'focus:ring-slate-500 focus:border-slate-400',
    chipActive: 'bg-slate-600 text-white border-slate-500 shadow-sm',
    chipHover: 'hover:border-slate-300 hover:bg-slate-50',
    dropdownSelected: 'text-slate-700 font-medium bg-slate-100',
    linkText: 'text-slate-600',
    addCriteriaBtn: 'text-slate-700 border-slate-200 hover:bg-slate-50',
  },
  initializer: {
    focusRing: 'focus:ring-violet-500 focus:border-violet-400',
    chipActive: 'bg-violet-600 text-white border-violet-500 shadow-sm',
    chipHover: 'hover:border-violet-200 hover:bg-violet-50/50',
    dropdownSelected: 'text-violet-700 font-medium bg-violet-50',
    linkText: 'text-violet-600',
    addCriteriaBtn: 'text-violet-700 border-violet-100 hover:bg-violet-50',
  },
};

const ConfigThemeCtx = React.createContext<ConfigTheme>(NODE_CONFIG_THEMES.agent);

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
  const theme = React.useContext(ConfigThemeCtx);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as unknown as globalThis.Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

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
        className={`w-full flex items-center justify-between p-2.5 text-sm rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-white focus:ring-2 ${theme.focusRing} outline-none cursor-pointer transition-all`}
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
                  ? theme.dropdownSelected
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

// ── Toggle chip ──────────────────────────────────────────────────────────────
function ToggleChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const theme = React.useContext(ConfigThemeCtx);
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 border transition-all text-left ${
        checked
          ? theme.chipActive
          : `bg-white text-slate-600 border-slate-200 ${theme.chipHover}`
      }`}
    >
      {checked && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white/70" />
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
  const promptComposingRef = useRef(false);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const theme = NODE_CONFIG_THEMES[node.type ?? 'agent'] || NODE_CONFIG_THEMES.agent;
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

  const inputCls = `w-full p-2.5 text-sm rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 focus:ring-2 ${theme.focusRing} outline-none transition-colors`;

  return (
    <ConfigThemeCtx.Provider value={theme}>
      <div className="space-y-5">
        {/* Node Name */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('config.nodeName')}</label>
          <input
            type="text"
            className={inputCls}
            value={(data.label as string) || ''}
            onChange={(e) => updateNodeData({ label: e.target.value })}
          />
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('config.systemPrompt')}</label>
          <textarea
            className={`${inputCls} h-28 p-3 leading-relaxed resize-none`}
            placeholder={t('config.systemPromptPlaceholder')}
            value={(data.systemPrompt as string) || ''}
            onChange={(e) => {
              if (!promptComposingRef.current) updateNodeData({ systemPrompt: e.target.value });
            }}
            onCompositionStart={() => { promptComposingRef.current = true; }}
            onCompositionEnd={(e) => {
              promptComposingRef.current = false;
              updateNodeData({ systemPrompt: (e.target as HTMLTextAreaElement).value });
            }}
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
            className={inputCls}
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
                    : enabledTools.filter(x => x !== tool.id);
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
              <Link href="/playground" className={`${theme.linkText} hover:underline`}>{t('config.installSkills')}</Link>
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
            className={`w-full bg-white shadow-none ${theme.addCriteriaBtn}`}
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
                  className={`flex-1 min-w-0 p-2 text-sm rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 outline-none focus:ring-2 ${theme.focusRing} placeholder-slate-400 transition-colors`}
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
                    className={`w-full appearance-none p-2 pr-6 text-sm rounded-lg border border-slate-200 bg-white/50 outline-none focus:ring-2 ${theme.focusRing} cursor-pointer transition-colors`}
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
    </ConfigThemeCtx.Provider>
  );
}
