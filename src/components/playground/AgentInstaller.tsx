'use client'

import { useState, useEffect } from 'react'
import { useAgentStore } from '@/store/agent-store'
import { ScanResultPanel, InstalledItem } from './RegistryComponents'
import type { ScannedItem } from '@/types/registry'

export function AgentInstaller() {
  const [urlInput, setUrlInput] = useState('')

  const {
    agentRegistry,
    agentScanResult,
    isAgentScanning,
    isInstallingAgent,
    agentError,
    fetchAgents,
    scanAgentSource,
    installAgents,
    uninstallAgent,
    toggleAgentEnabled,
    clearAgentScanResult,
    clearAgentError,
  } = useAgentStore()

  useEffect(() => { fetchAgents() }, [])

  async function handleScan() {
    if (!urlInput.trim() || isAgentScanning) return
    await scanAgentSource(urlInput.trim())
  }

  async function handleInstallSelected(items: ScannedItem[]) {
    const selected = items.filter((i) => i.selected)
    if (selected.length === 0) return
    await installAgents(selected, urlInput.trim())
    setUrlInput('')
  }

  const isLoading = isAgentScanning || isInstallingAgent

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {!agentScanResult && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); clearAgentError() }}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="github.com/user/repo 或 user/repo"
            disabled={isLoading}
            style={{
              flex: 1,
              background: '#141414',
              border: `1px solid ${agentError ? '#ff6b6b' : '#222'}`,
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
              background: isLoading || !urlInput.trim() ? '#1e1e1e' : '#9382ff',
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
            {isAgentScanning ? '...' : 'Scan'}
          </button>
        </div>
      )}

      {agentScanResult && (
        <ScanResultPanel
          scanResult={agentScanResult}
          isInstalling={isInstallingAgent}
          onInstall={handleInstallSelected}
          onCancel={() => { clearAgentScanResult(); setUrlInput('') }}
          accentColor="#9382ff"
        />
      )}

      {agentError && (
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
          {agentError}
        </div>
      )}

      {agentRegistry.map((agent) => (
        <InstalledItem
          key={agent.name}
          name={agent.name}
          description={agent.description}
          source={agent.source}
          enabled={agent.enabled}
          accentColor="#9382ff"
          onToggle={(enabled) => toggleAgentEnabled(agent.name, enabled)}
          onRemove={() => uninstallAgent(agent.name)}
        />
      ))}

      {agentRegistry.length === 0 && !agentScanResult && (
        <div style={{
          fontSize: '10px',
          color: '#2a2a2a',
          fontFamily: 'DM Mono, monospace',
          textAlign: 'center',
          padding: '4px 0',
        }}>
          browse at github.com/topics/subagents
        </div>
      )}
    </div>
  )
}
