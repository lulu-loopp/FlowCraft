'use client'

import React, { useState, useEffect, useRef } from 'react'
import { BookmarkPlus, AlertTriangle, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAgentLibrary, SaveIndividualData } from '@/hooks/useAgentLibrary'

interface SaveAgentDialogProps {
  defaultName: string
  defaultDescription?: string
  systemPrompt?: string
  tools?: string[]
  skills?: string[]
  model?: string
  provider?: string
  maxIterations?: number
  personality?: {
    name?: string
    role?: string
    thinkingStyle?: string
    communicationStyle?: string
    valueOrientation?: string
    backstory?: string
    beliefs?: string
  }
  memory?: string
  onClose: () => void
  onSaved: (name: string) => void
}

export function SaveAgentDialog({
  defaultName,
  defaultDescription,
  systemPrompt,
  tools,
  skills,
  model,
  provider,
  maxIterations,
  personality,
  memory,
  onClose,
  onSaved,
}: SaveAgentDialogProps) {
  const { t, lang } = useUIStore()
  const { individuals, saveIndividual } = useAgentLibrary()
  const [name, setName] = useState(
    defaultName.replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '')
  )
  const [description, setDescription] = useState(defaultDescription || '')
  const [role, setRole] = useState(personality?.role || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.select() }, [])

  const nameExists = individuals.some(i => i.name === name)
  const isValid = name.length > 0 && /^[\p{L}\p{N}_-]+$/u.test(name)

  const handleSave = async () => {
    if (!isValid || saving) return
    setSaving(true)

    const data: SaveIndividualData = {
      name,
      description,
      role,
      systemPrompt_zh: lang === 'zh' ? (systemPrompt || '') : '',
      systemPrompt_en: lang === 'en' ? (systemPrompt || '') : '',
      tools,
      skills,
      model,
      provider,
      maxIterations,
      personality: personality ? {
        thinkingStyle: personality.thinkingStyle,
        communicationStyle: personality.communicationStyle,
        valueOrientation: personality.valueOrientation,
        backstory: personality.backstory,
        beliefs: personality.beliefs,
      } : undefined,
      memory,
    }

    const result = await saveIndividual(data)
    setSaving(false)
    if (result) onSaved(result.name)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-800">{t('saveAgent.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">{t('saveAgent.name')}</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value.replace(/[^\p{L}\p{N}_-]/gu, ''))}
              placeholder={t('saveAgent.namePlaceholder')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">{t('saveAgent.nameHint')}</p>
            {nameExists && (
              <div className="flex items-center gap-1.5 mt-1.5 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px]">{t('saveAgent.overwriteWarning')}</span>
              </div>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">{t('saveAgent.role')}</label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder={t('saveAgent.rolePlaceholder')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">{t('saveAgent.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('saveAgent.descriptionPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {t('saveAgent.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {saving ? '...' : t('saveAgent.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
