import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import { useUIStore } from '@/store/uiStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function GenericNode({ id, data, selected, type }: NodeProps & { type: any }) {
  const { t } = useUIStore();
  const label = (data?.label as string) || type;
  const description = data?.description as string | undefined;
  const status = data?.status as string;

  return (
    <BaseNode
      id={id}
      type={type}
      label={label}
      description={description}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status={status as any}
      selected={selected}
    >
      {type === 'human' && (
        <div className="text-xs text-rose-600 bg-rose-50 px-2 py-1.5 rounded flex items-center mt-2 border border-rose-100">
          <span className="flex h-2 w-2 relative mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          {t('node.human.requiresInput')}
        </div>
      )}
    </BaseNode>
  );
}
