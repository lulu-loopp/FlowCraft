'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Check, ChevronDown } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { MODEL_OPTIONS, type ModelProvider } from '@/types/model'
import { refreshAgentLibrary } from '@/hooks/useAgentLibrary'

interface IndividualConfigModalProps {
  agentName: string
  onClose: () => void
}

interface AgentConfig {
  role: string
  description: string
  provider: ModelProvider
  model: string
  maxIterations: number
  systemPrompt: string
  thinkingStyle: string
  communicationStyle: string
  valueOrientation: string
  backstory: string
  beliefs: string
}

/* ── Styled dropdown matching project UI ── */
interface StyledSelectProps {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  className?: string
}

function StyledSelect({ value, options, onChange, className = '' }: StyledSelectProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as globalThis.Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  const currentLabel = options.find(o => o.value === value)?.label ?? value

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`w-full flex items-center justify-between p-2.5 text-sm rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 outline-none cursor-pointer transition-all ${className}`}
      >
        <span className="text-slate-700 truncate">{currentLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 210, animation: 'dropdown-in 0.12s ease-out' } as React.CSSProperties}
          className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          onPointerDown={e => e.stopPropagation()}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                opt.value === value
                  ? 'text-indigo-700 font-medium bg-indigo-50'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    meta[key] = val
  }
  return { meta, body: match[2] }
}

function buildFrontmatter(name: string, config: AgentConfig): string {
  const lines = ['---']
  lines.push(`name: ${name}`)
  lines.push(`description: ${config.description}`)
  lines.push(`role: ${config.role}`)
  lines.push(`provider: ${config.provider}`)
  lines.push(`model: ${config.model}`)
  lines.push(`maxIterations: ${config.maxIterations}`)
  lines.push(`systemPrompt_zh: "${config.systemPrompt}"`)
  lines.push(`thinkingStyle: ${config.thinkingStyle}`)
  lines.push(`communicationStyle: ${config.communicationStyle}`)
  lines.push(`valueOrientation: ${config.valueOrientation}`)
  if (config.backstory) lines.push(`backstory: "${config.backstory}"`)
  if (config.beliefs) lines.push(`beliefs: "${config.beliefs}"`)
  lines.push('---')
  return lines.join('\n')
}

export function IndividualConfigModal({ agentName, onClose }: IndividualConfigModalProps) {
  const { t } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [config, setConfig] = useState<AgentConfig>({
    role: '',
    description: '',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxIterations: 10,
    systemPrompt: '',
    thinkingStyle: 'balanced',
    communicationStyle: 'detailed',
    valueOrientation: 'quality',
    backstory: '',
    beliefs: '',
  })

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/agents/individuals/${agentName}`)
        if (!res.ok) return
        const data = await res.json()
        const { meta } = parseFrontmatter(data.content || '')
        setConfig({
          role: meta.role || data.entry?.role || '',
          description: meta.description || data.entry?.description || '',
          provider: (meta.provider as ModelProvider) || 'anthropic',
          model: meta.model || 'claude-sonnet-4-6',
          maxIterations: parseInt(meta.maxIterations) || 10,
          systemPrompt: meta.systemPrompt_zh || meta.systemPrompt || '',
          thinkingStyle: meta.thinkingStyle || 'balanced',
          communicationStyle: meta.communicationStyle || 'detailed',
          valueOrientation: meta.valueOrientation || 'quality',
          backstory: meta.backstory || '',
          beliefs: meta.beliefs || '',
        })
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [agentName])

  const handleSave = async () => {
    setSaving(true)
    try {
      const content = buildFrontmatter(agentName, config)
      await fetch(`/api/agents/individuals/${agentName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          description: config.description,
          role: config.role,
        }),
      })
      refreshAgentLibrary()
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const update = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const inputCls = 'w-full p-2.5 text-sm rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 outline-none transition-colors'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5'

  const providerOptions = [
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'deepseek', label: 'DeepSeek' },
  ]
  const modelOptions = MODEL_OPTIONS[config.provider].map(m => ({ value: m, label: m }))
  const thinkingOptions = [
    { value: 'conservative', label: t('personality.thinking.conservative') },
    { value: 'balanced', label: t('personality.thinking.balanced') },
    { value: 'bold', label: t('personality.thinking.bold') },
  ]
  const commOptions = [
    { value: 'concise', label: t('personality.communication.concise') },
    { value: 'detailed', label: t('personality.communication.detailed') },
    { value: 'socratic', label: t('personality.communication.socratic') },
  ]
  const valueOptions = [
    { value: 'efficiency', label: t('personality.value.efficiency') },
    { value: 'user', label: t('personality.value.user') },
    { value: 'quality', label: t('personality.value.quality') },
  ]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[90vw] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10h16V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4Z"/>
                <circle cx="12" cy="15" r="2"/>
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-800">{agentName} — {t('agentLib.configTitle')}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {/* Name (read-only) / Role / Description */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>{t('personality.name')}</label>
                  <input className={inputCls + ' bg-slate-50 text-slate-500'} value={agentName} readOnly />
                </div>
                <div>
                  <label className={labelCls}>{t('personality.role')}</label>
                  <input className={inputCls} value={config.role} onChange={e => update('role', e.target.value)} placeholder={t('personality.rolePlaceholder')} />
                </div>
                <div>
                  <label className={labelCls}>{t('saveAgent.description')}</label>
                  <input className={inputCls} value={config.description} onChange={e => update('description', e.target.value)} placeholder={t('saveAgent.descriptionPlaceholder')} />
                </div>
              </div>

              {/* Provider & Model */}
              <div>
                <label className={labelCls}>{t('config.model')}</label>
                <div className="grid grid-cols-2 gap-3">
                  <StyledSelect
                    value={config.provider}
                    options={providerOptions}
                    onChange={v => { update('provider', v as ModelProvider); update('model', MODEL_OPTIONS[v as ModelProvider][0]) }}
                  />
                  <StyledSelect
                    value={config.model}
                    options={modelOptions}
                    onChange={v => update('model', v)}
                  />
                </div>
              </div>

              {/* Max Iterations */}
              <div>
                <label className={labelCls}>{t('config.maxIterations')}</label>
                <input type="number" min={1} max={50} className={inputCls} value={config.maxIterations} onChange={e => update('maxIterations', parseInt(e.target.value) || 1)} />
              </div>

              {/* System Prompt */}
              <div>
                <label className={labelCls}>{t('config.systemPrompt')}</label>
                <textarea className={inputCls + ' h-24 resize-none leading-relaxed'} value={config.systemPrompt} onChange={e => update('systemPrompt', e.target.value)} placeholder={t('config.systemPromptPlaceholder')} />
              </div>

              {/* Personality */}
              <div>
                <label className={labelCls}>{t('subtab.personality')}</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 mb-1 block">{t('personality.thinking')}</span>
                    <StyledSelect value={config.thinkingStyle} options={thinkingOptions} onChange={v => update('thinkingStyle', v)} className="!p-2 !text-xs" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 mb-1 block">{t('personality.communication')}</span>
                    <StyledSelect value={config.communicationStyle} options={commOptions} onChange={v => update('communicationStyle', v)} className="!p-2 !text-xs" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 mb-1 block">{t('personality.value')}</span>
                    <StyledSelect value={config.valueOrientation} options={valueOptions} onChange={v => update('valueOrientation', v)} className="!p-2 !text-xs" />
                  </div>
                </div>
              </div>

              {/* Backstory & Beliefs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('personality.backstory')} <span className="text-slate-300 font-normal">({t('personality.optional')})</span></label>
                  <textarea className={inputCls + ' h-20 resize-none text-xs leading-relaxed'} value={config.backstory} onChange={e => update('backstory', e.target.value)} placeholder={t('personality.backstoryPlaceholder')} />
                </div>
                <div>
                  <label className={labelCls}>{t('personality.beliefs')} <span className="text-slate-300 font-normal">({t('personality.optional')})</span></label>
                  <textarea className={inputCls + ' h-20 resize-none text-xs leading-relaxed'} value={config.beliefs} onChange={e => update('beliefs', e.target.value)} placeholder={t('personality.beliefsPlaceholder')} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            } disabled:opacity-50`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? t('agentLib.configSaved') : t('agentLib.configSave')}
          </button>
        </div>
      </div>
    </div>
  )
}
