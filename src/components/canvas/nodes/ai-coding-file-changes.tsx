import React from 'react'
import { FilePen, FilePlus, FileX } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import type { FileChange } from '@/hooks/useCodingAgent'

interface Props {
  changes: FileChange[]
  maxShow?: number
}

const STATUS_ICON = {
  modified: FilePen,
  added: FilePlus,
  deleted: FileX,
} as const

const STATUS_COLOR = {
  modified: 'text-amber-600',
  added: 'text-emerald-600',
  deleted: 'text-rose-500',
} as const

export function AiCodingFileChanges({ changes, maxShow = 5 }: Props) {
  const { t } = useUIStore()
  if (changes.length === 0) return null

  const visible = changes.slice(0, maxShow)
  const remaining = changes.length - visible.length

  return (
    <div className="mt-2">
      <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1 font-medium">
        {t('aiCoding.fileChanges')}
        {changes.length > 0 && (
          <span className="text-slate-500 normal-case ml-1">({changes.length})</span>
        )}
      </div>
      <div className="space-y-0.5">
        {visible.map(change => {
          const Icon = STATUS_ICON[change.status]
          const color = STATUS_COLOR[change.status]
          return (
            <div key={change.file} className="flex items-center gap-1.5 text-[10px]">
              <Icon className={`w-3 h-3 shrink-0 ${color}`} />
              <span className="truncate text-slate-600 font-mono">{change.file}</span>
            </div>
          )
        })}
        {remaining > 0 && (
          <div className="text-[10px] text-slate-400 pl-4.5">
            +{remaining} more
          </div>
        )}
      </div>
    </div>
  )
}
