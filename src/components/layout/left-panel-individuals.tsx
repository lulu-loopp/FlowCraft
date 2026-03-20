'use client'

import React, { useState } from 'react'
import { Bot, MessageCircle, Settings2, Trash2, ChevronDown } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AgentChatModal } from '@/components/agent/agent-chat-modal'
import { MemoryEditorModal } from '@/components/layout/memory-editor-modal'
import { IndividualConfigModal } from '@/components/layout/individual-config-modal'
import type { IndividualEntry } from '@/types/registry'
import type { TranslationKey } from '@/lib/i18n'
import { refreshAgentLibrary } from '@/hooks/useAgentLibrary'
import { countMemoryItems } from '@/lib/memory-parser'

interface IndividualsSectionProps {
  individuals: IndividualEntry[]
  search: string
  onDragStart: (event: React.DragEvent, nodeType: string, agentName?: string) => void
  onDelete: (name: string) => void
}

function getMaturityKey(runCount: number): TranslationKey {
  if (runCount > 50) return 'agentLib.maturity.expert'
  if (runCount > 20) return 'agentLib.maturity.familiar'
  if (runCount > 5) return 'agentLib.maturity.learning'
  return 'agentLib.maturity.new'
}

function getMaturityColor(runCount: number): string {
  if (runCount > 50) return 'bg-amber-100 text-amber-700'
  if (runCount > 20) return 'bg-emerald-100 text-emerald-700'
  if (runCount > 5) return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-500'
}

// TODO: Add drag-to-reorder for individual agents list (Issue 4)
export function IndividualsSection({ individuals, search, onDragStart, onDelete }: IndividualsSectionProps) {
  const { t } = useUIStore()
  const [open, setOpen] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [chatAgent, setChatAgent] = useState<IndividualEntry | null>(null)
  const [chatData, setChatData] = useState<{ systemPrompt: string; memory: string; provider?: string; model?: string } | null>(null)
  const [memoryAgent, setMemoryAgent] = useState<{ name: string; memory: string } | null>(null)
  const [configAgent, setConfigAgent] = useState<string | null>(null)

  const filtered = individuals.filter(a =>
    !search || a.name.includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleChat = async (e: React.MouseEvent, agent: IndividualEntry) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/agents/individuals/${agent.name}`)
      if (res.ok) {
        const data = await res.json()
        setChatAgent(agent)
        setChatData({
          systemPrompt: data.systemPrompt || data.content || '',
          memory: data.memory || '',
          provider: data.provider,
          model: data.model,
        })
      }
    } catch { /* ignore */ }
  }

  const handleMemory = async (e: React.MouseEvent, agent: IndividualEntry) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/agents/individuals/${agent.name}`)
      if (res.ok) {
        const data = await res.json()
        setMemoryAgent({ name: agent.name, memory: data.memory || '' })
      }
    } catch { /* ignore */ }
  }

  const handleSaveMemory = async (newContent: string) => {
    if (!memoryAgent) return
    try {
      const newCount = countMemoryItems(newContent)
      await fetch(`/api/agents/individuals/${memoryAgent.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory: newContent, memoryCount: newCount }),
      })
      refreshAgentLibrary()
    } catch { /* ignore */ }
    setMemoryAgent(null)
  }

  const handleToast = (e: React.MouseEvent) => {
    e.stopPropagation()
    alert(t('agentLib.comingSoon'))
  }

  return (
    <div className="pt-1">
      <button
        className="w-full flex items-center justify-between px-1 py-2 border-t border-slate-100 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span>{t('agentLib.individuals')}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-5 gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
            <Bot className="w-5 h-5 text-slate-300" />
            <p className="text-xs text-slate-400">{t('agentLib.noIndividuals')}</p>
            <p className="text-[10px] text-slate-300">{t('agentLib.noIndividualsHint')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(agent => (
              <div
                key={agent.name}
                className="group/item flex items-start gap-2 px-2.5 py-2.5 rounded-xl border border-transparent hover:bg-indigo-50 hover:border-indigo-100 hover:-translate-y-px transition-all cursor-grab active:cursor-grabbing active:scale-[0.98]"
                draggable
                onDragStart={(e) => onDragStart(e, 'agent', agent.name)}
              >
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">{agent.name}</p>
                  {agent.role && <p className="text-[11px] text-slate-400 truncate mt-0.5">{agent.role}</p>}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${getMaturityColor(agent.runCount)}`}>
                      {t(getMaturityKey(agent.runCount))}
                    </span>
                    <button
                      className="hover:text-indigo-500 transition-colors cursor-pointer"
                      onClick={e => handleMemory(e, agent)}
                      title={t('memory.viewAll')}
                    >
                      {agent.memoryCount} {t('agentLib.memories')}
                    </button>
                    <span>{agent.runCount} {t('agentLib.runs')}</span>
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 mt-0.5">
                  <button className="p-1 hover:bg-white rounded" title={t('agentLib.chat')} onClick={e => handleChat(e, agent)}>
                    <MessageCircle className="w-3 h-3 text-slate-400" />
                  </button>
                  <button className="p-1 hover:bg-white rounded" title={t('agentLib.edit')} onClick={e => { e.stopPropagation(); setConfigAgent(agent.name) }}>
                    <Settings2 className="w-3 h-3 text-slate-400" />
                  </button>
                  <button
                    className="p-1 hover:bg-rose-50 rounded"
                    title={t('home.delete')}
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(agent.name) }}
                  >
                    <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={t('agentLib.deleteTitle')}
          message={t('agentLib.deleteMessage').replace('{name}', deleteTarget)}
          confirmLabel={t('agentLib.deleteConfirm')}
          cancelLabel={t('agentLib.deleteCancel')}
          onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {memoryAgent && (
        <MemoryEditorModal
          title={`${memoryAgent.name} — ${t('memory.editMemory')}`}
          content={memoryAgent.memory}
          onClose={() => setMemoryAgent(null)}
          onSave={handleSaveMemory}
        />
      )}

      {chatAgent && chatData && (
        <AgentChatModal
          agentName={chatAgent.name}
          role={chatAgent.role}
          memoryCount={chatAgent.memoryCount}
          runCount={chatAgent.runCount}
          systemPrompt={chatData.systemPrompt}
          existingMemory={chatData.memory}
          provider={chatData.provider}
          model={chatData.model}
          onClose={() => { setChatAgent(null); setChatData(null) }}
        />
      )}

      {configAgent && (
        <IndividualConfigModal
          agentName={configAgent}
          onClose={() => setConfigAgent(null)}
        />
      )}
    </div>
  )
}
