'use client'
import React from 'react'
import { createPortal } from 'react-dom'
import { NodeProps } from '@xyflow/react'
import { Copy, Maximize2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { BaseNode } from './base-node'
import { OutputModal } from './output-modal'
import { useUIStore } from '@/store/uiStore'

// Inline toast via portal — avoids phantom rect from fixed inside transform
function CopyToast({ show, message }: { show: boolean; message: string }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])
  if (!show || !mounted) return null
  return createPortal(
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-4 py-2 rounded-full shadow-xl z-[200] animate-fade-in-up pointer-events-none">
      {message}
    </div>,
    document.body
  )
}

export function OutputNode({ id, data, selected }: NodeProps) {
  const { t } = useUIStore()
  const [showModal, setShowModal] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const output = (data?.currentOutput as string) || ''
  const status = data?.status as string
  const label = (data?.label as string) || 'Output'

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <BaseNode
        id={id}
        type="output"
        label={label}
        description={t('node.output.collectDescription')}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status={status as any}
        selected={selected}
        onDoubleClick={() => output && setShowModal(true)}
        hideSourceHandle
      >
        {/* Action buttons */}
        {output && (
          <div className="flex items-center justify-end gap-1 mb-2 -mt-1">
            <button
              onClick={handleCopy}
              className="p-1 text-slate-400 hover:text-indigo-500 transition-colors rounded"
              title={t('node.output.copyResult')}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setShowModal(true) }}
              className="p-1 text-slate-400 hover:text-indigo-500 transition-colors rounded"
              title={t('node.output.viewFullResult')}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!output ? (
          <p className="text-xs text-slate-400 text-center py-3">{t('node.output.waiting')}</p>
        ) : (
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 max-h-28 overflow-y-auto">
            <div className="prose-node text-slate-700">
              <ReactMarkdown>{output.slice(0, 400)}</ReactMarkdown>
              {output.length > 400 && (
                <p className="text-slate-400 text-[10px] mt-1">{t('node.output.doubleClickView')}</p>
              )}
            </div>
          </div>
        )}
      </BaseNode>

      {showModal && (
        <OutputModal isOpen={showModal} onClose={() => setShowModal(false)} title={label} content={output} nodeType="output" />
      )}

      <CopyToast show={copied} message={t('node.output.copySuccess')} />
    </>
  )
}
