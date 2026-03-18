'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, X, AlertCircle, Send } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { sendSSEChat } from '@/lib/sse-chat'
import { ChatMemorySummary } from './chat-memory-summary'
import { ChatMessageList, type ChatMessage } from './chat-message-list'
import { distillFeedbackMemory, appendMemory, incrementRunCount } from '@/lib/memory-updater'

interface Props {
  agentName: string
  individualName?: string
  role: string
  memoryCount: number
  runCount: number
  systemPrompt: string
  existingMemory: string
  runOutput: string
  flowId: string
  nodeId: string
  provider?: string
  model?: string
  onClose: () => void
}

export function FeedbackChatModal({
  agentName, individualName, role, memoryCount,
  systemPrompt, existingMemory, runOutput,
  flowId, nodeId, provider, model, onClose,
}: Props) {
  const { t } = useUIStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'thinking'>('idle')
  const [memorySummary, setMemorySummary] = useState<string[] | null>(null)
  const [newMemoryCount, setNewMemoryCount] = useState(memoryCount)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const summary = runOutput.slice(0, 300).replace(/\n/g, ' ')
    setMessages([{
      id: 'opening', role: 'assistant',
      content: t('feedback.opening').replace('{summary}', summary),
    }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = useCallback(async () => {
    const text = input.trim()
    if (!text || status === 'thinking') return
    setInput('')
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setStatus('thinking')
    const assistantId = `a-${Date.now()}`
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await sendSSEChat({
        config: {
          id: `feedback-${agentName}`, name: agentName,
          systemPrompt: existingMemory ? `${systemPrompt}\n\nYour accumulated memory:\n${existingMemory}` : systemPrompt,
          model: { provider: provider || 'anthropic', model: model || 'claude-sonnet-4-6', apiKey: '' },
          maxIterations: 1,
        },
        history: messages.map(m => ({ role: m.role, content: m.content })),
        message: text, signal: controller.signal,
        onToken: (token) => setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + token } : m)),
        onDone: () => setStatus('idle'),
        onError: () => setStatus('idle'),
      })
    } catch (err) { if ((err as Error).name !== 'AbortError') setStatus('idle') }
    setStatus('idle')
  }, [input, status, messages, agentName, systemPrompt, existingMemory, provider, model])

  const handleClose = useCallback(async () => {
    const userMessages = messages.filter(m => m.role === 'user')
    if (userMessages.length >= 1) {
      const history = messages.filter(m => m.id !== 'opening').map(m => ({ role: m.role, content: m.content }))
      const result = await distillFeedbackMemory(history, runOutput)
      if (result) {
        await appendMemory({ flowId, nodeId, individualName }, result, agentName)
        if (individualName) incrementRunCount(individualName).catch(() => {})
        setMemorySummary(result.content.split('\n').filter(l => l.trim()).slice(0, 5))
        setNewMemoryCount(prev => prev + 1)
        return
      }
    }
    onClose()
  }, [messages, runOutput, flowId, nodeId, individualName, agentName, onClose])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[680px] max-w-[90vw] h-[720px] max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800">{t('chat.title').replace('{name}', agentName)}</h2>
            </div>
            <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">{role} · {t('feedback.aboutRun')}</p>
        </div>

        {memorySummary ? (
          <ChatMemorySummary items={memorySummary} agentName={agentName} memoryCount={newMemoryCount} onClose={onClose} />
        ) : (
          <>
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 shrink-0">
              <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {t('feedback.banner')}
              </p>
            </div>
            <ChatMessageList messages={messages} status={status} />
            <div className="px-4 py-3 border-t border-slate-100 flex gap-2 shrink-0">
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                placeholder={t('chat.inputPlaceholder')} rows={1}
                className="flex-1 text-sm p-2.5 border border-slate-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-indigo-200 min-h-[40px] max-h-[100px]" />
              <button onClick={submit} disabled={!input.trim() || status === 'thinking'}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors shrink-0 cursor-pointer">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
