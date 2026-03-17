'use client'

import { useState, useEffect } from 'react'
import { useRegistryStore } from '@/store/registry-store'
import { ScanResultPanel, InstalledItem } from './RegistryComponents'
import type { ScannedItem } from '@/types/registry'

type InputMode = 'url' | 'paste'

export function SkillInstaller() {
  const [mode, setMode] = useState<InputMode>('url')
  const [urlInput, setUrlInput] = useState('')
  const [pasteInput, setPasteInput] = useState('')

  const {
    skillRegistry,
    scanResult,
    isScanning,
    isInstallingSkill,
    skillError,
    fetchSkills,
    scanSkillSource,
    installSkills,
    installSkillManual,
    uninstallSkill,
    toggleSkillEnabled,
    clearScanResult,
    clearSkillError,
  } = useRegistryStore()

  useEffect(() => { fetchSkills() }, [fetchSkills])

  async function handleScan() {
    if (!urlInput.trim() || isScanning) return
    await scanSkillSource(urlInput.trim())
  }

  async function handleInstallSelected(items: ScannedItem[]) {
    const selected = items.filter((i) => i.selected)
    if (selected.length === 0) return
    await installSkills(selected, urlInput.trim())
    setUrlInput('')
  }

  async function handleManualInstall() {
    if (!pasteInput.trim() || isInstallingSkill) return
    await installSkillManual(pasteInput.trim())
    if (!useRegistryStore.getState().skillError) setPasteInput('')
  }

  const isLoading = isScanning || isInstallingSkill

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* 模式切换 */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {(['url', 'paste'] as InputMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); clearSkillError(); clearScanResult() }}
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              borderRadius: '5px',
              border: 'none',
              background: mode === m ? '#222' : 'transparent',
              color: mode === m ? '#c8f060' : '#444',
              cursor: 'pointer',
              fontFamily: 'DM Mono, monospace',
              transition: 'all .15s',
            }}
          >
            {m === 'url' ? 'GitHub' : 'paste'}
          </button>
        ))}
      </div>

      {/* URL 模式 */}
      {mode === 'url' && !scanResult && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); clearSkillError() }}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="github.com/user/repo 或 user/repo"
            disabled={isLoading}
            style={{
              flex: 1,
              background: '#141414',
              border: `1px solid ${skillError ? '#ff6b6b' : '#222'}`,
              borderRadius: '7px',
              padding: '6px 10px',
              fontSize: '11px',
              color: '#9a9a8e',
              fontFamily: 'DM Mono, monospace',
              outline: 'none',
              opacity: isLoading ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleScan}
            disabled={isLoading || !urlInput.trim()}
            style={{
              background: isLoading || !urlInput.trim() ? '#1e1e1e' : '#c8f060',
              color: isLoading || !urlInput.trim() ? '#444' : '#0f0f0f',
              border: 'none',
              borderRadius: '7px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              whiteSpace: 'nowrap',
              transition: 'all .15s',
            }}
          >
            {isScanning ? '...' : 'Scan'}
          </button>
        </div>
      )}

      {/* scan 结果：选择要安装的 skill */}
      {mode === 'url' && scanResult && (
        <ScanResultPanel
          scanResult={scanResult}
          isInstalling={isInstallingSkill}
          onInstall={handleInstallSelected}
          onCancel={() => { clearScanResult(); setUrlInput('') }}
          accentColor="#c8f060"
        />
      )}

      {/* Paste 模式 */}
      {mode === 'paste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <textarea
            value={pasteInput}
            onChange={(e) => { setPasteInput(e.target.value); clearSkillError() }}
            placeholder={'---\nname: my-skill\ndescription: 描述\n---\n\n# My Skill\n\n指令内容...'}
            rows={6}
            disabled={isLoading}
            style={{
              background: '#141414',
              border: `1px solid ${skillError ? '#ff6b6b' : '#222'}`,
              borderRadius: '7px',
              padding: '8px 10px',
              fontSize: '11px',
              color: '#9a9a8e',
              fontFamily: 'DM Mono, monospace',
              outline: 'none',
              resize: 'vertical',
              opacity: isLoading ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleManualInstall}
            disabled={isLoading || !pasteInput.trim()}
            style={{
              background: isLoading || !pasteInput.trim() ? '#1e1e1e' : '#c8f060',
              color: isLoading || !pasteInput.trim() ? '#444' : '#0f0f0f',
              border: 'none',
              borderRadius: '7px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'all .15s',
            }}
          >
            {isInstallingSkill ? '...' : 'Install'}
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {skillError && (
        <div style={{
          fontSize: '11px',
          color: '#ff6b6b',
          fontFamily: 'DM Mono, monospace',
          padding: '6px 8px',
          background: 'rgba(255,107,107,.08)',
          border: '1px solid rgba(255,107,107,.2)',
          borderRadius: '6px',
          lineHeight: 1.5,
        }}>
          {skillError}
        </div>
      )}

      {/* 已安装列表 */}
      {skillRegistry.map((skill) => (
        <InstalledItem
          key={skill.name}
          name={skill.name}
          description={skill.description}
          source={skill.source}
          enabled={skill.enabled}
          accentColor="#c8f060"
          onToggle={(enabled) => toggleSkillEnabled(skill.name, enabled)}
          onRemove={() => uninstallSkill(skill.name)}
        />
      ))}

      {skillRegistry.length === 0 && !scanResult && (
        <div style={{
          fontSize: '10px',
          color: '#2a2a2a',
          fontFamily: 'DM Mono, monospace',
          textAlign: 'center',
          padding: '4px 0',
        }}>
          browse skills at skillsmp.com
        </div>
      )}
    </div>
  )
}
