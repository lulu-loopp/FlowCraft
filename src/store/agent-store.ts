import { create } from 'zustand'
import type { AgentConfig, AgentRunState, AgentStep, ChatMessage, ChatState } from '@/types/agent'
import type { ModelProvider } from '@/types/model'
import type { ToolName } from '@/lib/tools/definitions'
import type { SkillName } from '@/lib/skills/definitions'
import type { SkillEntry, AgentEntry, ScanResult, ScannedItem } from '@/types/registry'

interface AgentStore {
  // 配置
  config: AgentConfig

  // 已启用工具
  enabledTools: ToolName[]

  // 已启用 skills（内置 subagent）
  enabledSkills: SkillName[]

  // 子 agent 步骤（key 是 skill name）
  subSteps: Record<string, AgentStep[]>

  // 运行状态
  runState: AgentRunState

  // 中断控制器
  abortController: AbortController | null

  // Chat 状态
  chatState: ChatState

  // 配置相关 actions
  setSystemPrompt: (prompt: string) => void
  setModel: (provider: ModelProvider, model: string) => void
  setApiKey: (provider: ModelProvider, key: string) => void
  setMaxIterations: (n: number) => void

  // 运行相关 actions
  startRun: () => void
  stopRun: () => void
  appendStep: (step: AgentStep) => void
  appendToken: (token: string) => void
  finishRun: (output: string) => void
  errorRun: (message: string) => void
  resetRun: () => void

  // 工具相关 actions
  toggleTool: (name: ToolName) => void

  // 内置 subagent skill actions
  toggleSkill: (name: SkillName) => void
  appendSubStep: (skillName: string, step: AgentStep) => void
  clearSubSteps: () => void

  // Chat 相关 actions
  sendMessage: (content: string) => void
  appendAssistantToken: (token: string) => void
  finishAssistantMessage: () => void
  setChatStatus: (status: ChatState['status']) => void
  setSummary: (summary: string) => void
  clearChat: () => void
  compressIfNeeded: () => Promise<void>

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

const DEFAULT_CONFIG: AgentConfig = {
  id: crypto.randomUUID(),
  name: 'My Agent',
  systemPrompt: 'You are a helpful assistant. Use the tools available to you to answer the user\'s question accurately.',
  model: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    apiKey: '',
  },
  tools: [],
  maxIterations: 10,
}

const DEFAULT_RUN_STATE: AgentRunState = {
  status: 'idle',
  steps: [],
  finalOutput: null,
  iterationCount: 0,
}

const DEFAULT_CHAT_STATE: ChatState = {
  messages: [],
  status: 'idle',
  summary: undefined,
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  config: DEFAULT_CONFIG,
  enabledTools: ['web_search'],
  enabledSkills: [],
  subSteps: {},
  runState: DEFAULT_RUN_STATE,
  abortController: null,
  chatState: DEFAULT_CHAT_STATE,

  // 内置 subagent skill actions
  toggleSkill: (name) =>
    set((s) => ({
      enabledSkills: s.enabledSkills.includes(name)
        ? s.enabledSkills.filter((n) => n !== name)
        : [...s.enabledSkills, name],
    })),

  appendSubStep: (skillName, step) =>
    set((s) => ({
      subSteps: {
        ...s.subSteps,
        [skillName]: [...(s.subSteps[skillName] ?? []), step],
      },
    })),

  clearSubSteps: () => set({ subSteps: {} }),

  // 工具 actions
  toggleTool: (name) =>
    set((s) => ({
      enabledTools: s.enabledTools.includes(name)
        ? s.enabledTools.filter((t) => t !== name)
        : [...s.enabledTools, name],
    })),

  // 配置 actions
  setSystemPrompt: (prompt) =>
    set((s) => ({ config: { ...s.config, systemPrompt: prompt } })),

  setModel: (provider, model) =>
    set((s) => ({
      config: {
        ...s.config,
        model: { ...s.config.model, provider, model },
      },
    })),

  setApiKey: (provider, key) =>
    set((s) => ({
      config: {
        ...s.config,
        model: s.config.model.provider === provider
          ? { ...s.config.model, apiKey: key }
          : s.config.model,
      },
    })),

  setMaxIterations: (n) =>
    set((s) => ({ config: { ...s.config, maxIterations: n } })),

  // 运行 actions
  startRun: () =>
    set({
      runState: { ...DEFAULT_RUN_STATE, status: 'running' },
      abortController: new AbortController(),
    }),

  stopRun: () =>
    set((s) => {
      s.abortController?.abort()
      return {
        abortController: null,
        runState: { ...s.runState, status: 'idle' },
      }
    }),

  appendStep: (step) =>
    set((s) => ({
      runState: {
        ...s.runState,
        steps: [...s.runState.steps, step],
        iterationCount: step.type === 'thinking'
          ? s.runState.iterationCount + 1
          : s.runState.iterationCount,
      },
    })),

  appendToken: (token) =>
    set((s) => {
      const steps = [...s.runState.steps]
      const last = steps[steps.length - 1]

      if (last && last.type === 'thinking') {
        steps[steps.length - 1] = { ...last, content: last.content + token }
        return { runState: { ...s.runState, steps } }
      }

      const newStep: AgentStep = {
        id: crypto.randomUUID(),
        type: 'thinking',
        content: token,
        timestamp: Date.now(),
      }
      return { runState: { ...s.runState, steps: [...steps, newStep] } }
    }),

  finishRun: (output) =>
    set((s) => ({
      abortController: null,
      runState: { ...s.runState, status: 'done', finalOutput: output },
    })),

  errorRun: (message) =>
    set((s) => ({
      abortController: null,
      runState: { ...s.runState, status: 'error', finalOutput: message },
    })),

  resetRun: () =>
    set({ runState: DEFAULT_RUN_STATE }),

  // Chat actions
  sendMessage: (content) =>
    set((s) => ({
      chatState: {
        ...s.chatState,
        status: 'thinking',
        messages: [
          ...s.chatState.messages,
          { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() },
        ],
      },
    })),

  appendAssistantToken: (token) =>
    set((s) => {
      const messages = [...s.chatState.messages]
      const last = messages[messages.length - 1]

      if (last && last.role === 'assistant') {
        messages[messages.length - 1] = { ...last, content: last.content + token }
        return { chatState: { ...s.chatState, messages } }
      }

      const newMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: token,
        timestamp: Date.now(),
      }
      return { chatState: { ...s.chatState, messages: [...messages, newMsg] } }
    }),

  finishAssistantMessage: () =>
    set((s) => ({ chatState: { ...s.chatState, status: 'idle' } })),

  setChatStatus: (status) =>
    set((s) => ({ chatState: { ...s.chatState, status } })),

  setSummary: (summary) =>
    set((s) => ({ chatState: { ...s.chatState, summary } })),

  clearChat: () =>
    set({ chatState: DEFAULT_CHAT_STATE }),

  compressIfNeeded: async () => {
    const { chatState, config } = get()
    if (chatState.messages.length <= 10) return

    const { summarizeMessages } = await import('@/lib/summarizer')
    const toSummarize = chatState.messages.slice(0, -4)
    const recent = chatState.messages.slice(-4)

    const summary = await summarizeMessages(
      toSummarize.map((m) => ({ role: m.role, content: m.content })),
      config.model
    )

    set((s) => ({
      chatState: {
        ...s.chatState,
        messages: recent,
        summary,
      },
    }))
  },

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

      // 单个 skill 直接安装，不需要用户选择
      if (data.type === 'single') {
        set({ isScanning: false })
        await useAgentStore.getState().installSkills(data.items, source)
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
      await useAgentStore.getState().fetchSkills()
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
      await useAgentStore.getState().fetchSkills()
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
      await useAgentStore.getState().fetchSkills()
    } catch (err) {
      console.error('Failed to uninstall skill:', err)
    }
  },

  toggleSkillEnabled: async (name, enabled) => {
    // 乐观更新
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
        await useAgentStore.getState().installAgents(data.items, source)
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
      await useAgentStore.getState().fetchAgents()
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
      await useAgentStore.getState().fetchAgents()
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
