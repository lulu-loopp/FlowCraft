import { create } from 'zustand'
import type { AgentConfig, AgentRunState, AgentStep, ChatMessage, ChatState } from '@/types/agent'
import type { ModelProvider } from '@/types/model'
import type { ToolName } from '@/lib/tools/definitions'
import type { SkillName } from '@/lib/skills/definitions'

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
}))
