'use client'

import React, { useState } from 'react'
import { AlertTriangle, Bot, Copy, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface IndividualEditWarningProps {
  individualName: string
  onEditOriginal: () => void
  onCreateCopy: () => void
  onCancel: () => void
}

export function IndividualEditWarning({
  individualName,
  onEditOriginal,
  onCreateCopy,
  onCancel,
}: IndividualEditWarningProps) {
  const { t } = useUIStore()
  const [choice, setChoice] = useState<'edit' | 'copy'>('edit')

  const handleConfirm = () => {
    if (choice === 'edit') onEditOriginal()
    else onCreateCopy()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[440px] max-w-[90vw] overflow-hidden border-2 border-amber-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — amber background for strong warning */}
        <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-bold text-amber-800">
              {t('packed.individualWarningTitle')}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-amber-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            {t('packed.individualWarningMsg').replace('{name}', individualName)}
          </p>

          {/* Impact list */}
          <ul className="text-sm text-slate-600 space-y-1.5 pl-1">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              {t('packed.individualWarningEffect1').replace('{name}', individualName)}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              {t('packed.individualWarningEffect2').replace('{name}', individualName)}
            </li>
          </ul>

          {/* Radio options */}
          <div className="space-y-2">
            <label
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${choice === 'edit'
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-200 hover:border-slate-300'}`}
              onClick={() => setChoice('edit')}
            >
              <input
                type="radio"
                checked={choice === 'edit'}
                onChange={() => setChoice('edit')}
                className="accent-amber-600"
              />
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-slate-700">
                  {t('packed.individualEditOption').replace('{name}', individualName)}
                </span>
              </div>
            </label>

            <label
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${choice === 'copy'
                  ? 'border-teal-400 bg-teal-50'
                  : 'border-slate-200 hover:border-slate-300'}`}
              onClick={() => setChoice('copy')}
            >
              <input
                type="radio"
                checked={choice === 'copy'}
                onChange={() => setChoice('copy')}
                className="accent-teal-600"
              />
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-teal-500" />
                <span className="text-sm font-medium text-slate-700">
                  {t('packed.individualCopyOption')}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-amber-100 bg-amber-50/30">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {t('packed.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors
              ${choice === 'edit'
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-teal-500 hover:bg-teal-600'}`}
          >
            {t('packed.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
