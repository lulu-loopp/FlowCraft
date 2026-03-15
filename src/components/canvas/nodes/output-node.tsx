'use client'
import React from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Copy, Maximize2 } from 'lucide-react'
import { useCopyToast } from '@/components/ui/copy-toast'
import { OutputModal } from './output-modal'

export function OutputNode({ id, data, selected }: NodeProps) {
  const [showModal, setShowModal] = React.useState(false)
  const { copy, Toast } = useCopyToast()

  const output = (data?.currentOutput as string) || ''

  return (
    <>
      <div
        className={`min-w-[240px] max-w-[300px] bg-white rounded-xl shadow-sm border-2 transition-all cursor-pointer ${selected ? 'border-slate-400' : 'border-transparent'}`}
        onDoubleClick={() => output && setShowModal(true)}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white shadow-sm">
              <span className="text-slate-600 text-sm font-bold">←</span>
            </div>
            <span className="font-semibold text-sm text-slate-800">Output</span>
          </div>
          {output && (
            <div className="flex items-center gap-1">
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
        </div>

        {/* Body */}
        <div className="p-3">
          {!output ? (
            <p className="text-xs text-slate-400 text-center py-4">等待上游节点输出...</p>
          ) : (
            <div className="text-xs text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg p-2 max-h-24 overflow-y-auto leading-relaxed">
              {output.slice(0, 200)}
              {output.length > 200 && (
                <span className="text-slate-400"> ...双击查看全部</span>
              )}
            </div>
          )}
        </div>

        <Handle
          type="target" position={Position.Left}
          className="w-5 h-5 bg-white border-4 border-slate-300 hover:border-slate-500 transition-colors !-left-2.5 shadow-sm"
        />
      </div>

      {showModal && (
        <OutputModal isOpen={showModal} onClose={() => setShowModal(false)} title="Output" content={output} nodeType="output" />
      )}

      <Toast />
    </>
  )
}
