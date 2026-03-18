'use client'

import React, { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface Props {
  content: string
  readOnly?: boolean
  title: string
  onClose: () => void
  onSave: (content: string) => void
}

export function MemoryEditorModal({ content, readOnly, title, onClose, onSave }: Props) {
  const { t } = useUIStore()
  const [text, setText] = useState(content)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {readOnly ? (
            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">{text || t('memory.noMemory')}</pre>
          ) : (
            <textarea
              className="w-full h-full min-h-[300px] text-xs text-slate-700 font-mono leading-relaxed p-3 border border-slate-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-indigo-200"
              value={text}
              onChange={e => setText(e.target.value)}
            />
          )}
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {t('canvas.cancel')}
            </button>
            <button
              onClick={() => onSave(text)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> {t('file.save')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
