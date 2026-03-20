// 支持的模型提供商
export type ModelProvider = 'anthropic' | 'openai' | 'deepseek' | 'google' | 'minimax'

// 模型能力标签
export type ModelCapability = 'tool_calling' | 'multimodal' | 'long_context' | 'reasoning'

// 模型元数据（含能力标签和成本层级）
export interface ModelMeta {
  provider: ModelProvider
  model: string
  capabilities: ModelCapability[]
  costTier: 'low' | 'medium' | 'high'
}

// 模型能力目录（单一数据源）
export const MODEL_CATALOG: ModelMeta[] = [
  // Anthropic
  { provider: 'anthropic', model: 'claude-sonnet-4-6', capabilities: ['tool_calling', 'multimodal', 'long_context'], costTier: 'medium' },
  { provider: 'anthropic', model: 'claude-opus-4-6', capabilities: ['tool_calling', 'multimodal', 'long_context', 'reasoning'], costTier: 'high' },
  { provider: 'anthropic', model: 'claude-haiku-4-5', capabilities: ['tool_calling', 'multimodal'], costTier: 'low' },
  // OpenAI
  { provider: 'openai', model: 'gpt-4.1', capabilities: ['tool_calling', 'multimodal', 'long_context'], costTier: 'medium' },
  { provider: 'openai', model: 'gpt-4.1-mini', capabilities: ['tool_calling', 'multimodal', 'long_context'], costTier: 'low' },
  { provider: 'openai', model: 'gpt-4.1-nano', capabilities: ['tool_calling', 'multimodal', 'long_context'], costTier: 'low' },
  { provider: 'openai', model: 'o3', capabilities: ['tool_calling', 'multimodal', 'reasoning'], costTier: 'medium' },
  { provider: 'openai', model: 'o4-mini', capabilities: ['tool_calling', 'multimodal', 'reasoning'], costTier: 'low' },
  { provider: 'openai', model: 'gpt-4o', capabilities: ['tool_calling', 'multimodal'], costTier: 'medium' },
  { provider: 'openai', model: 'gpt-4o-mini', capabilities: ['tool_calling', 'multimodal'], costTier: 'low' },
  // DeepSeek
  { provider: 'deepseek', model: 'deepseek-chat', capabilities: ['tool_calling', 'long_context'], costTier: 'low' },
  { provider: 'deepseek', model: 'deepseek-reasoner', capabilities: ['tool_calling', 'reasoning', 'long_context'], costTier: 'low' },
  // Google
  { provider: 'google', model: 'gemini-2.5-pro', capabilities: ['tool_calling', 'multimodal', 'long_context', 'reasoning'], costTier: 'medium' },
  { provider: 'google', model: 'gemini-2.5-flash', capabilities: ['tool_calling', 'multimodal', 'long_context', 'reasoning'], costTier: 'low' },
  { provider: 'google', model: 'gemini-2.5-flash-lite', capabilities: ['tool_calling', 'multimodal', 'long_context'], costTier: 'low' },
  // MiniMax
  { provider: 'minimax', model: 'MiniMax-M2.7', capabilities: ['tool_calling', 'long_context', 'reasoning'], costTier: 'medium' },
  { provider: 'minimax', model: 'MiniMax-M2.7-highspeed', capabilities: ['tool_calling', 'long_context'], costTier: 'low' },
  { provider: 'minimax', model: 'MiniMax-M2.5', capabilities: ['tool_calling', 'long_context', 'reasoning'], costTier: 'medium' },
  { provider: 'minimax', model: 'MiniMax-M2.5-highspeed', capabilities: ['tool_calling', 'long_context'], costTier: 'low' },
]

// 模型价格表（每 1M token，单位 USD）
export interface ModelPricing {
  input: number   // $/1M input tokens
  output: number  // $/1M output tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-sonnet-4-6':       { input: 3.00,  output: 15.00 },
  'claude-opus-4-6':         { input: 5.00,  output: 25.00 },
  'claude-haiku-4-5':        { input: 1.00,  output: 5.00  },
  // OpenAI
  'gpt-4.1':                 { input: 2.00,  output: 8.00  },
  'gpt-4.1-mini':            { input: 0.40,  output: 1.60  },
  'gpt-4.1-nano':            { input: 0.10,  output: 0.40  },
  'o3':                      { input: 2.00,  output: 8.00  },
  'o4-mini':                 { input: 1.10,  output: 4.40  },
  'gpt-4o':                  { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':             { input: 0.15,  output: 0.60  },
  // DeepSeek
  'deepseek-chat':           { input: 0.28,  output: 0.42  },
  'deepseek-reasoner':       { input: 0.28,  output: 0.42  },
  // Google
  'gemini-2.5-pro':          { input: 1.25,  output: 10.00 },
  'gemini-2.5-flash':        { input: 0.30,  output: 2.50  },
  'gemini-2.5-flash-lite':   { input: 0.10,  output: 0.40  },
  // MiniMax
  'MiniMax-M2.7':            { input: 0.30,  output: 1.20  },
  'MiniMax-M2.7-highspeed':  { input: 0.30,  output: 2.40  },
  'MiniMax-M2.5':            { input: 0.30,  output: 1.20  },
  'MiniMax-M2.5-highspeed':  { input: 0.30,  output: 2.40  },
}

/** Calculate cost in USD for a given model's token usage */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return 0
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

// 从 MODEL_CATALOG 派生的 provider→models 映射
export const MODEL_OPTIONS: Record<ModelProvider, string[]> = MODEL_CATALOG.reduce(
  (acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m.model)
    return acc
  },
  {} as Record<ModelProvider, string[]>,
)

// 从 MODEL_CATALOG 派生：不支持多模态的模型集合
export const NON_MULTIMODAL_MODELS = new Set(
  MODEL_CATALOG.filter(m => !m.capabilities.includes('multimodal')).map(m => m.model)
)

// 查询模型元数据
export function getModelMeta(provider: ModelProvider, model: string): ModelMeta | undefined {
  return MODEL_CATALOG.find(m => m.provider === provider && m.model === model)
}

// 检查模型是否具备某项能力
export function hasCapability(provider: ModelProvider, model: string, cap: ModelCapability): boolean {
  const meta = getModelMeta(provider, model)
  return meta ? meta.capabilities.includes(cap) : false
}

// 生成模型能力表（供 flow 生成 prompt 使用）
export function buildModelCatalogText(): string {
  return MODEL_CATALOG.map(m =>
    `- ${m.provider}/${m.model}: [${m.capabilities.join(', ')}] (cost: ${m.costTier})`
  ).join('\n')
}

// 运行时传入的模型配置
export interface ModelConfig {
  provider: ModelProvider
  model: string
  apiKey: string
  temperature?: number  // 0.0 ~ 2.0, 默认 0.7
}