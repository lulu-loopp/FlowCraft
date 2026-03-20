'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check, Pencil, Eye, Save, Download, Loader2 } from 'lucide-react'
import { MarkdownRenderer } from './markdown-renderer'
import { useUIStore } from '@/store/uiStore'

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  /** Display title (filename) */
  title: string
  /** For workspace files: flowId + relativePath to enable read/edit via API */
  flowId?: string
  filePath?: string
  /** For document links: direct content (no API needed) */
  initialContent?: string
  /** Whether editing is allowed */
  editable?: boolean
}

type ViewMode = 'preview' | 'edit'

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    md: 'markdown', json: 'json', js: 'javascript', ts: 'typescript',
    tsx: 'typescript', jsx: 'javascript', py: 'python', html: 'html',
    css: 'css', csv: 'csv', yaml: 'yaml', yml: 'yaml', txt: 'text',
  }
  return map[ext] || 'text'
}

function isMarkdown(filePath: string): boolean {
  return /\.md$/i.test(filePath)
}

const BINARY_EXTS = new Set(['pptx', 'xlsx', 'docx', 'pdf', 'zip', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'mp4', 'wav'])

function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return BINARY_EXTS.has(ext)
}

function isImageFile(filePath: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(filePath)
}

const FILE_TYPE_LABELS: Record<string, string> = {
  pptx: 'PowerPoint', xlsx: 'Excel', docx: 'Word', pdf: 'PDF',
  zip: 'ZIP Archive', png: 'Image', jpg: 'Image', jpeg: 'Image',
  gif: 'Image', webp: 'Image', mp3: 'Audio', mp4: 'Video', wav: 'Audio',
}

export function FilePreviewModal({
  isOpen, onClose, title, flowId, filePath, initialContent, editable = true,
}: FilePreviewModalProps) {
  const { t } = useUIStore()
  const [prevInitial, setPrevInitial] = useState(initialContent)
  const [content, setContent] = useState(initialContent || '')
  const [editContent, setEditContent] = useState('')
  const [previewFormat, setPreviewFormat] = useState<'text' | 'markdown' | 'html' | 'iframe'>('text')
  const [iframeUrl, setIframeUrl] = useState('')
  const [mode, setMode] = useState<ViewMode>('preview')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Sync content when initialContent prop changes (setState during render is the React-recommended pattern)
  if (initialContent !== prevInitial) {
    setPrevInitial(initialContent)
    if (initialContent !== undefined) {
      setContent(initialContent)
      setEditContent(initialContent)
      setMode('preview')
      setDirty(false)
    }
  }

  // Load file content from API (only for workspace files, not initialContent)
  useEffect(() => {
    if (!isOpen) return
    if (initialContent !== undefined) return
    if (!flowId || !filePath) return

    const controller = new AbortController()
    const binary = isBinaryFile(filePath)

    const doFetch = async () => {
      setLoading(true)
      try {
        // For convertible binary files (pptx/xlsx/docx/pdf), use the preview API
        const url = binary
          ? `/api/workspace/${flowId}/preview?path=${encodeURIComponent(filePath)}`
          : `/api/workspace/${flowId}/file?path=${encodeURIComponent(filePath)}`

        const res = await fetch(url, { signal: controller.signal })
        if (controller.signal.aborted) return
        if (res.ok) {
          const data = await res.json()
          const fmt = data.format || 'text'
          if (fmt === 'iframe') {
            setIframeUrl(data.url)
            setPreviewFormat('iframe')
            setContent('')
          } else {
            setContent(data.content || '')
            setEditContent(data.content || '')
            setPreviewFormat(fmt === 'html' ? 'html' : fmt === 'markdown' ? 'markdown' : 'text')
          }
          setDirty(false)
        } else {
          setContent('')
        }
      } catch {
        if (!controller.signal.aborted) setContent('')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    doFetch()
    return () => controller.abort()
  }, [isOpen, flowId, filePath, initialContent])

  const handleSave = useCallback(async () => {
    if (!flowId || !filePath) return
    setSaving(true)
    try {
      const res = await fetch(`/api/workspace/${flowId}/file?path=${encodeURIComponent(filePath)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      if (res.ok) {
        setContent(editContent)
        setDirty(false)
        setMode('preview')
      }
    } catch { /* ignore */ }
    setSaving(false)
  }, [flowId, filePath, editContent])

  const handleCopy = () => {
    navigator.clipboard.writeText(mode === 'edit' ? editContent : content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = title
    a.click()
    URL.revokeObjectURL(url)
  }

  const switchToEdit = () => {
    setEditContent(content)
    setMode('edit')
  }

  const switchToPreview = () => {
    setMode('preview')
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'edit' && dirty) {
          switchToPreview()
        } else {
          onClose()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && mode === 'edit') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, mode, dirty, onClose, handleSave])

  if (!isOpen || typeof document === 'undefined') return null

  const resolvedPath = filePath || title
  const lang = getLanguageFromPath(resolvedPath)
  const isMd = isMarkdown(resolvedPath)
  const isBinary = isBinaryFile(resolvedPath)
  const isImage = isImageFile(resolvedPath)
  const canEdit = editable && flowId && filePath && !isBinary
  const ext = resolvedPath.split('.').pop()?.toLowerCase() || ''
  const typeLabel = FILE_TYPE_LABELS[ext] || ext.toUpperCase()

  // Binary download URL
  const binaryDownloadUrl = flowId && filePath
    ? `/api/workspace/${flowId}/file?path=${encodeURIComponent(filePath)}&download=1`
    : undefined

  return createPortal(
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999]"
      onClick={() => { if (!dirty) onClose() }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[780px] max-w-[92vw] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-800 truncate">{title}</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full uppercase shrink-0">
              {isBinary ? typeLabel : lang}
            </span>
            {dirty && (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">
                {t('file.unsaved')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mode toggle */}
            {canEdit && mode === 'preview' && (
              <button
                onClick={switchToEdit}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-600 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> {t('file.edit')}
              </button>
            )}
            {mode === 'edit' && (
              <button
                onClick={switchToPreview}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-600 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> {t('file.preview')}
              </button>
            )}
            {/* Save button */}
            {mode === 'edit' && dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {t('file.save')}
              </button>
            )}
            {/* Copy (text files only) */}
            {!isBinary && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-600 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t('file.copied') : t('file.copy')}
              </button>
            )}
            {/* Download */}
            {isBinary && binaryDownloadUrl ? (
              <a
                href={binaryDownloadUrl}
                download={title}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> {t('file.download')}
              </a>
            ) : (
              <button
                onClick={handleDownload}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title={t('file.download')}
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
            </div>
          ) : isBinary && isImage && binaryDownloadUrl ? (
            /* Image: render inline */
            <div className="flex items-center justify-center py-8 px-8">
              <img
                src={binaryDownloadUrl}
                alt={title}
                className="max-w-full max-h-[60vh] rounded-xl shadow-lg border border-slate-200"
              />
            </div>
          ) : isBinary && previewFormat === 'iframe' && iframeUrl ? (
            /* PDF: native browser rendering via iframe */
            <iframe
              src={iframeUrl}
              className="w-full h-[75vh] border-0"
              title={title}
            />
          ) : isBinary && previewFormat === 'html' && content ? (
            /* DOCX/XLSX: rich HTML preview */
            <div
              className="px-6 py-5 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : isBinary && content ? (
            /* Fallback: markitdown output as markdown */
            <div className="px-6 py-5 prose prose-sm prose-slate max-w-none">
              <MarkdownRenderer>{content}</MarkdownRenderer>
            </div>
          ) : isBinary ? (
            /* Binary fallback: info card */
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <div className="w-20 h-20 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-5">
                <span className="text-2xl font-bold text-teal-600">{ext.toUpperCase()}</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1 text-center">{title}</h3>
              <p className="text-sm text-slate-500 mb-6">{typeLabel} file</p>
              {binaryDownloadUrl && (
                <a
                  href={binaryDownloadUrl}
                  download={title}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  {t('file.download')}
                </a>
              )}
            </div>
          ) : mode === 'edit' ? (
            <textarea
              className="w-full h-full min-h-[400px] p-5 font-mono text-sm text-slate-700 bg-slate-50 resize-none outline-none leading-relaxed"
              value={editContent}
              onChange={e => { setEditContent(e.target.value); setDirty(true) }}
              spellCheck={false}
            />
          ) : isMd ? (
            <div className="px-6 py-5 prose prose-sm prose-slate max-w-none">
              <MarkdownRenderer>{content}</MarkdownRenderer>
            </div>
          ) : (
            <pre className="px-6 py-5 font-mono text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
