import React from 'react';
import type { Node } from '@xyflow/react';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import type { TranslationKey } from '@/lib/i18n';

interface ConditionConfigPanelProps {
  node: Node;
}

export function ConditionConfigPanel({ node }: ConditionConfigPanelProps) {
  const { updateNodeData } = useFlowStore();
  const { t } = useUIStore();
  const data = node.data as Record<string, unknown>;

  const label = (data.label as string) || '';
  const mode = (data.conditionMode as string) || 'natural';
  const conditionValue = (data.conditionValue as string) || '';
  const maxLoop = (data.maxLoopIterations as number) || 10;

  return (
    <div className="space-y-4">
      {/* Node name */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">
          {t('config.nodeName')}
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => updateNodeData(node.id, 'label', e.target.value)}
          placeholder="Condition"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
            focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
        />
      </div>

      {/* Condition mode */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">
          {t('node.condition.natural')}/{t('node.condition.expression')}
        </label>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => updateNodeData(node.id, 'conditionMode', 'natural')}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              mode === 'natural' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('node.condition.natural')}
          </button>
          <button
            onClick={() => updateNodeData(node.id, 'conditionMode', 'expression')}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              mode === 'expression' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('node.condition.expression')}
          </button>
        </div>
      </div>

      {/* Condition value */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">
          {mode === 'natural' ? t('node.condition.natural') : t('node.condition.expression')}
        </label>
        <textarea
          value={conditionValue}
          onChange={(e) => updateNodeData(node.id, 'conditionValue', e.target.value)}
          placeholder={mode === 'natural' ? t('node.condition.placeholder') : t('node.condition.exprPlaceholder')}
          rows={3}
          className={`w-full text-sm border border-slate-200 rounded-lg p-2.5 resize-none
            focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent
            placeholder:text-slate-400 ${mode === 'expression' ? 'font-mono' : ''}`}
        />
      </div>

      {/* Max loop iterations */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">
          {t('node.condition.maxLoop' as TranslationKey)}
        </label>
        <input
          type="number"
          min={1}
          max={100}
          value={maxLoop}
          onChange={(e) => updateNodeData(node.id, 'maxLoopIterations', parseInt(e.target.value) || 10)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
            focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
        />
        <p className="text-[11px] text-slate-400 mt-1">
          {t('node.condition.maxLoopHint' as TranslationKey)}
        </p>
      </div>
    </div>
  );
}
