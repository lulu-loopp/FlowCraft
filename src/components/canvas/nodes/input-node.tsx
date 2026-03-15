'use client'
import React from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { useFlowStore } from '@/store/flowStore'
import { Upload, X, FileText } from 'lucide-react'

export interface InputFile {
  name: string
  type: 'image' | 'text'
  content?: string
  base64?: string
  mimeType?: string
  preview?: string
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function InputNode({ id, data, selected }: NodeProps) {
  const { setNodes, nodes } = useFlowStore()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const inputText = (data?.inputText as string) || ''
  const inputFiles = (data?.inputFiles as InputFile[]) || []

  const updateData = (key: string, value: any) => {
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

      alert(`暂不支持该格式：${file.name}\n支持：图片、txt、md、csv、json、代码文件`)
    }

    updateData('inputFiles', [...inputFiles, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className={`min-w-[240px] max-w-[300px] bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-sky-400' : 'border-transparent'}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-sky-50 rounded-t-xl flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-white shadow-sm">
          <span className="text-sky-600 text-sm font-bold">→</span>
        </div>
        <span className="font-semibold text-sm text-slate-800">Input</span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <textarea
          className="w-full h-20 p-2 text-xs border border-slate-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 placeholder:text-slate-300 bg-white"
          placeholder="输入你的目标或问题..."
          value={inputText}
          onChange={e => updateData('inputText', e.target.value)}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
        />

        {inputFiles.length > 0 && (
          <div className="space-y-1">
            {inputFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                {file.type === 'image' ? (
                  <img src={file.preview} alt={file.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <span className="text-xs text-slate-600 truncate flex-1 min-w-0">{file.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); updateData('inputFiles', inputFiles.filter((_, i) => i !== index)) }}
                  className="text-slate-300 hover:text-rose-400 transition-colors flex-shrink-0"
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
          上传图片或文件
        </button>

        <input
          ref={fileInputRef} type="file" multiple
          accept="image/*,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,.yaml"
          className="hidden" onChange={handleFileUpload}
        />
      </div>

      <Handle
        type="source" position={Position.Right}
        className="w-5 h-5 bg-white border-4 border-slate-400 hover:border-sky-400 transition-colors !-right-2.5 shadow-sm"
      />
    </div>
  )
}
