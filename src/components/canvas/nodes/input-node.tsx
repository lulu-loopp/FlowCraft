'use client'
import React from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'
import { Upload, X, FileText, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

export type { InputFile } from '@/types/flow'
import type { InputFile } from '@/types/flow'

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function InputNode({ id, data, selected }: NodeProps) {
  const { setNodes, nodes, removeNode, duplicateNode, toggleNodeLock } = useFlowStore()
  const { t } = useUIStore()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const composingRef = React.useRef(false)

  const [expanded, setExpanded] = React.useState(false)
  const inputText = (data?.inputText as string) || ''
  const [localText, setLocalText] = React.useState(inputText)

  // Sync when store value changes externally (e.g. flow load)
  React.useEffect(() => {
    if (!composingRef.current) setLocalText(inputText)
  }, [inputText])
  const inputFiles = (data?.inputFiles as InputFile[]) || []
  const status = (data?.status as string) || 'idle'
  const isRunning = status === 'running'
  const isSuccess = status === 'success'

  const currentNode = nodes.find(n => n.id === id)
  const isLocked = currentNode ? currentNode.draggable === false : false

  const updateData = (key: string, value: string | InputFile[] | undefined) => {
    setNodes(nodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n
    ))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newFiles: InputFile[] = []

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const dataUrl = await readAsDataURL(file)
        newFiles.push({
          name: file.name, type: 'image',
          base64: dataUrl.split(',')[1], mimeType: file.type, preview: dataUrl,
        })
        continue
      }

      const textExts = ['.txt', '.md', '.csv', '.json', '.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css', '.yaml']
      const isText = textExts.some(ext => file.name.endsWith(ext)) || file.type.startsWith('text/')
      if (isText) {
        newFiles.push({ name: file.name, type: 'text', content: await file.text() })
        continue
      }

      alert(t('node.io.unsupportedFormat').replace('{name}', file.name))
    }

    updateData('inputFiles', [...inputFiles, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className={`relative w-[260px] bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-sky-400' : 'border-transparent'} ${isLocked ? 'nopan' : ''}`}>
      {/* Running glow ring */}
      {isRunning && (
        <div
          className="node-running-ring"
          style={{ '--glow-color': '#0ea5e9', borderColor: '#0ea5e966' } as React.CSSProperties}
        />
      )}

      {/* Inline toolbar */}
      {selected && (
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-10" onPointerDown={e => e.stopPropagation()}>
          <div className="flex gap-1 bg-white/95 p-1 rounded-lg shadow-xl shadow-slate-200/50 border border-slate-200 backdrop-blur-md">
            <button
              className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 active:scale-90 rounded-md transition-all"
              onClick={e => { e.stopPropagation(); duplicateNode(id) }}
              title={t('node.duplicate')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
            <button
              className={`p-2 rounded-md transition-all active:scale-90 ${isLocked ? 'text-amber-500 bg-amber-50' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-50'}`}
              onClick={e => { e.stopPropagation(); toggleNodeLock(id) }}
              title={isLocked ? t('node.unlockPosition') : t('node.lockPosition')}
            >
              {isLocked
                ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              }
            </button>
            <div className="w-[1px] h-4 bg-slate-200 self-center mx-0.5" />
            <button
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-md transition-all"
              onClick={e => { e.stopPropagation(); removeNode(id) }}
              title={t('node.delete')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 bg-sky-50 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-white shadow-sm">
            <span className="text-sky-600 text-sm font-bold">→</span>
          </div>
          <span className="font-semibold text-sm text-slate-800">{t('node.io')}</span>
          <button
            onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
            className="p-0.5 text-slate-400 hover:text-sky-500 transition-colors rounded"
            title={expanded ? t('node.io.collapse') : t('node.io.expand')}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        {isRunning && <span className="text-[10px] text-sky-500 font-medium animate-pulse">{t('node.io.loading')}</span>}
        {isLocked && (
          <svg className="w-3.5 h-3.5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {/* nodrag prevents ReactFlow from dragging; nopan stops pan; user-select-text enables selection */}
        <textarea
          className={`nodrag w-full p-2 text-xs border border-slate-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 placeholder:text-slate-300 bg-white cursor-text ${expanded ? 'h-48' : 'h-20'}`}
          style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
          placeholder={t('node.io.placeholder')}
          value={localText}
          onChange={e => {
            setLocalText(e.target.value)
            if (!composingRef.current) updateData('inputText', e.target.value)
          }}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={e => {
            composingRef.current = false
            const val = (e.target as HTMLTextAreaElement).value
            setLocalText(val)
            updateData('inputText', val)
          }}
        />

        {inputFiles.length > 0 && (
          <div className="space-y-1">
            {inputFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                {file.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.preview} alt={file.name} className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <span className="text-xs text-slate-600 truncate flex-1 min-w-0">{file.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); updateData('inputFiles', inputFiles.filter((_, i) => i !== index)) }}
                  className="text-slate-300 hover:text-rose-400 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg hover:border-sky-300 hover:text-sky-500 transition-colors"
        >
          <Upload className="w-3 h-3" />
          {t('node.io.uploadFiles')}
        </button>

        <input
          ref={fileInputRef} type="file" multiple
          accept="image/*,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,.yaml"
          className="hidden" onChange={handleFileUpload}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#0ea5e9', borderColor: 'white' }}
        className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-right-2 !shadow-md transition-transform duration-150"
      />
    </div>
  )
}
