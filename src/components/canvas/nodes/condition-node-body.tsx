import React from 'react';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';

type Mode = 'natural' | 'expression';

interface ConditionNodeBodyProps {
  id: string;
  data: Record<string, unknown>;
  mode: Mode;
}

export function ConditionNodeBody({ id, data, mode }: ConditionNodeBodyProps) {
  const { updateNodeData } = useFlowStore();
  const { t } = useUIStore();
  const value = (data?.conditionValue as string) || '';
  const [localValue, setLocalValue] = React.useState(value);
  const composingRef = React.useRef(false);

  React.useEffect(() => {
    if (!composingRef.current) setLocalValue(value);
  }, [value]);

  const placeholder =
    mode === 'natural' ? t('node.condition.placeholder') : t('node.condition.exprPlaceholder');

  return (
    <div className="p-4 bg-white/80 rounded-b-xl backdrop-blur-sm">
      <textarea
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          if (!composingRef.current) updateNodeData(id, 'conditionValue', e.target.value);
        }}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          const val = (e.target as HTMLTextAreaElement).value;
          setLocalValue(val);
          updateNodeData(id, 'conditionValue', val);
        }}
        placeholder={placeholder}
        rows={3}
        className={`w-full text-xs border border-slate-200 rounded-lg p-2.5 resize-none
                    focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent
                    placeholder:text-slate-400 bg-white
                    ${mode === 'expression' ? 'font-mono' : ''}`}
      />
      {/* True / False labels */}
      <div className="flex justify-end gap-3 mt-2 text-xs font-medium">
        <span className="text-emerald-600">✓ true</span>
        <span className="text-rose-500">✗ false</span>
      </div>
    </div>
  );
}
