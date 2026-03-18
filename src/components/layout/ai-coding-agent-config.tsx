'use client'

import React, { useState } from 'react'
import { FolderOpen, Terminal } from 'lucide-react'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'
import { AiCodingAgentColors } from '@/styles/tokens'
import { AiCodingSkillsPanel } from './ai-coding-skills-panel'
import { AiCodingMcpsPanel } from './ai-coding-mcps-panel'
import { InteractiveTerminalModal } from '@/components/canvas/nodes/interactive-terminal-modal'

interface Props {
  nodeId: string
  data: Record<string, unknown>
}

export function AiCodingAgentConfig({ nodeId, data }: Props) {
  const { t } = useUIStore()
  const setNodes = useFlowStore(s => s.setNodes)
  const nodes = useFlowStore(s => s.nodes)
  const [showInteractive, setShowInteractive] = useState(false)

  const update = (key: string, value: unknown) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, [key]: value } } : n))
  }

  const cli = (data.cli as string) || 'claude'
  const taskDescription = (data.taskDescription as string) || ''
  const workDir = (data.workDir as string) || ''
  const maxTimeout = (data.maxTimeout as number) || 10
  const label = (data.label as string) || ''
  const theme = cli === 'codex' ? AiCodingAgentColors.codex : AiCodingAgentColors.claudeCode

  const handleBrowseFolder = async () => {
    try {
      // showDirectoryPicker is available in Chrome/Edge — gives full path access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' })
      if (dirHandle?.name) {
        // Resolve full path via the server
        const res = await fetch('/api/tools/claude-code/resolve-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: dirHandle.name }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.path) {
            update('workDir', data.path)
            return
          }
        }
        // Fallback: just use the folder name
        update('workDir', dirHandle.name)
      }
    } catch {
      // User cancelled or API not supported
    }
  }

  return (
    <div className="space-y-5">
      {/* Node name */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">{t('config.nodeName')}</label>
        <input
          type="text"
          value={label}
          onChange={e => update('label', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1"
          style={{ '--tw-ring-color': theme.hex } as React.CSSProperties}
        />
      </div>

      {/* CLI choice */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-2">{t('aiCoding.cliChoice')}</label>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`cli-${nodeId}`}
              value="claude"
              checked={cli === 'claude'}
              onChange={() => update('cli', 'claude')}
              style={{ accentColor: theme.hex }}
            />
            <span className="text-sm text-slate-700">{t('aiCoding.claudeCode')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`cli-${nodeId}`}
              value="codex"
              checked={cli === 'codex'}
              onChange={() => update('cli', 'codex')}
              style={{ accentColor: theme.hex }}
            />
            <span className="text-sm text-slate-700">{t('aiCoding.codex')}</span>
          </label>
        </div>
      </div>

      {/* Task description */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">{t('aiCoding.taskDescription')}</label>
        <textarea
          value={taskDescription}
          onChange={e => update('taskDescription', e.target.value)}
          placeholder={t('aiCoding.taskPlaceholder')}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 resize-none"
          style={{ '--tw-ring-color': theme.hex } as React.CSSProperties}
        />
      </div>

      {/* Working directory */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">{t('aiCoding.workDir')}</label>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1 px-3 py-2 border border-slate-200 rounded-lg">
            <FolderOpen className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={workDir}
              onChange={e => update('workDir', e.target.value)}
              placeholder="~/project"
              className="flex-1 text-sm bg-transparent outline-none min-w-0"
            />
          </div>
          <button
            onClick={handleBrowseFolder}
            className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors shrink-0"
            style={{
              color: theme.hex,
              borderColor: `${theme.hex}40`,
              backgroundColor: `${theme.hex}10`,
            }}
          >
            {t('aiCoding.browse')}
          </button>
        </div>
      </div>

      {/* Max timeout */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">
          {t('aiCoding.maxTimeout')} ({maxTimeout} {t('aiCoding.minutes')})
        </label>
        <input
          type="range"
          min={1}
          max={60}
          value={maxTimeout}
          onChange={e => update('maxTimeout', Number(e.target.value))}
          className="w-full"
          style={{ accentColor: theme.hex }}
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>1 {t('aiCoding.minutes')}</span>
          <span>60 {t('aiCoding.minutes')}</span>
        </div>
      </div>

      {/* Interactive terminal */}
      <div>
        <button
          onClick={() => setShowInteractive(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors"
          style={{
            color: theme.hex,
            borderColor: `${theme.hex}40`,
            backgroundColor: `${theme.hex}10`,
          }}
        >
          <Terminal className="w-4 h-4" />
          {t('aiCoding.openInteractive')}
        </button>
      </div>

      {/* Skills panel */}
      <AiCodingSkillsPanel themeHex={theme.hex} cli={cli} />

      {/* MCP panel */}
      <AiCodingMcpsPanel themeHex={theme.hex} cli={cli} />

      {showInteractive && (
        <InteractiveTerminalModal isOpen={showInteractive} onClose={() => setShowInteractive(false)} nodeId={nodeId} workDir={workDir || undefined} cli={cli} />
      )}
    </div>
  )
}
