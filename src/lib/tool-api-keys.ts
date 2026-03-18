import { readSettings } from '@/lib/settings-storage';

export interface ToolApiKeys {
  tavily: string;
  brave: string;
}

export async function readToolApiKeys(): Promise<ToolApiKeys> {
  const settings = await readSettings();
  return {
    tavily:
      (typeof settings.tavilyApiKey === 'string' && settings.tavilyApiKey.trim()) ||
      process.env.TAVILY_API_KEY ||
      '',
    brave:
      (typeof settings.braveApiKey === 'string' && settings.braveApiKey.trim()) ||
      process.env.BRAVE_API_KEY ||
      '',
  };
}
