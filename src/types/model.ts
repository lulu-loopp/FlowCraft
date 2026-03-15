// 支持的模型提供商
export type ModelProvider = 'anthropic' | 'openai' | 'deepseek'

// 每个 provider 下可选的模型
export const MODEL_OPTIONS: Record<ModelProvider, string[]> = {
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6'],
  openai:    ['gpt-4o', 'gpt-4o-mini'],
  deepseek:  ['deepseek-chat', 'deepseek-reasoner'],
}

// 运行时传入的模型配置
export interface ModelConfig {
  provider: ModelProvider
  model: string
  apiKey: string
}