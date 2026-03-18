'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, X, Info, Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useUIStore } from '@/store/uiStore'
import { sendSSEChat } from '@/lib/sse-chat'
import { ChatMemorySummary } from './chat-memory-summary'
import { distillChatMemory, appendMemory } from '@/lib/memory-updater'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  agentName: string
  role: string
  memoryCount: number
  runCount: number
  systemPrompt: string
  existingMemory: string
  provider?: string
  model?: string
  onClose: () => void
  onMemoryUpdated?: () => void
}

export function AgentChatModal({
  agentName, role, memoryCount, runCount,
  systemPrompt, existingMemory, provider, model,
  onClose, onMemoryUpdated,
}: Props) {
  const { t } = useUIStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'thinking'>('idle')
  const [memorySummary, setMemorySummary] = useState<string[] | null>(null)
  const [newMemoryCount, setNewMemoryCount] = useState(memoryCount)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

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
          id: `chat-${agentName}`,
          name: agentName,
          systemPrompt: existingMemory
            ? `${systemPrompt}\n\nYour accumulated memory:\n${existingMemory}`
            : systemPrompt,
          model: { provider: provider || 'anthropic', model: model || 'claude-sonnet-4-6', apiKey: '' },
          maxIterations: 1,
        },
        history: messages.map(m => ({ role: m.role, content: m.content })),
        message: text,
        signal: controller.signal,
        onToken: (token) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + token } : m
          ))
        },
        onDone: () => setStatus('idle'),
        onError: () => setStatus('idle'),
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setStatus('idle')
    }
    setStatus('idle')
  }, [input, status, messages, agentName, systemPrompt, existingMemory, provider, model])

  const handleClose = useCallback(async () => {
    // Distill memory from conversation
    if (messages.length >= 2) {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const result = await distillChatMemory(history, existingMemory)
      if (result) {
        // Write to 工作风格 section via appendMemory
        try {
          await appendMemory(
            { flowId: '', nodeId: '', individualName: agentName },
            result,
            agentName,
          )
          const items = result.content.split('\n').filter(l => l.trim()).slice(0, 5)
          setMemorySummary(items)
          setNewMemoryCount(prev => prev + 1)
          onMemoryUpdated?.()
          return // Don't close yet, show summary
        } catch { /* silent */ }
      }
      // Save chat history
      try {
        await fetch(`/api/agents/individuals/${agentName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatHistory: { timestamp: Date.now(), messages: history },
          }),
        })
      } catch { /* silent */ }
    }
    onClose()
  }, [messages, existingMemory, agentName, onClose, onMemoryUpdated])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[90vw] h-[600px] max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800">
                {t('chat.title').replace('{name}', agentName)}
              </h2>
            </div>
            <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {role} · {memoryCount} {t('agentLib.memories')} · {runCount} {t('agentLib.runs')}
          </p>
        </div>

        {/* Memory summary overlay */}
        {memorySummary ? (
          <ChatMemorySummary
            items={memorySummary}
            agentName={agentName}
            memoryCount={newMemoryCount}
            onClose={onClose}
          />
        ) : (
          <>
            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-slate-300">{t('chat.startHint')}</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed rounded-xl ${
                    msg.role === 'user'
                      ? 'bg-indigo-50 text-slate-700 rounded-br-sm'
                      : 'bg-slate-50 text-slate-700 rounded-bl-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      }}>{msg.content || '...'}</ReactMarkdown>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
              {status === 'thinking' && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 rounded-xl rounded-bl-sm px-3 py-2 flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info bar */}
            <div className="px-4 py-2 border-t border-slate-100 bg-indigo-50/50 shrink-0">
              <p className="text-[10px] text-indigo-500 flex items-center gap-1">
                <Info className="w-3 h-3" />
                {t('chat.memoryNotice').replace('{name}', agentName)}
              </p>
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-slate-100 flex gap-2 shrink-0">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                placeholder={t('chat.inputPlaceholder')}
                rows={1}
                className="flex-1 text-sm p-2.5 border border-slate-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-indigo-200 min-h-[40px] max-h-[100px]"
              />
              <button
                onClick={submit}
                disabled={!input.trim() || status === 'thinking'}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
