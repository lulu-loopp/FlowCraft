import { readSettings } from './settings-storage'

export async function resolveProviderApiKey(provider: string): Promise<string> {
  const settings = await readSettings()

  switch (provider) {
    case 'anthropic':
      return (settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '').trim()
    case 'openai':
      return (settings.openaiApiKey || process.env.OPENAI_API_KEY || '').trim()
    case 'deepseek':
      return (settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '').trim()
    default:
      return ''
  }
}
