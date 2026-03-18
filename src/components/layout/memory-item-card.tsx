'use client'

import React from 'react'
import { Trash2, Edit, X, Check } from 'lucide-react'
import type { MemoryItem } from '@/lib/memory-parser'

interface MemoryItemCardProps {
  item: MemoryItem
  editing: boolean
  editText: string
  onStartEdit: () => void
  onEditChange: (v: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}

export function MemoryItemCard({
  item, editing, editText,
  onStartEdit, onEditChange, onSaveEdit, onCancelEdit, onDelete,
}: MemoryItemCardProps) {
  return (
    <div className="group/mem bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-1.5">
      {item.date && item.tag && (
        <p className="text-[10px] text-slate-400 mb-1">
          {item.date}{' '}
          <span className={`px-1 py-0.5 rounded text-[9px] ${
            item.tag === '反思'
              ? 'bg-amber-50 text-amber-600'
              : 'bg-emerald-50 text-emerald-600'
          }`}>
            {item.tag}
          </span>
        </p>
      )}
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            className="w-full text-xs text-slate-700 p-2 border border-slate-200 rounded resize-none outline-none focus:ring-1 focus:ring-indigo-200 min-h-[60px]"
            value={editText}
            onChange={e => onEditChange(e.target.value)}
            autoFocus
          />
          <div className="flex gap-1 justify-end">
            <button onClick={onCancelEdit} className="p-1 hover:bg-slate-200 rounded cursor-pointer">
              <X className="w-3 h-3 text-slate-400" />
            </button>
            <button onClick={onSaveEdit} className="p-1 hover:bg-indigo-100 rounded cursor-pointer">
              <Check className="w-3 h-3 text-indigo-500" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1">
          <p className="text-xs text-slate-600 flex-1 whitespace-pre-wrap">{item.content}</p>
          <div className="flex gap-0.5 opacity-0 group-hover/mem:opacity-100 transition-opacity shrink-0">
            <button onClick={onStartEdit} className="p-0.5 hover:bg-white rounded cursor-pointer">
              <Edit className="w-3 h-3 text-slate-400" />
            </button>
            <button onClick={onDelete} className="p-0.5 hover:bg-rose-50 rounded cursor-pointer">
              <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface StyleAddInputProps {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}

export function StyleAddInput({ value, onChange, onSave, onCancel }: StyleAddInputProps) {
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 mt-1.5">
      <textarea
        className="w-full text-xs text-slate-700 p-2 border border-slate-200 rounded resize-none outline-none focus:ring-1 focus:ring-indigo-200 min-h-[48px] bg-white"
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus
        placeholder="e.g. 输出前先给一句话总结"
      />
      <div className="flex gap-1 justify-end mt-1">
        <button onClick={onCancel} className="p-1 hover:bg-slate-200 rounded cursor-pointer">
          <X className="w-3 h-3 text-slate-400" />
        </button>
        <button onClick={onSave} className="p-1 hover:bg-indigo-100 rounded cursor-pointer">
          <Check className="w-3 h-3 text-indigo-500" />
        </button>
      </div>
    </div>
  )
}
