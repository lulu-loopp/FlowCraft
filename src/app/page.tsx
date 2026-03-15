'use client'

import { useState } from 'react'
import { ConfigPanel }  from '@/components/playground/ConfigPanel'
import { GoalInput }    from '@/components/playground/GoalInput'
import { ExecutionLog } from '@/components/playground/ExecutionLog'
import { ChatPanel }    from '@/components/playground/ChatPanel'

type Mode = 'run' | 'chat'

export default function PlaygroundPage() {
  const [mode, setMode] = useState<Mode>('run')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0f0f0f',
      color: '#e8e6e0',
      fontFamily: 'DM Sans, sans-serif',
    }}>

      {/* 顶部栏 */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 20px',
        borderBottom: '1px solid #1a1a1a',
        fontSize: '13px',
        fontWeight: 500,
        letterSpacing: '.05em',
        flexShrink: 0,
        gap: '16px',
      }}>
        <span>
          FlowCraft
          <span style={{ color: '#444', marginLeft: '4px' }}>— agent playground</span>
        </span>

        {/* Tab 切换 */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
          {(['run', 'chat'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                fontSize: '11px',
                padding: '4px 12px',
                borderRadius: '20px',
                border: `1px solid ${mode === m ? '#c8f060' : '#2a2a2a'}`,
                background: mode === m ? 'rgba(200,240,96,.06)' : 'transparent',
                color: mode === m ? '#c8f060' : '#555',
                cursor: 'pointer',
                fontFamily: 'DM Mono, monospace',
                transition: 'all .15s',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {/* 主体 */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ConfigPanel />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {mode === 'run' ? (
            <>
              <GoalInput />
              <ExecutionLog />
            </>
          ) : (
            <ChatPanel />
          )}
        </main>
      </div>

    </div>
  )
}
