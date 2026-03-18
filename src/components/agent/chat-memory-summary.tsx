'use client'

import React from 'react'
import { Brain, CheckCircle, List } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface Props {
  items: string[]
  agentName: string
  memoryCount: number
  onClose: () => void
}

export function ChatMemorySummary({ items, agentName, memoryCount, onClose }: Props) {
  const { t } = useUIStore()

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
        <Brain className="w-6 h-6 text-indigo-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{t('chat.memoryUpdated')}</h3>

      <div className="w-full max-w-xs space-y-2">
        <p className="text-xs text-slate-500 font-medium">{t('chat.newInsights')}</p>
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{item}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-2">
        {agentName} {t('chat.totalMemories').replace('{n}', String(memoryCount))}
      </p>

      <div className="flex gap-2 mt-2">
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
        >
          <List className="w-3.5 h-3.5" /> {t('memory.viewAll')}
        </button>
      </div>
    </div>
  )
}
