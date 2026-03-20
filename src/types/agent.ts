import type { ModelConfig } from './model'
import type { Tool } from './tool'

// agent 的静态配置（用户在界面上设置的）
export interface AgentConfig {
  id: string
  name: string
  systemPrompt: string
  model: ModelConfig
  tools: Tool[]
  maxIterations: number  // 防止无限循环，默认 10
}

// 执行过程中每一步的类型
export type StepType = 'thinking' | 'tool_call' | 'tool_result' | 'done' | 'error'

// 单个执行步骤（流式输出的最小单位）
export interface AgentStep {
  id: string
  type: StepType
  content: string
  toolName?: string     // type 为 tool_call / tool_result 时有值
  toolInput?: unknown   // type 为 tool_call 时有值
  timestamp: number
}

// 一次完整运行的状态
export interface AgentRunState {
  status: 'idle' | 'running' | 'done' | 'error'
  steps: AgentStep[]
  finalOutput: string | null
  iterationCount: number
}

// Token 用量统计
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

// Agent 单次运行的结果
export interface RunResult {
  steps: AgentStep[]
  stopReason: 'done' | 'max_iterations'
  finalOutput: string
  usage: TokenUsage
}

// SSE 流式传输的消息格式
export type StreamEvent =
  | { type: 'step';   data: AgentStep }
  | { type: 'token';  data: string }
  | { type: 'done';   data: string }
  | { type: 'usage';  data: TokenUsage }
  | { type: 'error';  data: string }

// Chat 模式的消息
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// Chat 会话状态
export interface ChatState {
  messages: ChatMessage[]
  status: 'idle' | 'thinking' | 'error'
  summary?: string
}