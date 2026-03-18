'use client'

import React, { useState } from 'react'
import { Send, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useFlowStore } from '@/store/flowStore'

interface Props {
  nodeId: string
  onClose: () => void
}

/**
 * MVP intervene panel: send a message to an agent during execution.
 * The message is stored in node.data.pendingMessage and can be picked up
 * by the next iteration of the agent loop.
 */
export function NodeIntervenePanel({ nodeId, onClose }: Props) {
  const { t } = useUIStore()
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const handleSend = () => {
    if (!message.trim()) return
    const store = useFlowStore.getState()
    store.setNodes(store.nodes.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, pendingMessage: message.trim() } }
        : n
    ))
    setSent(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div
      className="absolute top-8 right-0 z-50 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
        <span className="text-xs font-medium text-slate-600">{t('intervene.sendMessage')}</span>
        <button onClick={onClose} className="p-0.5 hover:bg-slate-200 rounded transition-colors cursor-pointer">
          <X className="w-3 h-3 text-slate-400" />
        </button>
      </div>
      {sent ? (
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-emerald-600 font-medium">{t('intervene.sent')}</p>
        </div>
      ) : (
        <div className="p-2">
          <textarea
            className="w-full text-xs p-2 border border-slate-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-indigo-200 h-16"
            placeholder={t('intervene.placeholder')}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="mt-1.5 w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer"
          >
            <Send className="w-3 h-3" /> {t('intervene.send')}
          </button>
        </div>
      )}
    </div>
  )
}
