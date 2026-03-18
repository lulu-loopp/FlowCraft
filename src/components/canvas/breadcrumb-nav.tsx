'use client'

import React from 'react'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'

export interface ViewStackEntry {
  nodeId: string
  label: string
  /** Snapshot of parent nodes/edges before entering */
  parentNodes: unknown[]
  parentEdges: unknown[]
}

export function BreadcrumbNav() {
  const viewStack = useFlowStore(s => s.viewStack) || []
  const popViewStack = useFlowStore(s => s.popViewStack)
  const popToViewStackIndex = useFlowStore(s => s.popToViewStackIndex)
  const { t } = useUIStore()
  const flowName = useFlowStore(s => s.flowName)

  if (viewStack.length === 0) return null

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-white/90 backdrop-blur-sm border-b border-slate-100 text-sm">
      <button
        onClick={() => popViewStack?.()}
        className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors mr-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-xs">{t('packed.back')}</span>
      </button>

      <button
        onClick={() => popToViewStackIndex?.(0)}
        className="text-slate-500 hover:text-violet-600 transition-colors font-medium truncate max-w-[120px]"
      >
        {flowName || 'Flow'}
      </button>

      {viewStack.map((entry, i) => (
        <React.Fragment key={entry.nodeId}>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          {i < viewStack.length - 1 ? (
            <button
              onClick={() => popToViewStackIndex?.(i + 1)}
              className="text-slate-500 hover:text-violet-600 transition-colors truncate max-w-[120px]"
            >
              {entry.label}
            </button>
          ) : (
            <span className="text-violet-700 font-medium truncate max-w-[120px]">
              {entry.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
