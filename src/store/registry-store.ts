import { create } from 'zustand'
import type { SkillEntry, AgentEntry, ScanResult, ScannedItem } from '@/types/registry'

interface RegistryStore {
  // Skills（文件系统）
  skillRegistry: SkillEntry[]
  scanResult: ScanResult | null
  isScanning: boolean
  isInstallingSkill: boolean
  skillError: string | null
  fetchSkills: () => Promise<void>
  scanSkillSource: (source: string) => Promise<void>
  installSkills: (selectedItems: ScannedItem[], source: string) => Promise<void>
  installSkillManual: (content: string) => Promise<void>
  uninstallSkill: (name: string) => Promise<void>
  toggleSkillEnabled: (name: string, enabled: boolean) => Promise<void>
  analyzeSkill: (name: string) => Promise<void>
  analyzeAllSkills: () => Promise<void>
  clearScanResult: () => void
  clearSkillError: () => void

  // Agents（文件系统）
  agentRegistry: AgentEntry[]
  agentScanResult: ScanResult | null
  isAgentScanning: boolean
  isInstallingAgent: boolean
  agentError: string | null
  fetchAgents: () => Promise<void>
  scanAgentSource: (source: string) => Promise<void>
  installAgents: (selectedItems: ScannedItem[], source: string) => Promise<void>
  uninstallAgent: (name: string) => Promise<void>
  toggleAgentEnabled: (name: string, enabled: boolean) => Promise<void>
  clearAgentScanResult: () => void
  clearAgentError: () => void
}

export const useRegistryStore = create<RegistryStore>((set, get) => ({
  // Skills（文件系统）
  skillRegistry: [],
  scanResult: null,
  isScanning: false,
  isInstallingSkill: false,
  skillError: null,

  fetchSkills: async () => {
    try {
      const res = await fetch('/api/skills')
      const data = await res.json()
      set({ skillRegistry: data.skills ?? [] })
    } catch { /* ignore */ }
  },

  scanSkillSource: async (source) => {
    set({ isScanning: true, skillError: null, scanResult: null })
    try {
      const res = await fetch('/api/skills/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.type === 'single') {
        set({ isScanning: false })
        await get().installSkills(data.items, source)
      } else {
        set({ scanResult: data, isScanning: false })
      }
    } catch (err) {
      set({
        skillError: err instanceof Error ? err.message : 'Unknown error',
        isScanning: false,
      })
    }
  },

  installSkills: async (selectedItems, source) => {
    set({ isInstallingSkill: true, skillError: null })
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, selectedItems }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.errors?.length > 0) {
        console.warn('Some skills failed to install:', data.errors)
      }
      await get().fetchSkills()
      set({ isInstallingSkill: false, scanResult: null })
    } catch (err) {
      set({
        skillError: err instanceof Error ? err.message : 'Unknown error',
        isInstallingSkill: false,
      })
    }
  },

  installSkillManual: async (content) => {
    set({ isInstallingSkill: true, skillError: null })
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'manual', manualContent: content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await get().fetchSkills()
      set({ isInstallingSkill: false })
    } catch (err) {
      set({
        skillError: err instanceof Error ? err.message : 'Unknown error',
        isInstallingSkill: false,
      })
    }
  },

  uninstallSkill: async (name) => {
    try {
      await fetch(`/api/skills/${name}`, { method: 'DELETE' })
      await get().fetchSkills()
    } catch (err) {
      console.error('Failed to uninstall skill:', err)
    }
  },

  toggleSkillEnabled: async (name, enabled) => {
    set((s) => ({
      skillRegistry: s.skillRegistry.map((sk) =>
        sk.name === name ? { ...sk, enabled } : sk
      ),
    }))
    await fetch(`/api/skills/${name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  },

  analyzeSkill: async (name) => {
    try {
      const res = await fetch('/api/skills/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) await get().fetchSkills()
    } catch { /* non-critical */ }
  },

  analyzeAllSkills: async () => {
    const names = get().skillRegistry
      .filter(s => !s.profile?.analyzedAt)
      .map(s => s.name)
    if (names.length === 0) return
    try {
      const res = await fetch('/api/skills/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: names }),
      })
      if (res.ok) await get().fetchSkills()
    } catch { /* non-critical */ }
  },

  clearScanResult: () => set({ scanResult: null }),
  clearSkillError: () => set({ skillError: null }),

  // Agents（文件系统）
  agentRegistry: [],
  agentScanResult: null,
  isAgentScanning: false,
  isInstallingAgent: false,
  agentError: null,

  fetchAgents: async () => {
    try {
      const res = await fetch('/api/agents')
      const data = await res.json()
      set({ agentRegistry: data.agents ?? [] })
    } catch { /* ignore */ }
  },

  scanAgentSource: async (source) => {
    set({ isAgentScanning: true, agentError: null, agentScanResult: null })
    try {
      const res = await fetch('/api/agents/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.type === 'single') {
        set({ isAgentScanning: false })
        await get().installAgents(data.items, source)
      } else {
        set({ agentScanResult: data, isAgentScanning: false })
      }
    } catch (err) {
      set({
        agentError: err instanceof Error ? err.message : 'Unknown error',
        isAgentScanning: false,
      })
    }
  },

  installAgents: async (selectedItems, source) => {
    set({ isInstallingAgent: true, agentError: null })
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, selectedItems }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.errors?.length > 0) {
        console.warn('Some agents failed to install:', data.errors)
      }
      await get().fetchAgents()
      set({ isInstallingAgent: false, agentScanResult: null })
    } catch (err) {
      set({
        agentError: err instanceof Error ? err.message : 'Unknown error',
        isInstallingAgent: false,
      })
    }
  },

  uninstallAgent: async (name) => {
    try {
      await fetch(`/api/agents/${name}`, { method: 'DELETE' })
      await get().fetchAgents()
    } catch (err) {
      console.error('Failed to uninstall agent:', err)
    }
  },

  toggleAgentEnabled: async (name, enabled) => {
    set((s) => ({
      agentRegistry: s.agentRegistry.map((a) =>
        a.name === name ? { ...a, enabled } : a
      ),
    }))
    await fetch(`/api/agents/${name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  },

  clearAgentScanResult: () => set({ agentScanResult: null }),
  clearAgentError: () => set({ agentError: null }),
}))
