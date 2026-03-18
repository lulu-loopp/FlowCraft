'use client'

import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Settings2, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface McpServer {
  name: string
  command: string
  args?: string[]
  enabled: boolean
}

interface Props {
  themeHex?: string
  cli?: string
}

export function AiCodingMcpsPanel({ themeHex = '#D97757', cli = 'claude' }: Props) {
  const { t } = useUIStore()
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')

  const apiBase = cli === 'codex' ? '/api/tools/codex/mcps' : '/api/tools/claude-code/mcps'

  const loadServers = async () => {
    setLoading(true)
    try {
      const res = await fetch(apiBase)
      if (res.ok) {
        const data = await res.json()
        setServers(data.servers || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    fetch(apiBase)
      .then(r => r.ok ? r.json() : { servers: [] })
      .then(data => { if (!cancelled) { setServers(data.servers || []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [apiBase])

  const toggleServer = async (name: string, enabled: boolean) => {
    await fetch(apiBase, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, enabled }),
    })
    await loadServers()
  }

  const deleteServer = async (name: string) => {
    await fetch(`${apiBase}?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
    await loadServers()
  }

  const addServer = async () => {
    if (!newName.trim() || !newCommand.trim()) return
    await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), command: newCommand.trim() }),
    })
    setNewName('')
    setNewCommand('')
    setShowAdd(false)
    await loadServers()
  }

  return (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-2">{t('aiCoding.mcps')}</label>

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-1.5 mb-2">
          {servers.map(s => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              {s.enabled ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              )}
              <span className="text-slate-700 flex-1 truncate">{s.name}</span>
              <span className={`text-[10px] ${s.enabled ? 'text-emerald-500' : 'text-slate-400'}`}>
                {s.enabled ? t('aiCoding.mcpRunning') : t('aiCoding.mcpStopped')}
              </span>
              <button
                onClick={() => toggleServer(s.name, !s.enabled)}
                className="w-7 h-4 rounded-full relative transition-colors"
                style={{ backgroundColor: s.enabled ? themeHex : '#cbd5e1' }}
              >
                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${s.enabled ? 'left-3.5' : 'left-0.5'}`} />
              </button>
              <button className="text-slate-300 hover:text-slate-500 transition-colors">
                <Settings2 className="w-3 h-3" />
              </button>
              <button onClick={() => deleteServer(s.name)} className="text-slate-300 hover:text-rose-500 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="space-y-1.5 bg-slate-50 rounded-lg p-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name"
            className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded outline-none"
          />
          <input
            type="text"
            value={newCommand}
            onChange={e => setNewCommand(e.target.value)}
            placeholder="Command (e.g. npx -y @modelcontextprotocol/server-fs)"
            className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded outline-none"
          />
          <div className="flex gap-1.5">
            <button
              onClick={addServer}
              className="px-2 py-1 text-[10px] font-medium text-white rounded transition-colors"
              style={{ backgroundColor: themeHex }}
            >
              Add
            </button>
            <button onClick={() => { setShowAdd(false); setNewName(''); setNewCommand('') }} className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-[11px] font-medium transition-colors"
          style={{ color: themeHex }}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('aiCoding.addMcp')}
        </button>
      )}
    </div>
  )
}
