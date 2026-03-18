'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Brain, Plus, Trash2, ChevronDown } from 'lucide-react'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { MemoryItemCard, StyleAddInput } from './memory-item-card'
import type { Node } from '@xyflow/react'
import type { PersonalityConfig } from '@/lib/personality-injector'
import { refreshAgentLibrary } from '@/hooks/useAgentLibrary'
import { parseMemoryFile, serializeMemoryItems, isOldFormat, migrateToNewFormat, countMemoryItems, type MemoryItem } from '@/lib/memory-parser'

interface Props { node: Node }

export function MemoryViewer({ node }: Props) {
  const { t } = useUIStore()
  const flowId = useFlowStore(s => s.flowId)
  const personality = (node.data as Record<string, unknown>).personality as PersonalityConfig | undefined
  const individualName = (node.data as Record<string, unknown>).individualName as string | undefined
  const name = personality?.name || (node.data as Record<string, unknown>).label as string || 'Agent'
  const [items, setItems] = useState<MemoryItem[]>([])
  const [showClear, setShowClear] = useState(false)
  const [expExpanded, setExpExpanded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [addingStyle, setAddingStyle] = useState(false)
  const [newStyleText, setNewStyleText] = useState('')

  const saveContent = useCallback(async (c: string) => {
    try {
      if (individualName) {
        await fetch(`/api/agents/individuals/${individualName}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memory: c, memoryCount: countMemoryItems(c) }) })
        refreshAgentLibrary()
      } else if (flowId) {
        await fetch(`/api/memory/${flowId}/${node.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: c }) })
      }
      setItems(parseMemoryFile(c))
    } catch { /* ignore */ }
  }, [flowId, node.id, individualName])

  const load = useCallback(async () => {
    try {
      let raw = ''
      if (individualName) {
        const res = await fetch(`/api/agents/individuals/${individualName}`)
        if (res.ok) raw = (await res.json()).memory || ''
      } else if (flowId) {
        const res = await fetch(`/api/memory/${flowId}/${node.id}`)
        if (res.ok) raw = (await res.json()).content || ''
      }
      if (raw && isOldFormat(raw)) { raw = migrateToNewFormat(raw, name); await saveContent(raw) }
      setItems(parseMemoryFile(raw))
    } catch { /* ignore */ }
  }, [flowId, node.id, individualName, name, saveContent])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const updateItems = async (newItems: MemoryItem[]) => { await saveContent(serializeMemoryItems(newItems, name)) }
  const handleDeleteItem = async () => { if (deleteTarget) { await updateItems(items.filter(i => i.id !== deleteTarget)); setDeleteTarget(null) } }
  const handleSaveEdit = async () => { if (editingId) { await updateItems(items.map(i => i.id === editingId ? { ...i, content: editText } : i)); setEditingId(null) } }
  const handleAddStyle = async () => { if (!newStyleText.trim()) return; await updateItems([...items, { id: `style-${Date.now()}`, section: 'style', content: newStyleText.trim() }]); setNewStyleText(''); setAddingStyle(false) }

  const styleItems = items.filter(i => i.section === 'style')
  const expItems = items.filter(i => i.section === 'experience')
  const cancelAdd = () => { setAddingStyle(false); setNewStyleText('') }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Brain className="w-8 h-8 text-slate-300" />
        <p className="text-sm text-slate-400">{t('memory.noMemory')}</p>
        <p className="text-xs text-slate-300">{t('memory.noMemoryHint')}</p>
        <button onClick={() => setAddingStyle(true)} className="flex items-center gap-1 mt-2 px-3 py-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> {t('memory.addManual')}
        </button>
        {addingStyle && <StyleAddInput value={newStyleText} onChange={setNewStyleText} onSave={handleAddStyle} onCancel={cancelAdd} />}
      </div>
    )
  }

  const renderItem = (item: MemoryItem) => (
    <MemoryItemCard key={item.id} item={item} editing={editingId === item.id} editText={editText}
      onStartEdit={() => { setEditingId(item.id); setEditText(item.content) }}
      onEditChange={setEditText} onSaveEdit={handleSaveEdit}
      onCancelEdit={() => setEditingId(null)} onDelete={() => setDeleteTarget(item.id)} />
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{name} {t('memory.count').replace('{n}', String(items.length))}</p>
        <button onClick={() => setShowClear(true)} className="p-1 hover:bg-rose-50 rounded transition-colors cursor-pointer" title={t('memory.clear')}>
          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />
        </button>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-slate-500">{t('memory.styleSection')}</span>
          <button onClick={() => setAddingStyle(true)} className="p-0.5 hover:bg-indigo-50 rounded transition-colors cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500" />
          </button>
        </div>
        {styleItems.length === 0 && !addingStyle && <p className="text-[10px] text-slate-300 italic">{t('memory.noStyleItems')}</p>}
        {styleItems.map(renderItem)}
        {addingStyle && <StyleAddInput value={newStyleText} onChange={setNewStyleText} onSave={handleAddStyle} onCancel={cancelAdd} />}
      </div>
      <div>
        <button onClick={() => setExpExpanded(o => !o)} className="flex items-center gap-1 mb-2 text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
          <span>{t('memory.expSection')} ({expItems.length})</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${expExpanded ? 'rotate-180' : ''}`} />
        </button>
        {(expExpanded ? expItems : expItems.slice(-5)).map(renderItem)}
      </div>
      {showClear && <ConfirmDialog title={t('memory.clearTitle')} message={t('memory.clearMessage').replace('{name}', name)} confirmLabel={t('memory.clearConfirm')} cancelLabel={t('agentLib.deleteCancel')} onConfirm={async () => { await saveContent(''); setShowClear(false) }} onCancel={() => setShowClear(false)} />}
      {deleteTarget && <ConfirmDialog title={t('memory.deleteItemTitle')} message={t('memory.deleteItemMessage')} confirmLabel={t('agentLib.deleteConfirm')} cancelLabel={t('agentLib.deleteCancel')} onConfirm={handleDeleteItem} onCancel={() => setDeleteTarget(null)} />}
    </div>
  )
}
