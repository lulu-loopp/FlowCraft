'use client'

import { useEffect, useRef } from 'react'
import { useAgentStore } from '@/store/agent-store'
import type { AgentStep } from '@/types/agent'
import ReactMarkdown from 'react-markdown'

export function ExecutionLog() {
  const { runState } = useAgentStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  // 新步骤出现时自动滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [runState.steps.length])

  if (runState.status === 'idle') {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#2a2a2a',
        fontSize: '13px',
        fontFamily: 'DM Mono, monospace',
      }}>
        set a goal and run the agent
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      padding: '16px 20px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {runState.steps.map((step) => {
        const isSubStep = step.content.startsWith('[') && step.content.includes(']')
        const subAgentName = isSubStep
          ? step.content.match(/^\[(.+?)\]/)?.[1] ?? ''
          : ''
        const displayContent = isSubStep
          ? step.content.replace(/^\[.+?\]\s*/, '')
          : step.content

        return isSubStep ? (
          <div
            key={step.id}
            style={{
              paddingLeft: '24px',
              borderLeft: '2px solid rgba(147,130,255,.3)',
              marginLeft: '11px',
            }}
          >
            <div style={{
              fontSize: '10px',
              color: '#534AB7',
              fontFamily: 'DM Mono, monospace',
              marginBottom: '2px',
            }}>
              ↳ {subAgentName}
            </div>
            <StepRow step={{ ...step, content: displayContent }} />
          </div>
        ) : (
          <StepRow key={step.id} step={step} />
        )
      })}

      {/* 运行中显示跳动光标 */}
      {runState.status === 'running' && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <StepIcon type="thinking" />
          <span style={{
            fontSize: '12px',
            color: '#444',
            fontFamily: 'DM Mono, monospace',
          }}>
            thinking
            <span style={{ animation: 'blink .8s step-end infinite' }}>▋</span>
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function StepRow({ step }: { step: AgentStep }) {
  const labelMap = {
    thinking:    'think',
    tool_call:   `tool_call → ${step.toolName ?? ''}`,
    tool_result: `observe ← ${step.toolName ?? ''}`,
    done:        'done',
    error:       'error',
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <StepIcon type={step.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '10px',
          color: '#444',
          fontFamily: 'DM Mono, monospace',
          marginBottom: '3px',
          letterSpacing: '.05em',
        }}>
          {labelMap[step.type]}
        </div>
        <div style={{
          fontSize: '12px',
          color: step.type === 'done' ? '#c8f060'
              : step.type === 'error' ? '#ff6b6b'
              : step.type === 'thinking' ? '#d4d2cc'
              : '#9a9a8e',
          fontFamily: step.type === 'tool_call' || step.type === 'tool_result'
            ? 'DM Mono, monospace'
            : 'DM Sans, sans-serif',
          lineHeight: '1.8',
          wordBreak: 'break-word',
        }}>
          <ReactMarkdown
            components={{
              // 标题
              h1: ({ children }) => <div style={{ fontSize: '14px', fontWeight: 500, margin: '10px 0 4px' }}>{children}</div>,
              h2: ({ children }) => <div style={{ fontSize: '13px', fontWeight: 500, margin: '8px 0 4px' }}>{children}</div>,
              h3: ({ children }) => <div style={{ fontSize: '12px', fontWeight: 500, margin: '6px 0 4px' }}>{children}</div>,
              // 加粗
              strong: ({ children }) => <span style={{ fontWeight: 500, color: '#e8e6e0' }}>{children}</span>,
              // 行内代码
              code: ({ children }) => (
                <code style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  background: '#1e1e1e',
                  border: '1px solid #2a2a2a',
                  borderRadius: '4px',
                  padding: '1px 5px',
                  color: '#c8f060',
                }}>
                  {children}
                </code>
              ),
              // 代码块
              pre: ({ children }) => (
                <pre style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  background: '#141414',
                  border: '1px solid #222',
                  borderRadius: '8px',
                  padding: '10px',
                  overflowX: 'auto',
                  margin: '6px 0',
                }}>
                  {children}
                </pre>
              ),
              // 列表
              ul: ({ children }) => <ul style={{ paddingLeft: '16px', margin: '4px 0' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: '16px', margin: '4px 0' }}>{children}</ol>,
              li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
              // 段落
              p: ({ children }) => <p style={{ margin: '4px 0' }}>{children}</p>,
              // 链接
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noreferrer" style={{ color: '#7f77dd', textDecoration: 'none' }}>
                  {children}
                </a>
              ),
            }}
          >
            {step.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function StepIcon({ type }: { type: AgentStep['type'] }) {
  const colorMap = {
    thinking:    { bg: 'rgba(147,130,255,.15)', color: '#9382ff', border: 'rgba(147,130,255,.2)', label: 'T' },
    tool_call:   { bg: 'rgba(200,240,96,.1)',   color: '#c8f060', border: 'rgba(200,240,96,.2)',  label: 'A' },
    tool_result: { bg: 'rgba(255,180,80,.1)',   color: '#ffb450', border: 'rgba(255,180,80,.2)',  label: 'O' },
    done:        { bg: 'rgba(80,220,140,.1)',   color: '#50dc8c', border: 'rgba(80,220,140,.2)',  label: 'D' },
    error:       { bg: 'rgba(255,107,107,.1)',  color: '#ff6b6b', border: 'rgba(255,107,107,.2)', label: '!' },
  }
  const s = colorMap[type]
  return (
    <div style={{
      width: '22px', height: '22px',
      borderRadius: '5px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '9px',
      fontFamily: 'DM Mono, monospace',
      fontWeight: 500,
      flexShrink: 0,
      marginTop: '1px',
    }}>
      {s.label}
    </div>
  )
}