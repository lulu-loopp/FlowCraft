import React, { useState } from 'react'
import { X, CheckCircle2, AlertCircle, Copy, Check, Loader2 } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface Props {
  onClose: () => void
}

export function CodingAgentInstallGuide({ onClose }: Props) {
  const { t } = useUIStore()
  const [nodeStatus, setNodeStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [nodeVersion, setNodeVersion] = useState('')
  const [claudeStatus, setClaudeStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [claudeVersion, setClaudeVersion] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const checkNode = async () => {
    setNodeStatus('checking')
    try {
      const res = await fetch('/api/tools/claude-code/check')
      const data = await res.json()
      if (data.nodeInstalled) {
        setNodeStatus('ok')
        setNodeVersion(data.nodeVersion || '')
      } else {
        setNodeStatus('fail')
      }
    } catch { setNodeStatus('fail') }
  }

  const checkClaude = async () => {
    setClaudeStatus('checking')
    try {
      const res = await fetch('/api/tools/claude-code/check')
      const data = await res.json()
      if (data.claudeInstalled) {
        setClaudeStatus('ok')
        setClaudeVersion(data.claudeVersion || '')
      } else {
        setClaudeStatus('fail')
      }
    } catch { setClaudeStatus('fail') }
  }

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{t('install.title')}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Step 1: Node.js */}
          <StepSection step={1} title={t('install.step1')}>
            <div className="flex items-center gap-2">
              <button onClick={checkNode} disabled={nodeStatus === 'checking'}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
                {nodeStatus === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('install.step1Detect')}
              </button>
              {nodeStatus === 'ok' && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />{nodeVersion} {t('install.step1Ok')}
                </span>
              )}
              {nodeStatus === 'fail' && (
                <span className="flex items-center gap-1 text-xs text-rose-500">
                  <AlertCircle className="w-3.5 h-3.5" />{t('install.step1Fail')}
                </span>
              )}
            </div>
          </StepSection>

          {/* Step 2: Install */}
          <StepSection step={2} title={t('install.step2')}>
            <CommandBlock
              command="npm install -g @anthropic-ai/claude-code"
              copied={copied === 'install'}
              onCopy={() => copyText('npm install -g @anthropic-ai/claude-code', 'install')}
              copyLabel={copied === 'install' ? t('install.copied') : t('install.copy')}
            />
          </StepSection>

          {/* Step 3: Login */}
          <StepSection step={3} title={t('install.step3')}>
            <CommandBlock
              command="claude login"
              copied={copied === 'login'}
              onCopy={() => copyText('claude login', 'login')}
              copyLabel={copied === 'login' ? t('install.copied') : t('install.copy')}
            />
            <p className="text-[10px] text-slate-400 mt-1.5">{t('install.step3Note')}</p>
          </StepSection>

          {/* Step 4: Verify */}
          <StepSection step={4} title={t('install.step4')}>
            <div className="flex items-center gap-2">
              <button onClick={checkClaude} disabled={claudeStatus === 'checking'}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
                {claudeStatus === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('install.step4Detect')}
              </button>
              {claudeStatus === 'ok' && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />{claudeVersion} {t('install.step4Ok')}
                </span>
              )}
              {claudeStatus === 'fail' && (
                <span className="flex items-center gap-1 text-xs text-rose-500">
                  <AlertCircle className="w-3.5 h-3.5" />{t('aiCoding.notInstalled')}
                </span>
              )}
            </div>
          </StepSection>
        </div>
      </div>
    </div>
  )
}

function StepSection({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">{step}</span>
        <span className="text-sm font-medium text-slate-700">{title}</span>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  )
}

function CommandBlock({ command, copied, onCopy, copyLabel }: { command: string; copied: boolean; onCopy: () => void; copyLabel: string }) {
  return (
    <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
      <code className="text-[11px] text-green-300 font-mono flex-1 select-all">{command}</code>
      <button onClick={onCopy} className="text-slate-400 hover:text-white transition-colors shrink-0 flex items-center gap-1 text-[10px]">
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copyLabel}
      </button>
    </div>
  )
}
