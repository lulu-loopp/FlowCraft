'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Eye, ChevronDown } from 'lucide-react'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'
import { buildFullSystemPrompt } from '@/lib/personality-injector'
import type { PersonalityConfig } from '@/lib/personality-injector'
import type { Node } from '@xyflow/react'

interface Props { node: Node }

type StyleKey = 'thinkingStyle' | 'communicationStyle' | 'valueOrientation'

const STYLE_OPTIONS: Record<StyleKey, { key: string; values: string[] }> = {
  thinkingStyle: { key: 'personality.thinking', values: ['conservative', 'balanced', 'bold'] },
  communicationStyle: { key: 'personality.communication', values: ['concise', 'detailed', 'socratic'] },
  valueOrientation: { key: 'personality.value', values: ['efficiency', 'user', 'quality'] },
}

export function PersonalityConfig({ node }: Props) {
  const { t } = useUIStore()
  const [showPreview, setShowPreview] = useState(false)

  const data = node.data as Record<string, unknown>
  const personality = (data.personality as PersonalityConfig) || {}
  const flowId = useFlowStore(s => s.flowId)
  const individualName = data.individualName as string | undefined

  const [privateMemory, setPrivateMemory] = useState('')

  const loadMemory = useCallback(async () => {
    try {
      if (individualName) {
        const res = await fetch(`/api/agents/individuals/${individualName}`)
        if (res.ok) { const d = await res.json(); setPrivateMemory(d.memory || '') }
      } else if (flowId) {
        const res = await fetch(`/api/memory/${flowId}/${node.id}`)
        if (res.ok) { const d = await res.json(); setPrivateMemory(d.content || '') }
      }
    } catch { /* ignore */ }
  }, [flowId, node.id, individualName])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMemory() }, [loadMemory])

  const update = (patch: Partial<PersonalityConfig>) => {
    const store = useFlowStore.getState()
    const next = { ...personality, ...patch }
    store.setNodes(store.nodes.map(n =>
      n.id === node.id ? { ...n, data: { ...n.data, personality: next } } : n
    ))
  }

  const inputCls = 'w-full p-2 text-sm rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors'

  const previewText = buildFullSystemPrompt(
    personality,
    (data.systemPrompt as string) || '',
    privateMemory
  )

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('personality.name')}</label>
        <input
          type="text"
          className={inputCls}
          placeholder={t('personality.namePlaceholder')}
          value={personality.name || ''}
          onChange={e => update({ name: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('personality.role')}</label>
        <input
          type="text"
          className={inputCls}
          placeholder={t('personality.rolePlaceholder')}
          value={personality.role || ''}
          onChange={e => update({ role: e.target.value })}
        />
      </div>

      {/* Trait selectors */}
      {(Object.keys(STYLE_OPTIONS) as StyleKey[]).map(key => {
        const { key: labelKey, values } = STYLE_OPTIONS[key]
        return (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-500 mb-2">{t(labelKey as never)}</label>
            <div className="flex gap-1">
              {values.map(v => (
                <button
                  key={v}
                  onClick={() => update({ [key]: v })}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-all cursor-pointer ${
                    (personality[key] || values[1]) === v
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {t(`${labelKey}.${v}` as never)}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {/* Backstory */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          {t('personality.backstory')} <span className="text-slate-300">({t('personality.optional')})</span>
        </label>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          placeholder={t('personality.backstoryPlaceholder')}
          value={personality.backstory || ''}
          onChange={e => update({ backstory: e.target.value })}
        />
      </div>

      {/* Beliefs */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          {t('personality.beliefs')} <span className="text-slate-300">({t('personality.optional')})</span>
        </label>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          placeholder={t('personality.beliefsPlaceholder')}
          value={personality.beliefs || ''}
          onChange={e => update({ beliefs: e.target.value })}
        />
      </div>

      {/* Preview */}
      <button
        onClick={() => setShowPreview(p => !p)}
        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
      >
        <Eye className="w-3.5 h-3.5" />
        {t('personality.previewPrompt')}
        <ChevronDown className={`w-3 h-3 transition-transform ${showPreview ? 'rotate-180' : ''}`} />
      </button>
      {showPreview && (
        <pre className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
          {previewText}
        </pre>
      )}
    </div>
  )
}
