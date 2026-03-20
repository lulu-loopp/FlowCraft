import { readSettings } from './settings-storage'
import type { ModelProvider } from '@/types/model'

/** Check if a key looks like a placeholder (e.g. sk-ant-xxxxxxxx) */
function isPlaceholderKey(key: string): boolean {
  return /^(sk-[a-z]+-x{4,}|sk-x{3,}|your-.*-here|xxx)$/i.test(key)
}

export async function resolveProviderApiKey(provider: string): Promise<string> {
  const settings = await readSettings()

  let key = ''
  switch (provider) {
    case 'anthropic':
      key = (settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '').trim()
      break
    case 'openai':
      key = (settings.openaiApiKey || process.env.OPENAI_API_KEY || '').trim()
      break
    case 'deepseek':
      key = (settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '').trim()
      break
    case 'google':
      key = (settings.googleApiKey || process.env.GOOGLE_API_KEY || '').trim()
      break
    case 'minimax':
      key = (settings.minimaxApiKey || process.env.MINIMAX_API_KEY || '').trim()
      break
  }

  return isPlaceholderKey(key) ? '' : key
}

const FALLBACK_MODELS: Record<string, string> = {
  deepseek: 'deepseek-chat',
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4.1-mini',
  google: 'gemini-2.5-flash',
  minimax: 'MiniMax-M2.7-highspeed',
}

/**
 * Resolve a provider+model with fallback: if the requested provider
 * has no valid key, try the default provider from settings.
 */
export async function resolveProviderWithFallback(
  requestedProvider: string,
  requestedModel: string,
): Promise<{ provider: ModelProvider; model: string; apiKey: string } | null> {
  const apiKey = await resolveProviderApiKey(requestedProvider)
  if (apiKey) return { provider: requestedProvider as ModelProvider, model: requestedModel, apiKey }

  // Fallback to default provider
  const settings = await readSettings()
  const fallback = (settings.defaultProvider || 'deepseek') as ModelProvider
  if (fallback === requestedProvider) return null

  const fallbackKey = await resolveProviderApiKey(fallback)
  if (!fallbackKey) return null

  return {
    provider: fallback,
    model: FALLBACK_MODELS[fallback] || 'deepseek-chat',
    apiKey: fallbackKey,
  }
}
