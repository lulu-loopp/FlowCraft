'use client'
import React from 'react'
import { NodeProps } from '@xyflow/react'
import { Copy, Maximize2 } from 'lucide-react'
import { BaseNode } from './base-node'
import { OutputModal } from './output-modal'
import { useCopyToast } from '@/components/ui/copy-toast'

export function OutputNode({ id, data, selected }: NodeProps) {
  const [showModal, setShowModal] = React.useState(false)
  const { copy, Toast } = useCopyToast()

  const output = (data?.currentOutput as string) || ''
  const status = data?.status as string

  return (
    <>
      <BaseNode
        id={id}
        type="output"
        label={(data?.label as string) || 'Output'}
        description="Collects flow result"
        status={status as any}
        selected={selected}
        onDoubleClick={() => output && setShowModal(true)}
      >
        {/* Action buttons */}
        {output && (
          <div className="flex items-center justify-end gap-1 mb-2 -mt-1">
            <button
              onClick={e => { e.stopPropagation(); copy(output) }}
              className="p-1 text-slate-400 hover:text-indigo-500 transition-colors rounded"
              title="复制结果"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setShowModal(true) }}
              className="p-1 text-slate-400 hover:text-indigo-500 transition-colors rounded"
              title="查看完整结果"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!output ? (
          <p className="text-xs text-slate-400 text-center py-3">等待上游节点输出...</p>
        ) : (
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 max-h-24 overflow-y-auto leading-relaxed">
            {output.slice(0, 200)}
            {output.length > 200 && (
              <span className="text-slate-400"> ...双击查看全部</span>
            )}
          </div>
        )}
      </BaseNode>

      {showModal && (
        <OutputModal isOpen={showModal} onClose={() => setShowModal(false)} title={(data?.label as string) || 'Output'} content={output} nodeType="output" />
      )}

      <Toast />
    </>
  )
}
