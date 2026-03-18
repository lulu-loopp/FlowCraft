'use client'

import React, { useState } from 'react'
import { Package, GripVertical, Eye, Settings2, Trash2, ChevronDown } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { PackEntry } from '@/types/registry'

interface PacksSectionProps {
  packs: PackEntry[]
  search: string
  onDragStart?: (event: React.DragEvent, nodeType: string, agentName?: string) => void
  onDelete: (name: string) => void
}

export function PacksSection({ packs, search, onDelete }: PacksSectionProps) {
  const { t } = useUIStore()
  const [open, setOpen] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const filtered = packs.filter(p =>
    !search || p.name.includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleToast = (e: React.MouseEvent) => {
    e.stopPropagation()
    alert(t('agentLib.comingSoon'))
  }

  return (
    <div className="pt-1">
      <button
        className="w-full flex items-center justify-between px-1 py-2 border-t border-slate-100 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span>{t('agentLib.packs')}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-5 gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
            <Package className="w-5 h-5 text-slate-300" />
            <p className="text-xs text-slate-400">{t('agentLib.noPacks')}</p>
            <p className="text-[10px] text-slate-300">{t('agentLib.noPacksHint')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(pack => (
              <div
                key={pack.name}
                className="group/item flex items-start gap-2 px-2.5 py-2.5 rounded-xl border border-transparent hover:bg-violet-50 hover:border-violet-100 hover:-translate-y-px transition-all cursor-grab active:cursor-grabbing active:scale-[0.98]"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'packed')
                  e.dataTransfer.setData('application/pack-name', pack.name)
                  e.dataTransfer.effectAllowed = 'move'
                }}
              >
                <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600 shrink-0 mt-0.5">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">{pack.name}</p>
                  {pack.description && (
                    <p className="text-[11px] text-slate-400 truncate">{pack.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span>{pack.nodeCount} {t('agentLib.nodes')}</span>
                    <span>{pack.runCount} {t('agentLib.runs')}</span>
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 mt-0.5">
                  <button className="p-1 hover:bg-white rounded" title="Drag" onMouseDown={e => e.stopPropagation()}>
                    <GripVertical className="w-3 h-3 text-slate-400" />
                  </button>
                  <button className="p-1 hover:bg-white rounded" title={t('agentLib.viewInside')} onClick={handleToast}>
                    <Eye className="w-3 h-3 text-slate-400" />
                  </button>
                  <button className="p-1 hover:bg-white rounded" title={t('agentLib.edit')} onClick={handleToast}>
                    <Settings2 className="w-3 h-3 text-slate-400" />
                  </button>
                  <button
                    className="p-1 hover:bg-rose-50 rounded"
                    title={t('home.delete')}
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(pack.name) }}
                  >
                    <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={t('agentLib.deleteTitle')}
          message={t('agentLib.deleteMessage').replace('{name}', deleteTarget)}
          confirmLabel={t('agentLib.deleteConfirm')}
          cancelLabel={t('agentLib.deleteCancel')}
          onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
