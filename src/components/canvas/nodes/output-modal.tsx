'use client'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import { X, Copy, Check } from 'lucide-react'

interface OutputModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  content: string
  nodeType: string
}

export function OutputModal({ isOpen, onClose, title, content }: OutputModalProps) {
  const [copied, setCopied] = React.useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[720px] max-h-[80vh] flex flex-col overflow-hidden mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">{title}</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Output</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
            >
              {copied
                ? <><Check className="w-3.5 h-3.5" /> 已复制</>
                : <><Copy className="w-3.5 h-3.5" /> 复制内容</>
              }
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
