'use client'

import { useState } from 'react'
import { useAgentStore } from '@/store/agent-store'
import { useRegistryStore } from '@/store/registry-store'
import type { StreamEvent } from '@/types/agent'

export function GoalInput() {
  const [goal, setGoal] = useState('')
  const { config, enabledTools, enabledSkills, runState, startRun, stopRun, appendStep, appendToken, finishRun, errorRun, resetRun, clearSubSteps } = useAgentStore()
  const { skillRegistry } = useRegistryStore()
  const enabledSkillNames = skillRegistry.filter((sk) => sk.enabled).map((sk) => sk.name)

  const isRunning = runState.status === 'running'

  async function handleRun() {
    if (!goal.trim() || isRunning) return

    clearSubSteps()
    resetRun()
    startRun()

    try {
      const response = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: useAgentStore.getState().abortController?.signal,
        body: JSON.stringify({
          config,
          goal,
          enabledTools,
          enabledSkills,
          enabledSkillNames,
        }),
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n\n').filter(Boolean)

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          const event = JSON.parse(line.slice(6)) as StreamEvent

          if (event.type === 'token') appendToken(event.data)   // 新增
          if (event.type === 'step')  appendStep(event.data)
          if (event.type === 'done')  finishRun(event.data)
          if (event.type === 'error') errorRun(event.data)
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      errorRun(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
      <div style={{ fontSize: '10px', letterSpacing: '.1em', color: '#444', textTransform: 'uppercase', marginBottom: '8px' }}>
        Goal
      </div>

      <input
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleRun()}
        placeholder="What do you want the agent to do?"
        disabled={isRunning}
        style={{
          width: '100%',
          background: '#141414',
          border: '1px solid #252525',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
          color: '#e8e6e0',
          fontFamily: 'DM Sans, sans-serif',
          outline: 'none',
          boxSizing: 'border-box',
          opacity: isRunning ? 0.5 : 1,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
        <button
          onClick={handleRun}
          disabled={isRunning || !goal.trim()}
          style={{
            background: isRunning ? '#2a2a2a' : '#c8f060',
            color: isRunning ? '#666' : '#0f0f0f',
            border: 'none',
            borderRadius: '7px',
            padding: '8px 20px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            transition: 'all .15s',
          }}
        >
          {isRunning ? 'Running...' : 'Run agent'}
        </button>

        {isRunning && (
          <button
            onClick={stopRun}
            style={{
              background: 'transparent',
              color: '#ff6b6b',
              border: '1px solid rgba(255,107,107,.3)',
              borderRadius: '7px',
              padding: '8px 16px',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'all .15s',
            }}
          >
            Stop
          </button>
        )}

        {/* 状态指示 */}
        {runState.status === 'running' && (
          <span style={{ fontSize: '11px', color: '#555', fontFamily: 'DM Mono, monospace' }}>
            iteration {runState.iterationCount} / {config.maxIterations}
          </span>
        )}
        {runState.status === 'done' && (
          <span style={{ fontSize: '11px', color: '#50dc8c', fontFamily: 'DM Mono, monospace' }}>
            done in {runState.iterationCount} iterations
          </span>
        )}
        {runState.status === 'error' && (
          <span style={{ fontSize: '11px', color: '#ff6b6b', fontFamily: 'DM Mono, monospace' }}>
            error
          </span>
        )}
      </div>
    </div>
  )
}