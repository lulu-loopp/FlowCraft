'use client'

import React, { useState } from 'react'
import { Layers, Copy, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface SharedEditDialogProps {
  packName: string
  usageCount: number
  onEditShared: () => void
  onCreateCopy: () => void
  onCancel: () => void
}

export function SharedEditDialog({
  packName,
  usageCount,
  onEditShared,
  onCreateCopy,
  onCancel,
}: SharedEditDialogProps) {
  const { t } = useUIStore()
  const [choice, setChoice] = useState<'shared' | 'copy'>('shared')

  const handleConfirm = () => {
    if (choice === 'shared') onEditShared()
    else onCreateCopy()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-500" />
            <h2 className="text-sm font-semibold text-slate-800">
              {t('packed.editSharedTitle')}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {t('packed.editSharedMsg')
              .replace('{count}', String(usageCount))
              .replace('{name}', packName)}
          </p>

          {/* Radio options */}
          <div className="space-y-2">
            <label
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${choice === 'shared'
                  ? 'border-violet-400 bg-violet-50'
                  : 'border-slate-200 hover:border-slate-300'}`}
              onClick={() => setChoice('shared')}
            >
              <input
                type="radio"
                checked={choice === 'shared'}
                onChange={() => setChoice('shared')}
                className="accent-violet-600"
              />
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-slate-700">
                  {t('packed.editSharedOption')}
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
                  {t('packed.createCopyOption')}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {t('packed.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors"
          >
            {t('packed.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
