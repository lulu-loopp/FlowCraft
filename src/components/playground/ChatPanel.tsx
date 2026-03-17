'use client'

import { useRef, useEffect, useState, useCallback, useMemo, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAgentStore } from '@/store/agent-store'
import { useRegistryStore } from '@/store/registry-store'

export function ChatPanel() {
  const {
    config,
    enabledTools,
    enabledSkills,
    chatState,
    sendMessage,
    appendAssistantToken,
    finishAssistantMessage,
    setChatStatus,
    clearChat,
    compressIfNeeded,
  } = useAgentStore()
  const { skillRegistry } = useRegistryStore()

  const enabledSkillNames = useMemo(
    () => skillRegistry.filter((sk) => sk.enabled).map((sk) => sk.name),
    [skillRegistry]
  )
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 新消息自动滚到底部
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatState.messages])

  const submit = useCallback(async () => {
    const text = input.trim()
    if (!text || chatState.status === 'thinking') return

    setInput('')
    sendMessage(text)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          config,
          history: chatState.messages.map((m) => ({ role: m.role, content: m.content })),
          message: text,
          enabledTools,
          enabledSkills,
          enabledSkillNames,
          summary: chatState.summary,
        }),
      })

      if (!res.ok || !res.body) {
        setChatStatus('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'token') {
              appendAssistantToken(event.data)
            } else if (event.type === 'done') {
              finishAssistantMessage()
              await compressIfNeeded()
            } else if (event.type === 'error') {
              setChatStatus('error')
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        finishAssistantMessage()
        return
      }
      setChatStatus('error')
    }
  }, [input, chatState, config, enabledTools, enabledSkills, enabledSkillNames, sendMessage, appendAssistantToken, finishAssistantMessage, setChatStatus, compressIfNeeded])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      background: '#0f0f0f',
    }}>
      {/* 消息列表 */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {chatState.messages.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333',
            fontSize: '13px',
            fontFamily: 'DM Mono, monospace',
          }}>
            start a conversation
          </div>
        )}

        {chatState.messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '72%',
              padding: '10px 14px',
              fontSize: '13px',
              lineHeight: '1.65',
              color: '#e8e6e0',
              background: msg.role === 'user' ? '#1e1e1e' : '#141414',
              border: `1px solid ${msg.role === 'user' ? '#2a2a2a' : '#1e1e1e'}`,
              borderRadius: msg.role === 'user'
                ? '12px 12px 2px 12px'
                : '12px 12px 12px 2px',
            }}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
                    pre: ({ children }) => (
                      <pre style={{
                        background: '#0a0a0a',
                        border: '1px solid #222',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        overflowX: 'auto',
                        fontSize: '12px',
                        fontFamily: 'DM Mono, monospace',
                        margin: '8px 0',
                      }}>{children}</pre>
                    ),
                    code: ({ children, className }) =>
                      className ? (
                        <code style={{ fontFamily: 'DM Mono, monospace' }}>{children}</code>
                      ) : (
                        <code style={{
                          background: '#1a1a1a',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontSize: '12px',
                          fontFamily: 'DM Mono, monospace',
                        }}>{children}</code>
                      ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {/* thinking 动画 */}
        {chatState.status === 'thinking' &&
          chatState.messages[chatState.messages.length - 1]?.role !== 'assistant' && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 16px',
              background: '#141414',
              border: '1px solid #1e1e1e',
              borderRadius: '12px 12px 12px 2px',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#444',
                    display: 'inline-block',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div style={{
        borderTop: '1px solid #1a1a1a',
        padding: '12px 16px',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          style={{
            flex: 1,
            background: '#141414',
            border: '1px solid #222',
            borderRadius: '8px',
            padding: '10px 12px',
            color: '#e8e6e0',
            fontSize: '13px',
            fontFamily: 'DM Sans, sans-serif',
            lineHeight: '1.5',
            resize: 'none',
            outline: 'none',
            minHeight: '40px',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        />
        <button
          onClick={submit}
          disabled={!input.trim() || chatState.status === 'thinking'}
          style={{
            padding: '8px 16px',
            background: input.trim() && chatState.status !== 'thinking' ? '#c8f060' : '#1e1e1e',
            color: input.trim() && chatState.status !== 'thinking' ? '#0f0f0f' : '#444',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'DM Mono, monospace',
            cursor: input.trim() && chatState.status !== 'thinking' ? 'pointer' : 'not-allowed',
            transition: 'all .15s',
            flexShrink: 0,
            height: '40px',
          }}
        >
          Send
        </button>
        {chatState.status === 'thinking' && (
          <button
            onClick={() => {
              abortRef.current?.abort()
              finishAssistantMessage()
            }}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              color: '#ff6b6b',
              border: '1px solid rgba(255,107,107,.3)',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'DM Mono, monospace',
              cursor: 'pointer',
              transition: 'all .15s',
              flexShrink: 0,
              height: '40px',
            }}
          >
            Stop
          </button>
        )}
        <button
          onClick={clearChat}
          style={{
            padding: '8px 12px',
            background: 'transparent',
            color: '#444',
            border: '1px solid #222',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'DM Mono, monospace',
            cursor: 'pointer',
            transition: 'all .15s',
            flexShrink: 0,
            height: '40px',
          }}
        >
          Clear
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}
