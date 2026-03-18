'use client'

import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
