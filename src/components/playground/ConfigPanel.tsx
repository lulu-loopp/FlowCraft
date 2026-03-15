'use client'

import { useAgentStore } from '@/store/agent-store'
import { MODEL_OPTIONS } from '@/types/model'
import type { ModelProvider } from '@/types/model'
import { TOOL_DESCRIPTIONS } from '@/lib/tools/definitions'
import type { ToolName } from '@/lib/tools/definitions'
import { SKILL_DESCRIPTIONS } from '@/lib/skills/definitions'
import type { SkillName } from '@/lib/skills/definitions'
import { SkillInstaller } from './SkillInstaller'
import { AgentInstaller } from './AgentInstaller'

export function ConfigPanel() {
  const {
    config,
    enabledTools,
    enabledSkills,
    setSystemPrompt,
    setModel,
    setMaxIterations,
    toggleTool,
    toggleSkill,
  } = useAgentStore()

  return (
    <aside style={{
      width: '260px',
      flexShrink: 0,
      borderRight: '1px solid #1a1a1a',
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      overflowY: 'auto',
    }}>

      {/* System prompt */}
      <section>
        <Label>System prompt</Label>
        <textarea
          value={config.systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          style={{
            width: '100%',
            background: '#141414',
            border: '1px solid #222',
            borderRadius: '8px',
            padding: '10px',
            color: '#9a9a8e',
            fontSize: '12px',
            fontFamily: 'DM Mono, monospace',
            lineHeight: '1.6',
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </section>

      {/* Model provider */}
      <section>
        <Label>Provider</Label>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(['anthropic', 'openai', 'deepseek'] as ModelProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => setModel(p, MODEL_OPTIONS[p][0])}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '20px',
                border: `1px solid ${config.model.provider === p ? '#c8f060' : '#2a2a2a'}`,
                background: config.model.provider === p ? 'rgba(200,240,96,.06)' : 'transparent',
                color: config.model.provider === p ? '#c8f060' : '#666',
                cursor: 'pointer',
                fontFamily: 'DM Mono, monospace',
                transition: 'all .15s',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* Model selector */}
      <section>
        <Label>Model</Label>
        <select
          value={config.model.model}
          onChange={(e) => setModel(config.model.provider, e.target.value)}
          style={{
            width: '100%',
            background: '#141414',
            border: '1px solid #222',
            borderRadius: '8px',
            padding: '8px 10px',
            color: '#9a9a8e',
            fontSize: '12px',
            fontFamily: 'DM Mono, monospace',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {MODEL_OPTIONS[config.model.provider].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </section>


      {/* Tools */}
      <section>
        <Label>Tools</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(Object.keys(TOOL_DESCRIPTIONS) as ToolName[]).map((name) => {
            const enabled = enabledTools.includes(name)
            return (
              <div
                key={name}
                onClick={() => toggleTool(name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: '#141414',
                  border: `1px solid ${enabled ? '#c8f060' : '#222'}`,
                  borderRadius: '7px',
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                <span style={{
                  fontSize: '12px',
                  color: enabled ? '#c8f060' : '#555',
                  fontFamily: 'DM Mono, monospace',
                }}>
                  {name}
                </span>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: enabled ? '#c8f060' : '#333',
                  transition: 'all .15s',
                }} />
              </div>
            )
          })}
        </div>
      </section>

      {/* Skills */}
      <section>
        <Label>Skills</Label>
        <SkillInstaller />
      </section>

      <div style={{ height: '1px', background: '#1a1a1a', margin: '4px 0' }} />

      {/* Subagents */}
      <section>
        <Label>Subagents</Label>

        {/* 内置 subagent */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {(Object.keys(SKILL_DESCRIPTIONS) as SkillName[]).map((name) => {
            const enabled = enabledSkills.includes(name)
            return (
              <div
                key={name}
                onClick={() => toggleSkill(name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: '#141414',
                  border: `1px solid ${enabled ? '#9382ff' : '#222'}`,
                  borderRadius: '7px',
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{
                    fontSize: '12px',
                    color: enabled ? '#9382ff' : '#555',
                    fontFamily: 'DM Mono, monospace',
                  }}>
                    {name}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    color: '#333',
                    fontFamily: 'DM Sans, sans-serif',
                  }}>
                    {SKILL_DESCRIPTIONS[name]}
                  </span>
                </div>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: enabled ? '#9382ff' : '#333',
                  transition: 'all .15s',
                }} />
              </div>
            )
          })}
        </div>

        {/* 分割线 */}
        <div style={{ height: '1px', background: '#1a1a1a', margin: '8px 0' }} />

        {/* 从 GitHub 安装的 agent */}
        <div style={{
          fontSize: '10px',
          color: '#333',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          marginBottom: '6px',
        }}>
          Install from GitHub
        </div>
        <AgentInstaller />
      </section>

      {/* Max iterations */}
      <section>
        <Label>Max iterations</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="range"
            min={1}
            max={20}
            value={config.maxIterations}
            onChange={(e) => setMaxIterations(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '12px', color: '#666', fontFamily: 'DM Mono, monospace', minWidth: '20px' }}>
            {config.maxIterations}
          </span>
        </div>
      </section>

    </aside>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px',
      letterSpacing: '.1em',
      color: '#444',
      textTransform: 'uppercase',
      marginBottom: '8px',
    }}>
      {children}
    </div>
  )
}
