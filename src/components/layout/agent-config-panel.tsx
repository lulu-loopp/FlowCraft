'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Plus, X, ChevronDown } from 'lucide-react';
import { useFlowStore } from '@/store/flowStore';
import { useRegistryStore } from '@/store/registry-store';
import { useUIStore } from '@/store/uiStore';
import { MODEL_OPTIONS, ModelProvider } from '@/types/model';
import type { Node } from '@xyflow/react';
import {
  ConfigThemeCtx,
  NODE_CONFIG_THEMES,
  DropdownSelect,
  ToggleChip,
  type DropdownOption,
} from '../canvas/agent-config-parts';
import { SkillInstallerInline } from '../canvas/skill-installer-inline';

const AVAILABLE_TOOLS = [
  { id: 'web_search',     label: 'Web Search' },
  { id: 'calculator',     label: 'Calculator' },
  { id: 'url_fetch',      label: 'URL Fetch' },
  { id: 'code_execute',   label: 'Code Execute' },
  { id: 'python_execute', label: 'Python Execute' },
  { id: 'brave_search',   label: 'Brave Search' },
];

const SCHEMA_TYPES = ['string', 'number', 'boolean', 'object', 'array'];

interface AgentConfigPanelProps { node: Node }

export function AgentConfigPanel({ node }: AgentConfigPanelProps) {
  const { nodes, setNodes } = useFlowStore();
  const { skillRegistry, fetchSkills } = useRegistryStore();
  const { t } = useUIStore();
  const promptComposingRef = useRef(false);

  const theme = NODE_CONFIG_THEMES[node.type ?? 'agent'] || NODE_CONFIG_THEMES.agent;
  const data = node.data as Record<string, unknown>;

  const [localSystemPrompt, setLocalSystemPrompt] = useState((data.systemPrompt as string) || '');

  useEffect(() => {
    if (!promptComposingRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSystemPrompt((data.systemPrompt as string) || '');
    }
  }, [data.systemPrompt]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

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
            value={localSystemPrompt}
            onChange={(e) => {
              setLocalSystemPrompt(e.target.value);
              if (!promptComposingRef.current) updateNodeData({ systemPrompt: e.target.value });
            }}
            onCompositionStart={() => { promptComposingRef.current = true; }}
            onCompositionEnd={(e) => {
              promptComposingRef.current = false;
              const val = (e.target as HTMLTextAreaElement).value;
              setLocalSystemPrompt(val);
              updateNodeData({ systemPrompt: val });
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
            <p className="text-xs text-slate-400 mb-2">{t('config.noSkills')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 mb-1">
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
          <SkillInstallerInline />
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
