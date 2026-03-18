'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle2, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface Skill {
  name: string
  scope: 'global' | 'project'
  path: string
}

interface Props {
  themeHex?: string
  cli?: string
}

export function AiCodingSkillsPanel({ themeHex = '#D97757', cli = 'claude' }: Props) {
  const { t } = useUIStore()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(false)
  const [installUrl, setInstallUrl] = useState('')
  const [installing, setInstalling] = useState(false)

  const loadSkills = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tools/claude-code/skills?cli=${cli}`)
      if (res.ok) {
        const data = await res.json()
        setSkills(data.skills || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tools/claude-code/skills?cli=${cli}`)
      .then(r => r.ok ? r.json() : { skills: [] })
      .then(data => { if (!cancelled) { setSkills(data.skills || []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cli])

  const handleInstall = async () => {
    if (!installUrl.trim()) return
    setInstalling(true)
    try {
      const res = await fetch('/api/tools/claude-code/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: installUrl.trim(), cli }),
      })
      if (res.ok) {
        setInstallUrl('')
        await loadSkills()
      }
    } catch { /* ignore */ }
    setInstalling(false)
  }

  const handleDelete = async (name: string) => {
    await fetch(`/api/tools/claude-code/skills?name=${encodeURIComponent(name)}&cli=${cli}`, { method: 'DELETE' })
    await loadSkills()
  }

  return (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-2">{t('aiCoding.skills')}</label>

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      ) : skills.length === 0 ? (
        <p className="text-[11px] text-slate-400">{t('aiCoding.noSkills')}</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {skills.map(s => (
            <div key={s.path} className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: themeHex }} />
              <span className="text-slate-700 flex-1 truncate">{s.name}</span>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                {s.scope === 'global' ? 'Global' : 'Project'}
              </span>
              {s.scope === 'project' && (
                <button onClick={() => handleDelete(s.name)} className="text-slate-300 hover:text-rose-500 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Install from GitHub */}
      <div className="flex gap-1.5 mt-2">
        <input
          type="text"
          value={installUrl}
          onChange={e => setInstallUrl(e.target.value)}
          placeholder="https://github.com/..."
          className="flex-1 px-2 py-1.5 text-[11px] border border-slate-200 rounded-lg outline-none focus:ring-1 min-w-0"
          style={{ '--tw-ring-color': themeHex } as React.CSSProperties}
        />
        <button
          onClick={handleInstall}
          disabled={installing || !installUrl.trim()}
          className="px-2 py-1.5 text-[11px] font-medium rounded-lg border disabled:opacity-40 transition-colors shrink-0 flex items-center gap-1"
          style={{ color: themeHex, borderColor: `${themeHex}40`, backgroundColor: `${themeHex}10` }}
        >
          {installing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </button>
      </div>

      <a
        href="https://skillsmp.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 transition-colors"
        style={{ '--hover-color': themeHex } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.color = themeHex)}
        onMouseLeave={e => (e.currentTarget.style.color = '')}
      >
        <ExternalLink className="w-3 h-3" />
        skillsmp.com
      </a>
    </div>
  )
}
