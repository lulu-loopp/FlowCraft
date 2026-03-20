'use client'
import React from 'react'
import { createPortal } from 'react-dom'
import { NodeProps } from '@xyflow/react'
import { Copy, Maximize2, Eye, Download } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { BaseNode } from './base-node'
import { OutputModal } from './output-modal'
import { FilePreviewModal } from '@/components/ui/file-preview-modal'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'
import { useRunFromNode } from '@/hooks/useRunFromNode'
import type { OutputNodeData } from '@/types/flow'

/** Extract the workspace-relative path from a download URL like /api/workspace/{id}/file?path=foo.pptx&download=1 */
function extractPathFromUrl(url: string): string | null {
  try {
    const u = new URL(url, 'http://localhost')
    return u.searchParams.get('path')
  } catch { return null }
}

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
  const flowId = useFlowStore(s => s.flowId)
  const runCtx = useRunFromNode()
  const [showModal, setShowModal] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [previewDoc, setPreviewDoc] = React.useState<{ name: string; url: string } | null>(null)

  const d = data as OutputNodeData
  const output = d.currentOutput || ''
  const status = d.status
  const label = d.label || 'Output'
  const documents = d.documents || []
  const documentUrl = d.documentUrl
  const documentName = d.documentName

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
        status={status}
        selected={selected}
        onRunFromHere={runCtx ? () => runCtx.runFromNode(id) : undefined}
        onRunSingleNode={runCtx ? (opts) => runCtx.runSingleNode(id, opts) : undefined}
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
              <MarkdownRenderer>{output.slice(0, 400)}</MarkdownRenderer>
              {output.length > 400 && (
                <p className="text-slate-400 text-[10px] mt-1">{t('node.output.doubleClickView')}</p>
              )}
            </div>
          </div>
        )}

        {/* Document preview / download links */}
        {documents.length > 0 ? (
          <div className="mt-2 space-y-1">
            {documents.map((doc, i) => (
              <div key={i} className="flex items-center gap-1 w-full">
                <button
                  onClick={e => { e.stopPropagation(); setPreviewDoc(doc) }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors flex-1 min-w-0"
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </button>
                <a
                  href={doc.url}
                  download={doc.name}
                  onClick={e => e.stopPropagation()}
                  className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors shrink-0"
                  title={t('file.download')}
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        ) : documentUrl ? (
          <button
            onClick={e => { e.stopPropagation(); setPreviewDoc({ url: documentUrl, name: documentName || 'document.md' }) }}
            className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors w-full"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{documentName || t('node.output.viewDocument')}</span>
          </button>
        ) : null}
      </BaseNode>

      {showModal && (
        <OutputModal isOpen={showModal} onClose={() => setShowModal(false)} title={label} content={output} nodeType="output" />
      )}

      {previewDoc && flowId && (
        <FilePreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.name}
          flowId={flowId}
          filePath={extractPathFromUrl(previewDoc.url) || previewDoc.name}
          editable
        />
      )}

      <CopyToast show={copied} message={t('node.output.copySuccess')} />
    </>
  )
}
